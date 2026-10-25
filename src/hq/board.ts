// The requests board: how Aaron and the team file changes and questions, and how they get worked.
// Ported from the Zombie Bike Parade Festival HQ. Three ways in, one board:
//   - the pencil on the real site (Edit website mode, see review.ts)
//   - the ? bubble on every HQ page (public/hq.js)
//   - the New request form on this page
// Statuses: awaiting (needs a reply) | waiting (we asked the requester something) | answered | done | archived.
import { Router, json, redirect, text, formData, randomToken, type Ctx } from '../lib/router.ts';
import { html, raw, richText, type Child, type Safe } from '../lib/html.ts';
import * as db from '../lib/db.ts';
import { currentSession, type Session } from '../lib/auth.ts';
import { shell, requireSession, guardedPost } from './shell.ts';

// Everyone who posts as "us", the people who work the board. Anything else is somebody who needs a reply.
export const OURS = ['Claude'];
const sqlList = OURS.map((n) => `'${n.replace(/'/g, "''")}'`).join(', ');
export const notOurs = (col: string) => `${col} NOT IN (${sqlList})`;
export const isOurs = (col: string) => `${col} IN (${sqlList})`;

export const REQUEST_STATUSES = ['awaiting', 'waiting', 'answered', 'done', 'archived'];
const STATUS_LABEL: Record<string, string> = { awaiting: 'Needs a reply', waiting: 'Waiting on you', answered: 'Answered', done: 'Done', archived: 'Archived' };

type Req = { id: number; title: string; status: string; priority: string; created_by: string | null; page: string | null; source: string; picked_up_at: string | null; picked_up_by: string | null; created_at: string; updated_at: string; messages?: number };
type Msg = { id: number; request_id: number; author: string; body: string; asks: number; created_at: string };
type Att = { id: number; request_id: number | null; message_id: number | null; checklist_item_id: number | null; kind: string; ext: string; filename: string; bytes: number; uploaded_by: string };

// ---------- shared helpers ----------

const ts = (v: string | null | undefined): Safe =>
  v ? html`<time class="loc" datetime="${v.replace(' ', 'T')}Z">${v.slice(0, 16)} UTC</time>` : html``;

const statusBadge = (s: string) => html`<span class="status status-${s}">${STATUS_LABEL[s] || s}</span>`;

const attUrl = (id: number) => `/hq/attachments/${id}`;

function idList(v: string | undefined): number[] {
  return (v || '').split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20);
}

// Only bind rows this person uploaded that are not yet attached to anything.
async function bindAttachments(d: D1Database, ids: number[], who: string, target: { request_id?: number; message_id?: number; checklist_item_id?: number }) {
  if (!ids.length) return;
  const qs = ids.map(() => '?').join(',');
  await d
    .prepare(`UPDATE request_attachments SET request_id=?, message_id=?, checklist_item_id=? WHERE id IN (${qs}) AND request_id IS NULL AND checklist_item_id IS NULL AND uploaded_by=?`)
    .bind(target.request_id ?? null, target.message_id ?? null, target.checklist_item_id ?? null, ...ids, who)
    .run();
}

export async function createRequest(d: D1Database, who: string, o: { title?: string; body?: string; page?: string; priority?: string; source?: string; attachmentIds?: number[] }): Promise<number> {
  const body = (o.body || '').trim();
  const title = (o.title || '').trim().slice(0, 200) || body.slice(0, 80) || 'Screenshot';
  const priority = ['low', 'normal', 'high'].includes(o.priority || '') ? o.priority! : 'normal';
  const r = await d
    .prepare("INSERT INTO requests(title,status,priority,created_by,page,source) VALUES(?,?,?,?,?,?) RETURNING id")
    .bind(title, 'awaiting', priority, who, (o.page || '').slice(0, 300) || null, o.source === 'site' ? 'site' : 'hq')
    .first<{ id: number }>();
  const id = r!.id;
  const m = await d.prepare('INSERT INTO request_messages(request_id,author,body) VALUES(?,?,?) RETURNING id').bind(id, who, body).first<{ id: number }>();
  await bindAttachments(d, o.attachmentIds || [], who, { request_id: id, message_id: m!.id });
  return id;
}

// A reply that asks a question flips the thread to waiting; a reply from someone other than the
// requester means it has been answered; the requester replying puts it back to awaiting.
export async function addMessage(d: D1Database, who: string, id: number, o: { body?: string; asks?: boolean; status?: string; attachmentIds?: number[] }): Promise<boolean> {
  const req = await d.prepare('SELECT created_by FROM requests WHERE id=?').bind(id).first<{ created_by: string }>();
  if (!req) return false;
  const body = (o.body || '').trim();
  if (!body && !(o.attachmentIds || []).length) return false;
  const m = await d.prepare('INSERT INTO request_messages(request_id,author,body,asks) VALUES(?,?,?,?) RETURNING id').bind(id, who, body, o.asks ? 1 : 0).first<{ id: number }>();
  await bindAttachments(d, o.attachmentIds || [], who, { request_id: id, message_id: m!.id });
  let status = o.status && REQUEST_STATUSES.includes(o.status) ? o.status : '';
  if (!status) status = o.asks ? 'waiting' : req.created_by === who ? 'awaiting' : 'answered';
  await d.prepare("UPDATE requests SET status=?, updated_at=datetime('now') WHERE id=?").bind(status, id).run();
  return true;
}

// ---------- JSON API (the pencil, the ? bubble and scripts/board.mjs talk to this) ----------

async function apiSession(c: Ctx): Promise<Session | Response> {
  const s = await currentSession(c);
  if (!s) return json({ error: 'Sign in to HQ first.' }, 401);
  // A plain cross-site form cannot set this header, so a stray page cannot file anything as a teammate.
  if (c.req.method !== 'GET' && c.req.headers.get('x-hq') !== '1') return json({ error: 'Missing X-HQ header.' }, 403);
  return s;
}

const ATTACH_TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };
const MAX_ATTACH = 20 * 1024 * 1024;

function attachExt(file: File): string {
  const t = (file.type || '').toLowerCase();
  const byType: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };
  if (byType[t]) return byType[t];
  const n = (file.name || '').split('.').pop()?.toLowerCase() || '';
  return n === 'jpeg' ? 'jpg' : ATTACH_TYPES[n] ? n : '';
}

export function mountBoard(hq: Router) {
  hq.get('/hq/api/me', async (c) => {
    const s = await apiSession(c);
    if (s instanceof Response) return s;
    return json({ staff: s.staff.name, role: s.staff.role });
  });

  hq.get('/hq/api/page-thread', async (c) => {
    const s = await apiSession(c);
    if (s instanceof Response) return s;
    const page = c.url.searchParams.get('page') || '';
    const rows = await c.env.DB.prepare("SELECT id,title,status,picked_up_by FROM requests WHERE page=? AND status<>'archived' ORDER BY updated_at DESC LIMIT 5").bind(page).all();
    return json({ requests: rows.results });
  });

  hq.post('/hq/api/requests', async (c) => {
    const s = await apiSession(c);
    if (s instanceof Response) return s;
    const b = (await c.req.json().catch(() => ({}))) as { title?: string; body?: string; page?: string; priority?: string; source?: string; attachment_ids?: number[] };
    if (!(b.title || '').trim() && !(b.body || '').trim() && !(b.attachment_ids || []).length) return json({ error: 'Say something first.' }, 400);
    const id = await createRequest(c.env.DB, s.staff.name, { ...b, attachmentIds: (b.attachment_ids || []).map(Number) });
    await db.audit(c.env.DB, s.staff.name, 'filed a request', `#${id}${b.page ? ' on ' + b.page : ''}`);
    return json({ ok: true, id });
  });

  hq.post('/hq/api/requests/:id/messages', async (c) => {
    const s = await apiSession(c);
    if (s instanceof Response) return s;
    const b = (await c.req.json().catch(() => ({}))) as { body?: string; asks?: boolean; status?: string; attachment_ids?: number[] };
    const ok = await addMessage(c.env.DB, s.staff.name, Number(c.params.id), { body: b.body, asks: !!b.asks, status: b.status, attachmentIds: (b.attachment_ids || []).map(Number) });
    return ok ? json({ ok: true }) : json({ error: 'Nothing to send, or no such request.' }, 400);
  });

  hq.post('/hq/api/requests/:id/pickup', async (c) => {
    const s = await apiSession(c);
    if (s instanceof Response) return s;
    const row = await c.env.DB.prepare('SELECT picked_up_by FROM requests WHERE id=?').bind(c.params.id).first<{ picked_up_by: string | null }>();
    if (!row) return json({ error: 'not found' }, 404);
    if (row.picked_up_by && row.picked_up_by !== s.staff.name) return json({ ok: false, picked_up_by: row.picked_up_by }, 409);
    await c.env.DB.prepare("UPDATE requests SET picked_up_at=datetime('now'), picked_up_by=?, updated_at=datetime('now') WHERE id=?").bind(s.staff.name, c.params.id).run();
    return json({ ok: true });
  });

  hq.post('/hq/api/requests/:id/status', async (c) => {
    const s = await apiSession(c);
    if (s instanceof Response) return s;
    const b = (await c.req.json().catch(() => ({}))) as { status?: string };
    if (!b.status || !REQUEST_STATUSES.includes(b.status)) return json({ error: 'bad status' }, 400);
    await c.env.DB.prepare("UPDATE requests SET status=?, updated_at=datetime('now') WHERE id=?").bind(b.status, c.params.id).run();
    return json({ ok: true });
  });

  // What is waiting on us. Independent of the status column, which is set by hand: the question is
  // "whose word was last", and that cannot be wrong.
  hq.get('/hq/api/board', async (c) => {
    const s = await apiSession(c);
    if (s instanceof Response) return s;
    const waiting = await c.env.DB
      .prepare(
        `SELECT r.id, r.status, r.title, r.page, r.priority, m.id AS msg_id, m.author, m.body,
          CAST((julianday('now') - julianday(m.created_at)) * 24 * 60 AS INT) AS mins,
          (SELECT COUNT(*) FROM request_attachments a WHERE a.message_id = m.id) AS atts
         FROM requests r JOIN request_messages m ON m.id = (SELECT id FROM request_messages WHERE request_id = r.id ORDER BY id DESC LIMIT 1)
         WHERE ${notOurs('m.author')} AND r.status NOT IN ('done','archived') ORDER BY m.created_at`,
      )
      .all();
    const asked = await c.env.DB
      .prepare(
        `SELECT r.id, r.status, r.title, m.body, CAST((julianday('now') - julianday(m.created_at)) * 24 * 60 AS INT) AS mins
         FROM requests r JOIN request_messages m ON m.id = (SELECT id FROM request_messages WHERE request_id = r.id ORDER BY id DESC LIMIT 1)
         WHERE ${isOurs('m.author')} AND r.status = 'waiting' ORDER BY m.created_at`,
      )
      .all();
    const punch = await c.env.DB.prepare("SELECT id, section, title, kind, owner, status FROM checklist_items WHERE status IN ('open','doing') AND (owner IS NULL OR lower(owner) <> lower(?)) ORDER BY section_sort, sort").bind(s.staff.name).all();
    return json({ waiting: waiting.results, asked: asked.results, punchOpen: punch.results });
  });

  hq.get('/hq/api/request/:id', async (c) => {
    const s = await apiSession(c);
    if (s instanceof Response) return s;
    const req = await c.env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(c.params.id).first<Req>();
    if (!req) return json({ error: 'not found' }, 404);
    const messages = await c.env.DB.prepare('SELECT * FROM request_messages WHERE request_id=? ORDER BY id').bind(c.params.id).all<Msg>();
    const atts = await c.env.DB.prepare('SELECT id,message_id,kind,ext,filename,bytes FROM request_attachments WHERE request_id=? ORDER BY id').bind(c.params.id).all();
    return json({ request: req, messages: messages.results, attachments: (atts.results as Att[]).map((a) => ({ ...a, url: attUrl(a.id) })) });
  });

  hq.post('/hq/api/attachments', async (c) => {
    const s = await apiSession(c);
    if (s instanceof Response) return s;
    if (!c.env.MEDIA) return json({ error: 'Screenshots need the R2 bucket, which is not connected to this Worker yet.' }, 503);
    const fd = await c.req.formData().catch(() => null);
    const file = fd?.get('file');
    if (!file || typeof file === 'string') return json({ error: 'No file received.' }, 400);
    const f = file as File;
    const ext = attachExt(f);
    if (!ext) return json({ error: 'Images (JPG, PNG, WebP, GIF) and PDFs only.' }, 400);
    if (f.size > MAX_ATTACH) return json({ error: `That file is ${Math.round(f.size / 1048576)} MB. The limit is 20 MB.` }, 400);
    const key = `requests/${randomToken(16)}.${ext}`;
    await c.env.MEDIA.put(key, await f.arrayBuffer(), { httpMetadata: { contentType: ATTACH_TYPES[ext] } });
    const filename = (f.name || '').trim().slice(0, 120) || `pasted-${ext === 'pdf' ? 'file' : 'screenshot'}.${ext}`;
    const kind = ext === 'pdf' ? 'document' : 'image';
    const r = await c.env.DB.prepare('INSERT INTO request_attachments(r2_key,ext,kind,filename,bytes,uploaded_by) VALUES(?,?,?,?,?,?) RETURNING id').bind(key, ext, kind, filename, f.size, s.staff.name).first<{ id: number }>();
    return json({ id: r!.id, kind, ext, filename, bytes: f.size, url: attUrl(r!.id) });
  });

  hq.post('/hq/api/attachments/:id/delete', async (c) => {
    const s = await apiSession(c);
    if (s instanceof Response) return s;
    const row = await c.env.DB.prepare('SELECT r2_key, uploaded_by FROM request_attachments WHERE id=?').bind(c.params.id).first<{ r2_key: string; uploaded_by: string }>();
    if (!row) return json({ error: 'not found' }, 404);
    if (row.uploaded_by !== s.staff.name && s.staff.role !== 'admin') return json({ error: 'not yours' }, 403);
    await c.env.MEDIA?.delete(row.r2_key);
    await c.env.DB.prepare('DELETE FROM request_attachments WHERE id=?').bind(c.params.id).run();
    return json({ ok: true });
  });

  // Served through HQ, not as public media: a screenshot can carry anything that was on screen.
  hq.get('/hq/attachments/:id', async (c) => {
    const s = await currentSession(c);
    if (!s) return new Response('Sign in to HQ first.', { status: 401 });
    const row = await c.env.DB.prepare('SELECT r2_key, ext, filename FROM request_attachments WHERE id=?').bind(c.params.id).first<{ r2_key: string; ext: string; filename: string }>();
    const obj = row && c.env.MEDIA ? await c.env.MEDIA.get(row.r2_key) : null;
    if (!row || !obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, {
      headers: {
        'content-type': ATTACH_TYPES[row.ext] || 'application/octet-stream',
        'cache-control': 'private, max-age=3600',
        'content-disposition': `inline; filename="${(row.filename || 'file').replace(/[^\w.\- ]/g, '_')}"`,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; img-src 'self'; object-src 'none'; sandbox",
      },
    });
  });

  // ---------- HQ pages: requests ----------

  const TABS: [string, string][] = [['open', 'Open'], ['answered', 'Answered'], ['archived', 'Archived']];

  hq.get('/hq/requests', async (c) => {
    const sess = await requireSession(c);
    if (sess instanceof Response) return sess;
    const view = ['open', 'answered', 'archived'].includes(c.url.searchParams.get('view') || '') ? c.url.searchParams.get('view')! : 'open';
    const where = view === 'open' ? "status IN ('awaiting','waiting')" : view === 'answered' ? "status IN ('answered','done')" : "status = 'archived'";
    const order = view === 'open' ? "CASE status WHEN 'waiting' THEN 0 ELSE 1 END, updated_at DESC" : 'updated_at DESC';
    const rows = await c.env.DB
      .prepare(`SELECT r.*, (SELECT COUNT(*) FROM request_messages m WHERE m.request_id = r.id) AS messages FROM requests r WHERE ${where} ORDER BY ${order} LIMIT 300`)
      .all<Req>()
      .then((r) => r.results);
    return shell(
      c,
      'Requests',
      html`<p class="muted">Changes, questions and bugs, worked here. File one below, from the <b>?</b> bubble, or with the pencil on the real site (press <b>Edit website</b> in the menu).</p>
      <div class="split">
        <div>
          <p class="tabs">${TABS.map(([k, l]) => html`<a href="/hq/requests?view=${k}" ${k === view ? raw('aria-current="page"') : ''}>${l}</a> `)}</p>
          ${rows.length
            ? html`<table class="table clickable"><thead><tr><th>#</th><th>Title</th><th>From</th><th>Status</th><th>Updated</th></tr></thead><tbody>${rows.map(
                (r) => html`<tr class="${r.picked_up_by ? '' : view === 'open' ? 'unread' : ''}">
                <td><a href="/hq/requests/${r.id}">${r.id}</a></td>
                <td><a class="rowlink" href="/hq/requests/${r.id}">${r.title}</a>${r.page ? html`<div class="muted small">${r.page}</div>` : ''}</td>
                <td>${r.created_by}</td>
                <td>${statusBadge(r.status)}${r.priority === 'high' ? html` <b class="hot">high</b>` : ''}${r.picked_up_by ? html`<div class="onit">▸ ${r.picked_up_by} is on it</div>` : ''}</td>
                <td class="nowrap muted">${ts(r.updated_at)}</td></tr>`,
              )}</tbody></table>`
            : html`<p class="muted empty">Nothing here.</p>`}
        </div>
        <form method="post" action="/hq/requests" class="hq-form">
          <input type="hidden" name="csrf" value="${sess.csrf}">
          <h2 class="tight">New request</h2>
          <label>Title<input name="title" maxlength="200"></label>
          <label>Details<div data-attach>${attachBox('What should change, or what is confusing? Paste a screenshot right in here.')}</div></label>
          <label>Priority<select name="priority"><option>low</option><option selected>normal</option><option>high</option></select></label>
          <button class="btn">File request as ${sess.staff.name}</button>
        </form>
      </div>`,
      sess,
    );
  });

  hq.post('/hq/requests', async (c) => {
    const g = await guardedPost(c);
    if (g instanceof Response) return g;
    if (!(g.f.title || '').trim() && !(g.f.body || '').trim() && !idList(g.f.attachment_ids).length) return redirect('/hq/requests?ok=' + encodeURIComponent('Say something first.'), 303);
    const id = await createRequest(c.env.DB, g.sess.staff.name, { title: g.f.title, body: g.f.body, priority: g.f.priority, attachmentIds: idList(g.f.attachment_ids) });
    await db.audit(c.env.DB, g.sess.staff.name, 'filed a request', `#${id}`);
    return redirect(`/hq/requests/${id}?ok=` + encodeURIComponent('Filed.'), 303);
  });

  hq.get('/hq/requests/:id', async (c) => {
    const sess = await requireSession(c);
    if (sess instanceof Response) return sess;
    const id = Number(c.params.id);
    const r = await c.env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(id).first<Req>();
    if (!r) return text('Not found', 404);
    const [msgs, atts, prev, next, pos] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM request_messages WHERE request_id=? ORDER BY id').bind(id).all<Msg>().then((x) => x.results),
      c.env.DB.prepare('SELECT * FROM request_attachments WHERE request_id=? ORDER BY id').bind(id).all<Att>().then((x) => x.results),
      // Neighbours are by id, never by the list's own order, which reshuffles the moment anyone replies.
      c.env.DB.prepare("SELECT id FROM requests WHERE id < ? AND status <> 'archived' ORDER BY id DESC LIMIT 1").bind(id).first<{ id: number }>(),
      c.env.DB.prepare("SELECT id FROM requests WHERE id > ? AND status <> 'archived' ORDER BY id ASC LIMIT 1").bind(id).first<{ id: number }>(),
      c.env.DB.prepare("SELECT (SELECT COUNT(*) FROM requests WHERE id <= ? AND status <> 'archived') AS n, (SELECT COUNT(*) FROM requests WHERE status <> 'archived') AS total").bind(id).first<{ n: number; total: number }>(),
    ]);
    const firstId = msgs[0]?.id;
    const attFor = (m: Msg) => atts.filter((a) => a.message_id === m.id || (a.message_id === null && m.id === firstId));
    const hidden = (action: string) => html`<form method="post" action="/hq/requests/${r.id}/${action}" class="inline"><input type="hidden" name="csrf" value="${sess.csrf}">`;
    return shell(
      c,
      `#${r.id} ${r.title}`,
      html`<div class="thread" data-prev="${prev?.id ?? ''}" data-next="${next?.id ?? ''}">
      <div class="thread-bar">
        <span class="pager"><a class="btn btn-quiet ${prev ? '' : 'off'}" href="${prev ? `/hq/requests/${prev.id}` : '#'}" title="Previous (left arrow)">←</a>
          <span class="muted small">${pos?.n ?? '?'} of ${pos?.total ?? '?'}</span>
          <a class="btn btn-quiet ${next ? '' : 'off'}" href="${next ? `/hq/requests/${next.id}` : '#'}" title="Next (right arrow)">→</a></span>
        <a href="/hq/requests">All requests</a>
        ${r.picked_up_by
          ? html`${hidden('release')}<button class="btn btn-quiet">▸ ${r.picked_up_by} is on it (release)</button></form>`
          : html`${hidden('pickup')}<button class="btn">Pick this up</button></form>`}
        ${hidden('status')}<select name="status">${REQUEST_STATUSES.map((s) => html`<option value="${s}" ${s === r.status ? raw('selected') : ''}>${STATUS_LABEL[s]}</option>`)}</select> <button class="btn btn-quiet">Set</button></form>
      </div>
      <p class="muted small">Filed by ${r.created_by} ${ts(r.created_at)}${r.page ? html` · page <a href="${r.page}" target="_blank" rel="noopener"><code>${r.page}</code></a>` : ''}${r.source === 'site' ? ' · from the pencil on the site' : ''} · ${statusBadge(r.status)}${r.priority === 'high' ? html` <b class="hot">high</b>` : ''}${r.picked_up_at ? html` · <b class="onit-inline">picked up by ${r.picked_up_by} ${ts(r.picked_up_at)}</b>` : ''}</p>
      ${msgs.map(
        (m) => html`<article class="msg ${m.author === sess.staff.name ? 'mine' : ''}">
          <header><b>${m.author}</b><span class="muted small">${ts(m.created_at)}${m.asks ? ' · asked a question' : ''}</span></header>
          ${m.body ? html`<div class="rich">${richText(m.body)}</div>` : ''}
          ${attachList(attFor(m))}
        </article>`,
      )}
      <form method="post" action="/hq/requests/${r.id}/reply" class="hq-form">
        <input type="hidden" name="csrf" value="${sess.csrf}">
        <div data-attach>${attachBox('Reply, or paste a screenshot...', 4, 'body')}</div>
        <div class="row"><label class="check"><input type="checkbox" name="asks" value="1"> This reply asks the requester a question</label><button class="btn">Reply</button></div>
      </form>
      </div>`,
      sess,
    );
  });

  hq.post('/hq/requests/:id/reply', async (c) => {
    const g = await guardedPost(c);
    if (g instanceof Response) return g;
    const ok = await addMessage(c.env.DB, g.sess.staff.name, Number(c.params.id), { body: g.f.body, asks: !!g.f.asks, attachmentIds: idList(g.f.attachment_ids) });
    return redirect(`/hq/requests/${c.params.id}?ok=` + encodeURIComponent(ok ? 'Reply sent.' : 'Write something first.'), 303);
  });

  hq.post('/hq/requests/:id/status', async (c) => {
    const g = await guardedPost(c);
    if (g instanceof Response) return g;
    const s = REQUEST_STATUSES.includes(g.f.status) ? g.f.status : 'awaiting';
    await c.env.DB.prepare("UPDATE requests SET status=?, updated_at=datetime('now') WHERE id=?").bind(s, c.params.id).run();
    await db.audit(c.env.DB, g.sess.staff.name, 'set request status', `#${c.params.id} ${s}`);
    return redirect(`/hq/requests/${c.params.id}?ok=` + encodeURIComponent(`Marked ${STATUS_LABEL[s].toLowerCase()}.`), 303);
  });

  hq.post('/hq/requests/:id/pickup', async (c) => {
    const g = await guardedPost(c);
    if (g instanceof Response) return g;
    const row = await c.env.DB.prepare('SELECT picked_up_by FROM requests WHERE id=?').bind(c.params.id).first<{ picked_up_by: string | null }>();
    if (row?.picked_up_by && row.picked_up_by !== g.sess.staff.name) return redirect(`/hq/requests/${c.params.id}?ok=` + encodeURIComponent(`${row.picked_up_by} already has this one.`), 303);
    await c.env.DB.prepare("UPDATE requests SET picked_up_at=datetime('now'), picked_up_by=?, updated_at=datetime('now') WHERE id=?").bind(g.sess.staff.name, c.params.id).run();
    return redirect(`/hq/requests/${c.params.id}`, 303);
  });

  hq.post('/hq/requests/:id/release', async (c) => {
    const g = await guardedPost(c);
    if (g instanceof Response) return g;
    await c.env.DB.prepare("UPDATE requests SET picked_up_at=NULL, picked_up_by=NULL, updated_at=datetime('now') WHERE id=?").bind(c.params.id).run();
    return redirect(`/hq/requests/${c.params.id}`, 303);
  });

  // ---------- HQ pages: punch list ----------

  type Item = { id: number; section: string; section_sort: number; title: string; detail: string | null; kind: 'task' | 'question' | 'asset'; status: string; owner: string | null; suggestion: string | null; answer: string | null; answer_source: string | null; notes: string | null; request_id: number | null; added_by: string | null; picked_up_by: string | null; sort: number };
  const KIND: Record<string, string> = { task: 'we build', question: 'you decide', asset: 'you send' };
  const FILTERS: [string, string][] = [['todo', 'To do'], ['mine', 'For me'], ['questions', 'Needs a call'], ['all', 'Everything']];
  const isOpen = (i: Item) => i.status === 'open' || i.status === 'doing';

  hq.get('/hq/punchlist', async (c) => {
    const sess = await requireSession(c);
    if (sess instanceof Response) return sess;
    const f = FILTERS.some(([k]) => k === c.url.searchParams.get('f')) ? c.url.searchParams.get('f')! : 'todo';
    const items = await c.env.DB.prepare('SELECT * FROM checklist_items ORDER BY section_sort, sort, id').all<Item>().then((r) => r.results);
    const atts = await c.env.DB.prepare('SELECT * FROM request_attachments WHERE checklist_item_id IS NOT NULL ORDER BY id').all<Att>().then((r) => r.results);
    const me = sess.staff.name.toLowerCase();
    const done = items.filter((i) => i.status === 'done').length;
    const forMe = items.filter((i) => isOpen(i) && (i.owner || '').toLowerCase() === me).length;
    const shown = items.filter((i) => (f === 'all' ? true : f === 'mine' ? isOpen(i) && (i.owner || '').toLowerCase() === me : f === 'questions' ? isOpen(i) && i.kind !== 'task' : isOpen(i)));
    const sections = new Map<string, Item[]>();
    for (const i of shown) (sections.get(i.section) || sections.set(i.section, []).get(i.section)!).push(i);
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    const form = (id: number, act: string, inner: Child, extra = '') => html`<form method="post" action="/hq/punchlist/${id}" class="inline ${extra}"><input type="hidden" name="csrf" value="${sess.csrf}"><input type="hidden" name="f" value="${f}"><input type="hidden" name="do" value="${act}">${inner}</form>`;
    return shell(
      c,
      'Punch list',
      html`<p class="muted">What is left, broken into pieces. Each question has our recommendation already written: agree with it, change it, or write your own. Add what we missed and drop what you do not want.</p>
      <p class="note-box"><b>Nothing here needs submitting.</b> Every answer and note saves when you press its Save button. The circle on the left is not submit: it only marks an item finished, which moves it out of To do and into Everything. Your answer is kept either way.</p>
      <div class="plbar"><div><b class="big">${done}</b> <span class="muted">of ${items.length} done</span>${forMe ? html` <span class="chip chip-warn">${forMe} waiting on ${sess.staff.name}</span>` : ''}</div>
        <p class="tabs">${FILTERS.map(([k, l]) => html`<a href="/hq/punchlist?f=${k}" ${k === f ? raw('aria-current="page"') : ''}>${l}</a> `)}</p></div>
      <div class="progress"><i class="p${Math.round(pct / 5) * 5}"></i></div>
      ${sections.size === 0 ? html`<p class="muted empty">Nothing here. Try another tab.</p>` : ''}
      ${[...sections.entries()].map(
        ([name, rows]) => html`<section class="plsec"><h3>${name}</h3>
        ${rows.map((it) => {
          const mine = atts.filter((a) => a.checklist_item_id === it.id);
          const finished = it.status === 'done';
          return html`<div class="pl ${finished ? 'is-done' : ''} ${it.status === 'dropped' ? 'is-dropped' : ''}" id="i${it.id}">
            ${form(it.id, finished ? 'reopen' : 'finish', html`<button class="tick" title="${finished ? 'Mark not finished' : 'Mark finished. This is not submit; your answer is already saved.'}" aria-label="${finished ? 'Mark not finished' : 'Mark finished'}">${finished ? '✓' : ''}</button>`)}
            <details ${it.id === Number(c.url.searchParams.get('open')) ? raw('open') : ''}><summary><span class="pl-t">${it.title}</span>
              <span class="chips"><span class="chip chip-${it.kind}">${KIND[it.kind]}</span>${it.owner ? html`<span class="muted">${it.owner}</span>` : ''}${it.answer ? html`<span class="chip chip-ok">${it.answer_source === 'own' ? 'your call' : 'agreed'}</span>` : ''}${!it.answer && it.suggestion ? html`<span class="muted">suggestion ready</span>` : ''}${it.notes ? html`<span class="muted">has notes</span>` : ''}${it.request_id ? html`<a href="/hq/requests/${it.request_id}">thread #${it.request_id}</a>` : ''}${mine.length ? html`<span class="muted">${mine.length} attached</span>` : ''}${it.picked_up_by ? html`<span class="chip chip-ok">▸ ${it.picked_up_by} is on it</span>` : ''}</span></summary>
              <div class="pl-body">
                ${it.detail ? html`<p class="muted">${it.detail}</p>` : ''}
                ${it.suggestion
                  ? html`<div class="suggest"><b>Our recommendation</b><p>${it.suggestion}</p>
                    ${it.answer && it.answer_source === 'suggested' ? html`<span class="chip chip-ok">You agreed</span>` : form(it.id, 'agree', html`<button class="btn">Agree with this</button>`)}</div>`
                  : ''}
                ${it.kind === 'question' ? form(it.id, 'answer', html`<div data-attach>${attachBox('Your own answer', 3, 'answer', it.answer_source === 'own' ? it.answer || '' : '')}</div><button class="btn btn-quiet">Save my answer</button>`, 'block') : ''}
                ${form(it.id, 'notes', html`<div data-attach>${attachBox('Notes (only the team sees these)', 3, 'notes', it.notes || '')}</div><button class="btn btn-quiet">Save notes</button>`, 'block')}
                ${attachList(mine)}
                <div class="row">
                  ${it.picked_up_by ? form(it.id, 'release', html`<button class="btn btn-quiet">Release (${it.picked_up_by} is on it)</button>`) : form(it.id, 'pickup', html`<button class="btn btn-quiet">Pick this up</button>`)}
                  ${it.request_id ? '' : form(it.id, 'thread', html`<button class="btn btn-quiet">Start a request thread</button>`)}
                  ${it.status === 'dropped' ? form(it.id, 'reopen', html`<button class="btn btn-quiet">Bring back</button>`) : form(it.id, 'drop', html`<button class="btn btn-quiet danger">Drop it</button>`)}
                </div>
                <p class="muted small">${it.added_by ? `Added by ${it.added_by}` : ''}</p>
              </div></details></div>`;
        })}
        <form method="post" action="/hq/punchlist" class="addrow"><input type="hidden" name="csrf" value="${sess.csrf}"><input type="hidden" name="section" value="${name}"><input type="hidden" name="f" value="${f}">
          <input name="title" placeholder="Add an item to ${name}" required maxlength="200"><select name="kind"><option value="task">we build</option><option value="question">you decide</option><option value="asset">you send</option></select><button class="btn btn-quiet">Add</button></form>
        </section>`,
      )}`,
      sess,
    );
  });

  hq.post('/hq/punchlist', async (c) => {
    const g = await guardedPost(c);
    if (g instanceof Response) return g;
    const section = (g.f.section || '').trim().slice(0, 80);
    const title = (g.f.title || '').trim().slice(0, 200);
    if (!section || !title) return redirect('/hq/punchlist', 303);
    const kind = ['task', 'question', 'asset'].includes(g.f.kind) ? g.f.kind : 'task';
    const sec = await c.env.DB.prepare('SELECT section_sort FROM checklist_items WHERE section=? LIMIT 1').bind(section).first<{ section_sort: number }>();
    const r = await c.env.DB.prepare('INSERT INTO checklist_items(section,section_sort,title,kind,added_by,sort) VALUES(?,?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM checklist_items)) RETURNING id').bind(section, sec?.section_sort ?? 9, title, kind, g.sess.staff.name).first<{ id: number }>();
    await db.audit(c.env.DB, g.sess.staff.name, 'added a punch list item', title);
    return redirect(`/hq/punchlist?f=${g.f.f || 'todo'}&open=${r!.id}#i${r!.id}`, 303);
  });

  hq.post('/hq/punchlist/:id', async (c) => {
    const g = await guardedPost(c);
    if (g instanceof Response) return g;
    const id = Number(c.params.id);
    const who = g.sess.staff.name;
    const it = await c.env.DB.prepare('SELECT * FROM checklist_items WHERE id=?').bind(id).first<Item>();
    if (!it) return text('Not found', 404);
    const touch = "last_edited_by=?, updated_at=datetime('now')";
    const u = (sql: string, ...a: unknown[]) => c.env.DB.prepare(`UPDATE checklist_items SET ${sql}, ${touch} WHERE id=?`).bind(...a, who, id).run();
    let msg = 'Saved.';
    switch (g.f.do) {
      case 'finish': await u("status='done'"); msg = 'Marked finished. It moved to Everything; any answer is kept.'; break;
      case 'reopen': await u("status='open'"); msg = 'Back on the To do list.'; break;
      case 'drop': await u("status='dropped'"); msg = 'Dropped. It stays under Everything.'; break;
      case 'agree': await u("answer=suggestion, answer_source='suggested'"); msg = 'Agreed. The recommendation is now the answer.'; break;
      case 'answer': {
        const a = (g.f.answer || g.f.body || '').trim().slice(0, 4000);
        if (a) await u("answer=?, answer_source='own'", a);
        else await u('answer=NULL, answer_source=NULL');
        msg = a ? 'Answer saved.' : 'Answer cleared.';
        break;
      }
      case 'notes': await u('notes=?', (g.f.notes || g.f.body || '').trim().slice(0, 4000) || null); msg = 'Notes saved.'; break;
      case 'pickup': await u("picked_up_by=?, picked_up_at=datetime('now')", who); break;
      case 'release': await u('picked_up_by=NULL, picked_up_at=NULL'); break;
      case 'thread': {
        const body = [it.detail, it.suggestion ? `Our recommendation: ${it.suggestion}` : '', it.answer ? `Answer so far: ${it.answer}` : ''].filter(Boolean).join('\n\n');
        const rid = await createRequest(c.env.DB, who, { title: it.title, body, page: '/hq/punchlist' });
        await u('request_id=?', rid);
        return redirect(`/hq/requests/${rid}?ok=` + encodeURIComponent('Thread started from the punch list.'), 303);
      }
    }
    await bindAttachments(c.env.DB, idList(g.f.attachment_ids), who, { checklist_item_id: id });
    return redirect(`/hq/punchlist?f=${g.f.f || 'todo'}&open=${id}&ok=${encodeURIComponent(msg)}#i${id}`, 303);
  });
}

// ---------- markup helpers shared by the pages ----------

// A textarea with a paste/drag/attach strip. public/hq.js finds [data-attach], uploads each file as it is
// added, and puts the ids in the hidden attachment_ids field so the form posts them with the text.
function attachBox(placeholder: string, rows = 5, name = 'body', value = ''): Safe {
  return html`<textarea name="${name}" rows="${rows}" placeholder="${placeholder}">${value}</textarea>
    <input type="hidden" name="attachment_ids" value="">
    <div class="att-bar"><button type="button" class="btn btn-quiet att-pick">Attach file</button><span class="muted small att-hint">or paste a screenshot, or drag one in</span><span class="att-msg small"></span></div>
    <div class="att-thumbs"></div>`;
}

function attachList(list: Att[]): Safe {
  if (!list.length) return html``;
  return html`<div class="att-list">${list.map((a) =>
    a.kind === 'image'
      ? html`<a href="${attUrl(a.id)}" target="_blank" rel="noopener" title="${a.filename}"><img src="${attUrl(a.id)}" alt="${a.filename}" loading="lazy"></a>`
      : html`<a class="doc" href="${attUrl(a.id)}" target="_blank" rel="noopener">${a.filename || 'PDF'}</a>`,
  )}</div>`;
}
