// HQ: the staff backend at /hq. Server-rendered forms, no JavaScript required.
import { Router, page, redirect, formData, text, type Ctx } from '../lib/router.ts';
import { html, raw, paragraphs, type Child, type Safe } from '../lib/html.ts';
import * as db from '../lib/db.ts';
import { currentSession, startSession, endSession, hashPassword, verifyPassword, staffCount, type Session } from '../lib/auth.ts';
import { ORDER_STATUSES } from '../lib/db.ts';

export const hq = new Router();

const MENU = [
  ['/hq/dashboard', 'Dashboard'],
  ['/hq/orders', 'Orders'],
  ['/hq/messages', 'Messages'],
  ['/hq/details', 'Game details'],
  ['/hq/pages', 'Page copy'],
  ['/hq/worlds', 'Worlds'],
  ['/hq/characters', 'Characters'],
  ['/hq/lessons', 'How to play'],
  ['/hq/faqs', 'Rules FAQ'],
  ['/hq/reviews', 'Reviews'],
  ['/hq/news', 'News'],
  ['/hq/tracks', 'Music'],
  ['/hq/games', 'Games'],
  ['/hq/settings', 'Settings'],
];

function shell(c: Ctx, title: string, body: Child, sess: Session | null, counts: Counts = { unread: 0, newOrders: 0 }): Response {
  const flash = c.url.searchParams.get('ok') ? html`<div class="flash">${c.url.searchParams.get('ok')}</div>` : '';
  const out =
    '<!doctype html>' +
    html`<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | HQ</title><meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/hq.css?v=1"></head>
<body class="hq">
<header class="hq-head"><a class="hq-brand" href="/hq/dashboard">Coffee Time <span>HQ</span></a>
${sess ? html`<nav class="hq-nav"><ul>${MENU.map(([h, l]) => html`<li><a href="${h}" ${c.url.pathname.startsWith(h) ? raw('aria-current="page"') : ''}>${l}${h === '/hq/messages' && counts.unread ? html` <b class="pill">${counts.unread}</b>` : ''}${h === '/hq/orders' && counts.newOrders ? html` <b class="pill">${counts.newOrders}</b>` : ''}</a></li>`)}</ul>
<form method="post" action="/hq/logout"><input type="hidden" name="csrf" value="${sess.csrf}"><span class="who">${sess.staff.name}</span><button class="link">Log out</button></form></nav>` : ''}
</header>
<main class="hq-main">${flash}<h1>${title}</h1>${body}</main>
<footer class="hq-foot"><a href="/" target="_blank" rel="noopener">View the live site</a></footer>
</body></html>`.s;
  return page(out);
}

async function requireSession(c: Ctx): Promise<Session | Response> {
  const s = await currentSession(c);
  if (!s) return redirect('/hq?next=' + encodeURIComponent(c.url.pathname));
  return s;
}

async function guardedPost(c: Ctx): Promise<{ sess: Session; f: Record<string, string> } | Response> {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const f = await formData(c.req);
  if (f.csrf !== sess.csrf) return text('Form expired. Go back, reload the page and try again.', 403);
  return { sess, f };
}

type Counts = { unread: number; newOrders: number };
async function counts(d: D1Database): Promise<Counts> {
  const r = await d
    .prepare("SELECT (SELECT COUNT(*) FROM messages WHERE read_at IS NULL AND archived_at IS NULL) AS unread, (SELECT COUNT(*) FROM orders WHERE status='new') AS newOrders")
    .first<Counts>();
  return { unread: r?.unread ?? 0, newOrders: r?.newOrders ?? 0 };
}

// ---------- login / setup ----------

hq.get('/hq', async (c) => {
  if (await currentSession(c)) return redirect('/hq/dashboard');
  const n = await staffCount(c.env.DB);
  if (n === 0) return redirect('/hq/setup');
  const err = c.url.searchParams.get('err');
  return shell(
    c,
    'Log in',
    html`${err ? html`<div class="flash flash-err">${err}</div>` : ''}
    <form method="post" action="/hq/login" class="hq-form narrow">
      <input type="hidden" name="next" value="${c.url.searchParams.get('next') || ''}">
      <label>Name <input name="name" autocomplete="username" required autofocus></label>
      <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn">Log in</button>
    </form>`,
    null,
  );
});

hq.post('/hq/login', async (c) => {
  const f = await formData(c.req);
  if (await db.overLimit(c.env.DB, `login:${c.ip}`, 10, 900)) return redirect('/hq?err=' + encodeURIComponent('Too many attempts. Wait fifteen minutes.'));
  const staff = await c.env.DB.prepare('SELECT * FROM staff WHERE lower(name)=lower(?)').bind((f.name || '').trim()).first<db.Staff>();
  if (!staff || !(await verifyPassword(f.password || '', staff.pass_hash))) {
    return redirect('/hq?err=' + encodeURIComponent('That name and password do not match.'));
  }
  const { cookie } = await startSession(c, staff.id);
  await db.audit(c.env.DB, staff.name, 'login');
  const next = f.next && f.next.startsWith('/hq') ? f.next : '/hq/dashboard';
  return new Response(null, { status: 303, headers: { location: next, 'set-cookie': cookie } });
});

hq.post('/hq/logout', async (c) => {
  const cookie = await endSession(c);
  return new Response(null, { status: 303, headers: { location: '/hq', 'set-cookie': cookie } });
});

// First-run: create the first admin. Only works while the staff table is empty, and only with the
// HQ_SETUP_TOKEN secret, typed into a field (forgiving of case, spaces and quotes around it).
const norm = (t: string) => t.trim().replace(/^["']|["']$/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const tokenOk = (env: { HQ_SETUP_TOKEN?: string }, given: string) => !!env.HQ_SETUP_TOKEN && !!given && norm(given) === norm(env.HQ_SETUP_TOKEN);

function setupForm(err = '', token = ''): Safe {
  return html`${err ? html`<div class="flash flash-err">${err}</div>` : ''}
    <p class="muted">HQ has no staff accounts yet. Create the first one with the setup phrase saved in Cloudflare as HQ_SETUP_TOKEN.</p>
    <form method="post" action="/hq/setup" class="hq-form narrow">
      <label>Setup phrase <input name="token" value="${token}" required autocomplete="off" autofocus></label>
      <label>Your first name <small>(this is what you log in with)</small><input name="name" required autocomplete="username"></label>
      <label>Password <small>(12 characters or more)</small><input name="password" type="password" minlength="12" required autocomplete="new-password"></label>
      <button class="btn">Create account</button>
    </form>`;
}

hq.get('/hq/setup', async (c) => {
  if ((await staffCount(c.env.DB)) > 0) return redirect('/hq');
  if (!c.env.HQ_SETUP_TOKEN) return shell(c, 'Set up HQ', html`<p>HQ is locked. Add a secret named HQ_SETUP_TOKEN to this Worker in Cloudflare, then reload this page.</p>`, null);
  return shell(c, 'Create the first admin', setupForm('', c.url.searchParams.get('token') || ''), null);
});

hq.post('/hq/setup', async (c) => {
  if ((await staffCount(c.env.DB)) > 0) return redirect('/hq');
  if (await db.overLimit(c.env.DB, `setup:${c.ip}`, 10, 900)) return text('Too many attempts. Wait fifteen minutes.', 429);
  const f = await formData(c.req);
  if (!tokenOk(c.env, f.token || '')) return shell(c, 'Create the first admin', setupForm('That setup phrase does not match the one saved in Cloudflare. Check it there (edit the HQ_SETUP_TOKEN secret to set a new one) and try again.'), null);
  if ((f.password || '').length < 12) return shell(c, 'Create the first admin', setupForm('Password needs 12 characters or more.', f.token), null);
  const name = (f.name || '').trim();
  if (!name || (f.password || '').length < 12) return text('Name and a 12+ character password are required.', 400);
  const r = await c.env.DB.prepare('INSERT INTO staff(name,pass_hash,role) VALUES(?,?,?) RETURNING id').bind(name, await hashPassword(f.password), 'admin').first<{ id: number }>();
  const { cookie } = await startSession(c, r!.id);
  await db.audit(c.env.DB, name, 'setup', 'first admin created');
  return new Response(null, { status: 303, headers: { location: '/hq/dashboard?ok=' + encodeURIComponent('Welcome. HQ is ready.'), 'set-cookie': cookie } });
});

// ---------- dashboard ----------

hq.get('/hq/dashboard', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const [n, recentOrders, recent, s, outbox, lastEdit, sold] = await Promise.all([
    counts(c.env.DB),
    c.env.DB.prepare("SELECT * FROM orders WHERE status IN ('new','contacted','paid') ORDER BY created_at DESC LIMIT 8").all<db.Order>().then((r) => r.results),
    c.env.DB.prepare('SELECT * FROM messages WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT 5').all<db.Message>().then((r) => r.results),
    db.getSettings(c.env.DB),
    c.env.DB.prepare('SELECT status, COUNT(*) n FROM outbox GROUP BY status').all<{ status: string; n: number }>().then((r) => r.results),
    c.env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 8').all<{ who: string; what: string; detail: string; created_at: string }>().then((r) => r.results),
    c.env.DB.prepare("SELECT COALESCE(SUM(quantity),0) AS q FROM orders WHERE status IN ('paid','shipped')").first<{ q: number }>(),
  ]);
  const live = s.site_indexable === '1';
  const mail = !!(c.env.RESEND_API_KEY && c.env.MAIL_FROM);
  return shell(
    c,
    'Dashboard',
    html`
    <div class="cards">
      <a class="card ${n.newOrders ? 'card-hot' : ''}" href="/hq/orders"><b>${n.newOrders}</b><span>${n.newOrders === 1 ? 'new order request' : 'new order requests'}</span></a>
      <a class="card ${n.unread ? 'card-hot' : ''}" href="/hq/messages"><b>${n.unread}</b><span>${n.unread === 1 ? 'unread message' : 'unread messages'}</span></a>
      <div class="card"><b>${sold?.q ?? 0}</b><span>games paid or shipped through the website</span></div>
      <a class="card" href="/hq/settings"><b>${live ? 'Live' : 'Hidden'}</b><span>${live ? 'Search engines may index the site' : 'Search engines are told to stay away'}</span></a>
      <a class="card" href="/hq/details"><b>${s.orders_open === '0' ? 'Paused' : 'Open'}</b><span>Order form</span></a>
      <div class="card"><b>${mail ? 'On' : 'Off'}</b><span>Email alerts ${mail ? `to ${c.env.NOTIFY_TO || s.notify_email}` : '(orders and messages still land here)'}</span></div>
    </div>
    <h2>Orders to handle</h2>
    ${ordersTable(recentOrders)}
    <h2>Recent messages</h2>
    ${messagesTable(recent)}
    <h2>Recent changes</h2>
    <ul class="log">${lastEdit.map((l) => html`<li><time>${l.created_at}</time> ${l.who} ${l.what}${l.detail ? html`: <span class="muted">${l.detail}</span>` : ''}</li>`)}</ul>
    <p class="muted small">Outbox: ${outbox.map((o) => `${o.n} ${o.status}`).join(', ') || 'empty'}.</p>`,
    sess,
    n,
  );
});

// ---------- orders ----------

const statusLabel = (k: string) => ORDER_STATUSES.find((x) => x.key === k)?.label || k;

function ordersTable(list: db.Order[]): Safe {
  if (!list.length) return html`<p class="muted">No order requests here. When someone fills in the order form, it shows up in this list.</p>`;
  return html`<table class="table">
    <thead><tr><th>#</th><th>When</th><th>Who</th><th>Games</th><th>Status</th></tr></thead>
    <tbody>${list.map(
      (o) => html`<tr class="${o.status === 'new' ? 'unread' : ''}">
        <td><a href="/hq/orders/${o.id}">${o.id}</a></td>
        <td><a href="/hq/orders/${o.id}">${o.created_at.slice(0, 16)}</a></td>
        <td>${o.name}<br><span class="muted">${o.email}</span></td>
        <td>${o.quantity}</td>
        <td><span class="status status-${o.status}">${statusLabel(o.status)}</span></td>
      </tr>`,
    )}</tbody></table>`;
}

hq.get('/hq/orders', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const f = c.url.searchParams.get('status') || 'open';
  const where = f === 'all' ? '' : f === 'open' ? "WHERE status IN ('new','contacted','paid')" : 'WHERE status=?';
  const stmt = c.env.DB.prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT 300`);
  const list = await (where.includes('?') ? stmt.bind(f) : stmt).all<db.Order>().then((r) => r.results);
  const tabs = [['open', 'To do'], ...ORDER_STATUSES.map((x) => [x.key, x.label]), ['all', 'All']];
  return shell(
    c,
    'Orders',
    html`<p class="tabs">${tabs.map(([k, l]) => html`<a href="/hq/orders?status=${k}" ${k === f ? raw('aria-current="page"') : ''}>${l}</a> `)}</p>
    <p class="muted small">Nothing is charged on the website. Each request is someone asking for games; email them to confirm shipping and payment, then move the order along.</p>
    ${ordersTable(list)}`,
    sess,
    await counts(c.env.DB),
  );
});

hq.get('/hq/orders/:id', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.params.id).first<db.Order>();
  if (!o) return text('Not found', 404);
  const s = await db.getSettings(c.env.DB);
  const subtotal = (o.quantity * parseFloat(s.price || '0')).toFixed(2);
  const first = o.name.split(' ')[0];
  const replySubject = encodeURIComponent(`Your Coffee Time order (#${o.id})`);
  const replyBody = encodeURIComponent(
    `Hi ${first},\n\nThanks for ordering Coffee Time! You asked for ${o.quantity} ${o.quantity === 1 ? 'game' : 'games'} ($${subtotal}) shipped to:\n\n${o.address}\n\nShipping comes to $____, so the total is $____. You can pay by ____.\n\nAs soon as payment arrives we will send your game${o.quantity === 1 ? '' : 's'} on the way.\n\nIt's Coffee Time!\nThe Coffee Time team\n`,
  );
  return shell(
    c,
    `Order #${o.id} from ${o.name}`,
    html`<p class="crumb"><a href="/hq/orders">All orders</a></p>
    <dl class="kv">
      <dt>Received</dt><dd>${o.created_at} (UTC)</dd>
      <dt>Games</dt><dd><b>${o.quantity}</b> (subtotal $${subtotal} before shipping)</dd>
      <dt>Email</dt><dd><a href="mailto:${o.email}">${o.email}</a></dd>
      <dt>Phone</dt><dd>${o.phone ? html`<a href="tel:${o.phone}">${o.phone}</a>` : html`<span class="muted">none given</span>`}</dd>
      <dt>Ship to</dt><dd class="pre">${o.address}</dd>
      <dt>Notes</dt><dd>${o.notes ? paragraphs(o.notes) : html`<span class="muted">none</span>`}</dd>
      <dt>News by email</dt><dd>${o.newsletter ? 'Yes, add them to the list' : 'No'}</dd>
    </dl>
    <p class="row"><a class="btn" href="mailto:${o.email}?subject=${raw(replySubject)}&body=${raw(replyBody)}">Email ${first} about payment</a></p>
    <form method="post" action="/hq/orders/${o.id}" class="hq-form">
      <input type="hidden" name="csrf" value="${sess.csrf}">
      <fieldset><legend>Where is this order?</legend>
        <div class="radios">${ORDER_STATUSES.map((x) => html`<label class="check"><input type="radio" name="status" value="${x.key}" ${x.key === o.status ? raw('checked') : ''}> ${x.label}</label>`)}</div>
        <label>Team notes <small>Only visible here. Tracking number, how they paid, anything.</small><textarea name="staff_notes" rows="4">${o.staff_notes}</textarea></label>
      </fieldset>
      <button class="btn">Save</button>
    </form>`,
    sess,
    await counts(c.env.DB),
  );
});

hq.post('/hq/orders/:id', async (c) => {
  const g = await guardedPost(c);
  if (g instanceof Response) return g;
  const status = ORDER_STATUSES.some((x) => x.key === g.f.status) ? g.f.status : 'new';
  await c.env.DB.prepare("UPDATE orders SET status=?, staff_notes=?, updated_at=datetime('now') WHERE id=?").bind(status, (g.f.staff_notes || '').trim().slice(0, 4000), c.params.id).run();
  await db.audit(c.env.DB, g.sess.staff.name, 'updated order', `#${c.params.id} ${status}`);
  return redirect(`/hq/orders/${c.params.id}?ok=` + encodeURIComponent(`Saved. Order is ${statusLabel(status).toLowerCase()}.`), 303);
});

// ---------- messages ----------

function messagesTable(list: db.Message[]): Safe {
  if (!list.length) return html`<p class="muted">No messages yet. When someone uses the contact form, it shows up here.</p>`;
  return html`<table class="table">
    <thead><tr><th>When</th><th>From</th><th>About</th><th></th></tr></thead>
    <tbody>${list.map(
      (m) => html`<tr class="${m.read_at ? '' : 'unread'}">
        <td><a href="/hq/messages/${m.id}">${m.created_at.slice(0, 16).replace('T', ' ')}</a></td>
        <td>${m.name}<br><span class="muted">${m.email}</span></td>
        <td>${m.subject}<br><span class="muted">${m.body.slice(0, 90)}${m.body.length > 90 ? '…' : ''}</span></td>
        <td>${m.read_at ? '' : html`<b class="pill">new</b>`}</td>
      </tr>`,
    )}</tbody></table>`;
}

hq.get('/hq/messages', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const archived = c.url.searchParams.get('archived') === '1';
  const list = await c.env.DB.prepare(`SELECT * FROM messages WHERE archived_at IS ${archived ? 'NOT' : ''} NULL ORDER BY created_at DESC LIMIT 200`).all<db.Message>().then((r) => r.results);
  return shell(
    c,
    archived ? 'Archived messages' : 'Messages',
    html`<p class="tabs"><a href="/hq/messages" ${archived ? '' : raw('aria-current="page"')}>Inbox</a> <a href="/hq/messages?archived=1" ${archived ? raw('aria-current="page"') : ''}>Archived</a></p>${messagesTable(list)}`,
    sess,
    await counts(c.env.DB),
  );
});

hq.get('/hq/messages/:id', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const m = await c.env.DB.prepare('SELECT * FROM messages WHERE id=?').bind(c.params.id).first<db.Message>();
  if (!m) return text('Not found', 404);
  if (!m.read_at) await c.env.DB.prepare("UPDATE messages SET read_at=datetime('now') WHERE id=?").bind(m.id).run();
  const replySubject = encodeURIComponent(`Re: ${m.subject}`);
  const replyBody = encodeURIComponent(`Hi ${m.name.split(' ')[0]},\n\nThanks for writing to us.\n\n\n\nIt's Coffee Time!\nThe Coffee Time team\n`);
  return shell(
    c,
    `Message from ${m.name}`,
    html`<p class="crumb"><a href="/hq/messages">All messages</a></p>
    <dl class="kv">
      <dt>Received</dt><dd>${m.created_at} (UTC)</dd>
      <dt>Email</dt><dd><a href="mailto:${m.email}">${m.email}</a></dd>
      <dt>Phone</dt><dd>${m.phone ? html`<a href="tel:${m.phone}">${m.phone}</a>` : html`<span class="muted">none given</span>`}</dd>
      <dt>About</dt><dd>${m.subject}</dd>
    </dl>
    <div class="message-body">${paragraphs(m.body)}</div>
    <div class="row">
      <a class="btn" href="mailto:${m.email}?subject=${raw(replySubject)}&body=${raw(replyBody)}">Reply by email</a>
      <form method="post" action="/hq/messages/${m.id}/archive"><input type="hidden" name="csrf" value="${sess.csrf}"><button class="btn btn-quiet">${m.archived_at ? 'Move back to inbox' : 'Archive'}</button></form>
      <form method="post" action="/hq/messages/${m.id}/unread"><input type="hidden" name="csrf" value="${sess.csrf}"><button class="link">Mark as unread</button></form>
    </div>`,
    sess,
    await counts(c.env.DB),
  );
});

hq.post('/hq/messages/:id/archive', async (c) => {
  const g = await guardedPost(c);
  if (g instanceof Response) return g;
  await c.env.DB.prepare("UPDATE messages SET archived_at = CASE WHEN archived_at IS NULL THEN datetime('now') ELSE NULL END WHERE id=?").bind(c.params.id).run();
  return redirect('/hq/messages', 303);
});

hq.post('/hq/messages/:id/unread', async (c) => {
  const g = await guardedPost(c);
  if (g instanceof Response) return g;
  await c.env.DB.prepare('UPDATE messages SET read_at = NULL WHERE id=?').bind(c.params.id).run();
  return redirect('/hq/messages', 303);
});

// ---------- game details (settings shown across the site) ----------

const DETAIL_FIELDS: { key: string; label: string; help?: string; wide?: boolean; type?: 'check' }[] = [
  { key: 'orders_open', label: 'Order form is open', help: 'Untick while you are out of stock. The order page then says orders are paused.', type: 'check', wide: true },
  { key: 'price', label: 'Price (USD, numbers only)', help: 'Shown on every page, for example 39.99' },
  { key: 'edition', label: 'Edition', help: 'Shown next to the price.' },
  { key: 'max_quantity', label: 'Most games in one order request' },
  { key: 'players', label: 'Players', help: 'For example: 2 to 6' },
  { key: 'ages', label: 'Ages', help: 'For example: 8+' },
  { key: 'play_time', label: 'Play time', help: 'For example: 60 min' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'email', label: 'Public email address' },
  { key: 'facebook', label: 'Facebook page URL' },
  { key: 'demo_url', label: 'Video game demo URL', wide: true },
  { key: 'soundcloud', label: 'SoundCloud artist URL', wide: true },
  { key: 'charity_name', label: 'Charity name' },
  { key: 'charity_percent', label: 'Percent of each sale to charity' },
  { key: 'charity_url', label: 'Charity website', wide: true },
  { key: 'rules_pdf', label: 'Rulebook PDF link', help: 'A /files/... path once the PDF is uploaded to the site, or a full URL.', wide: true },
  { key: 'story_pdf', label: 'Story PDF link', wide: true },
  { key: 'coloring_pdf', label: 'Coloring page PDF link', wide: true },
];

hq.get('/hq/details', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const s = await db.getSettings(c.env.DB);
  return shell(
    c,
    'Game details',
    html`<p class="muted">These appear across the whole site. Save and the live site changes within a minute.</p>
    <form method="post" action="/hq/details" class="hq-form grid2">
      <input type="hidden" name="csrf" value="${sess.csrf}">
      ${DETAIL_FIELDS.map((f) =>
        f.type === 'check'
          ? html`<label class="check wide"><input type="checkbox" name="${f.key}" value="1" ${s[f.key] !== '0' ? raw('checked') : ''}> ${f.label}${f.help ? html` <small>${f.help}</small>` : ''}</label>`
          : html`<label class="${f.wide ? 'wide' : ''}">${f.label}${f.help ? html`<small>${f.help}</small>` : ''}<input name="${f.key}" value="${s[f.key] || ''}"></label>`,
      )}
      <div class="wide"><button class="btn">Save game details</button></div>
    </form>`,
    sess,
    await counts(c.env.DB),
  );
});

hq.post('/hq/details', async (c) => {
  const g = await guardedPost(c);
  if (g instanceof Response) return g;
  const changed: string[] = [];
  const before = await db.getSettings(c.env.DB);
  for (const f of DETAIL_FIELDS) {
    if (f.type !== 'check' && !(f.key in g.f)) continue;
    let v = f.type === 'check' ? (g.f[f.key] ? '1' : '0') : (g.f[f.key] ?? '').trim();
    if (f.key === 'price') v = v.replace(/[^0-9.]/g, '') || before.price;
    if (f.key === 'max_quantity' || f.key === 'charity_percent') v = String(parseInt(v, 10) || parseInt(before[f.key] || '1', 10));
    if (v !== (before[f.key] ?? '')) {
      await db.setSetting(c.env.DB, f.key, v);
      changed.push(f.label);
    }
  }
  if (changed.length) await db.audit(c.env.DB, g.sess.staff.name, 'edited game details', changed.join(', '));
  return redirect('/hq/details?ok=' + encodeURIComponent(changed.length ? `Saved: ${changed.join(', ')}.` : 'Nothing changed.'), 303);
});

// ---------- page copy blocks ----------

const PAGE_NAMES: Record<string, string> = { home: 'Home page', order: 'Order page', worlds: 'Five Worlds page', 'video-game': 'Video game page', music: 'Music page', 'how-to-play': 'How to play page', community: 'Community page', contact: 'Contact page' };

hq.get('/hq/pages', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const blocks = Object.values(await db.getBlocks(c.env.DB));
  const pages = [...new Set(blocks.map((x) => x.page))];
  return shell(
    c,
    'Page copy',
    html`<p class="muted">The words on each page. Leave a blank line between paragraphs. Start lines with a dash and a space to make a list. Wrap a few words in **double stars** to make them bold.</p>
    <form method="post" action="/hq/pages" class="hq-form">
      <input type="hidden" name="csrf" value="${sess.csrf}">
      ${pages.map(
        (pg) => html`<fieldset><legend>${PAGE_NAMES[pg] || pg}</legend>
        ${blocks
          .filter((x) => x.page === pg)
          .map((x) => html`<label>${x.label}${x.kind === 'line' ? html`<input name="b:${x.key}" value="${x.value}">` : html`<textarea name="b:${x.key}" rows="${Math.min(14, Math.max(3, Math.ceil(x.value.length / 90) + 1))}">${x.value}</textarea>`}</label>`)}
        </fieldset>`,
      )}
      <button class="btn">Save page copy</button>
    </form>`,
    sess,
    await counts(c.env.DB),
  );
});

hq.post('/hq/pages', async (c) => {
  const g = await guardedPost(c);
  if (g instanceof Response) return g;
  const before = await db.getBlocks(c.env.DB);
  const changed: string[] = [];
  for (const [k, v] of Object.entries(g.f)) {
    if (!k.startsWith('b:')) continue;
    const key = k.slice(2);
    if (!before[key]) continue;
    const val = v.replace(/\r\n/g, '\n').trim();
    if (val !== before[key].value) {
      await db.setBlock(c.env.DB, key, val);
      changed.push(before[key].label);
    }
  }
  if (changed.length) await db.audit(c.env.DB, g.sess.staff.name, 'edited page copy', changed.join(', '));
  return redirect('/hq/pages?ok=' + encodeURIComponent(changed.length ? `Saved: ${changed.join(', ')}.` : 'Nothing changed.'), 303);
});

// ---------- generic list editors (worlds, characters, lessons, FAQ, reviews, news, music, games) ----------

type Field = { key: string; label: string; type?: 'text' | 'textarea' | 'select' | 'url' | 'check' | 'number' | 'color'; options?: { v: string; l: string }[]; help?: string };
type ListDef = { table: 'worlds' | 'characters' | 'reviews' | 'news' | 'faqs' | 'lessons' | 'tracks' | 'games'; path: string; title: string; one: string; fields: Field[]; summary: (r: Record<string, unknown>) => string; order: string; note?: string };

const IMAGE_HELP = 'Path of an image already on the site, like /img/king-tea.webp. To add new pictures, send them to Smartz Graphics.';
const ORDER: Field = { key: 'sort', label: 'Order', type: 'number', help: 'Lower numbers come first.' };
const SHOWN: Field = { key: 'published', label: 'Shown on the site', type: 'check' };
const TEXT_HELP = 'Blank line between paragraphs. Lines starting with "- " become a list. **double stars** for bold.';

const LISTS: ListDef[] = [
  {
    table: 'worlds', path: '/hq/worlds', title: 'Worlds', one: 'world', order: 'sort, id',
    note: 'The order matters: King Tea travels through the worlds in this order, and the home page clocks follow it.',
    summary: (r) => `${r.sort}. ${r.name}`,
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'slug', label: 'Web address', help: 'Lowercase, hyphens, no spaces. Used in links like /worlds#coffee-world.' },
      { key: 'tagline', label: 'One-line tagline' },
      { key: 'body', label: 'Description', type: 'textarea', help: TEXT_HELP },
      { key: 'who', label: 'Who you meet here' },
      { key: 'color', label: 'World color', type: 'color' },
      { key: 'image', label: 'Character picture', help: IMAGE_HELP },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'characters', path: '/hq/characters', title: 'Characters', one: 'character', order: 'side, sort, id',
    summary: (r) => `${r.side === 'villain' ? 'Villain' : 'Hero'}: ${r.name}`,
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'side', label: 'Side', type: 'select', options: [{ v: 'hero', l: 'Coffee hero' }, { v: 'villain', l: 'Villain' }] },
      { key: 'power', label: 'What they do (one or two sentences)', type: 'textarea' },
      { key: 'image', label: 'Picture', help: IMAGE_HELP },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'lessons', path: '/hq/lessons', title: 'How to play', one: 'lesson', order: 'sort, id',
    note: 'Lessons are grouped by chapter, in this order. Chapter names must match exactly to sit together.',
    summary: (r) => `${r.chapter} / ${r.num}. ${r.title}`,
    fields: [
      { key: 'title', label: 'Lesson title' },
      { key: 'chapter', label: 'Chapter' },
      { key: 'num', label: 'Lesson number', help: 'As printed in the rulebook, like 7 or 20A.' },
      { key: 'body', label: 'The rule', type: 'textarea', help: TEXT_HELP },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'faqs', path: '/hq/faqs', title: 'Rules FAQ', one: 'question', order: 'sort, id',
    summary: (r) => String(r.question),
    fields: [{ key: 'question', label: 'Question' }, { key: 'answer', label: 'Answer', type: 'textarea', help: TEXT_HELP }, ORDER, SHOWN],
  },
  {
    table: 'reviews', path: '/hq/reviews', title: 'Reviews', one: 'review', order: 'sort, id',
    summary: (r) => `${r.featured ? '[home] ' : ''}${r.name}: ${String(r.quote).slice(0, 60)}`,
    fields: [
      { key: 'quote', label: 'What they said', type: 'textarea' },
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Who they are', help: 'Playtester, San Diego Comic-Con, Bought the game...' },
      { key: 'featured', label: 'Show on the home page (the first three ticked are used)', type: 'check' },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'news', path: '/hq/news', title: 'News', one: 'news item', order: 'sort, id',
    note: 'Newest first: give new items a lower order number than the rest (0, or negative numbers are fine).',
    summary: (r) => `${r.date_label}: ${r.title}`,
    fields: [
      { key: 'title', label: 'Headline' },
      { key: 'date_label', label: 'When', help: 'Shown as written, like "March 2023" or "2026".' },
      { key: 'body', label: 'Story', type: 'textarea', help: TEXT_HELP },
      { key: 'image', label: 'Picture', help: IMAGE_HELP },
      { key: 'image_alt', label: 'Describe the picture', help: 'For people using screen readers.' },
      { key: 'url', label: 'Link', type: 'url' },
      { key: 'link_label', label: 'Link text', help: 'For example "Watch the interview".' },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'tracks', path: '/hq/tracks', title: 'Music', one: 'track', order: 'archive, sort, id',
    summary: (r) => `${r.archive ? '[archive] ' : ''}${r.title}`,
    fields: [
      { key: 'title', label: 'Track title' },
      { key: 'world', label: 'World or label', help: 'Shown under the title, like "Tea World" or "Battle theme".' },
      { key: 'url', label: 'SoundCloud page', type: 'url' },
      { key: 'soundcloud_id', label: 'SoundCloud track number', help: 'Lets the track play right on the page. On SoundCloud: Share, Embed, then the number after tracks%2F or tracks/. Leave blank for a link only.' },
      { key: 'image', label: 'Picture', help: IMAGE_HELP },
      { key: 'archive', label: 'Put in "From the first website" (link only)', type: 'check' },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'games', path: '/hq/games', title: 'Games', one: 'game', order: 'sort, id',
    note: 'The first game is Coffee Time Adventures itself. The rest appear as quick games on the video game page.',
    summary: (r) => String(r.title),
    fields: [
      { key: 'title', label: 'Game' },
      { key: 'blurb', label: 'One-line description', type: 'textarea' },
      { key: 'platform', label: 'Where it plays', help: 'For example "Plays in your browser, free".' },
      { key: 'url', label: 'Link', type: 'url' },
      { key: 'image', label: 'Screenshot', help: IMAGE_HELP },
      ORDER, SHOWN,
    ],
  },
];

function fieldInput(f: Field, v: unknown): Safe {
  const val = v === null || v === undefined ? '' : String(v);
  switch (f.type) {
    case 'textarea':
      return html`<textarea name="${f.key}" rows="${['body', 'answer'].includes(f.key) ? 10 : 3}">${val}</textarea>`;
    case 'select':
      return html`<select name="${f.key}">${(f.options || []).map((o) => html`<option value="${o.v}" ${o.v === val ? raw('selected') : ''}>${o.l}</option>`)}</select>`;
    case 'check':
      return html`<input type="checkbox" name="${f.key}" value="1" ${val === '1' || val === 'true' ? raw('checked') : ''}>`;
    case 'number':
      return html`<input type="number" name="${f.key}" value="${val || '0'}">`;
    case 'color':
      return html`<input type="color" name="${f.key}" value="${/^#[0-9a-f]{6}$/i.test(val) ? val : '#9c44c8'}">`;
    default:
      return html`<input type="${f.type === 'url' ? 'url' : 'text'}" name="${f.key}" value="${val}">`;
  }
}

for (const L of LISTS) {
  hq.get(L.path, async (c) => {
    const sess = await requireSession(c);
    if (sess instanceof Response) return sess;
    const rows = await c.env.DB.prepare(`SELECT * FROM ${L.table} ORDER BY ${L.order}`).all<Record<string, unknown>>().then((r) => r.results);
    return shell(
      c,
      L.title,
      html`${L.note ? html`<p class="muted">${L.note}</p>` : ''}<p class="row"><a class="btn" href="${L.path}/new">Add a ${L.one}</a></p>
      <table class="table"><tbody>${rows.map(
        (r) => html`<tr class="${r.published ? '' : 'muted'}"><td><a href="${L.path}/${String(r.id)}">${L.summary(r)}</a></td><td>${r.published ? '' : 'hidden'}</td></tr>`,
      )}</tbody></table>`,
      sess,
      await counts(c.env.DB),
    );
  });

  hq.get(`${L.path}/:id`, async (c) => {
    const sess = await requireSession(c);
    if (sess instanceof Response) return sess;
    const isNew = c.params.id === 'new';
    const row = isNew ? { published: 1, sort: 0 } : await c.env.DB.prepare(`SELECT * FROM ${L.table} WHERE id=?`).bind(c.params.id).first<Record<string, unknown>>();
    if (!row) return text('Not found', 404);
    return shell(
      c,
      isNew ? `New ${L.one}` : `Edit ${L.one}`,
      html`<p class="crumb"><a href="${L.path}">${L.title}</a></p>
      <form method="post" action="${L.path}/${c.params.id}" class="hq-form">
        <input type="hidden" name="csrf" value="${sess.csrf}">
        ${L.fields.map((f) => html`<label class="${f.type === 'check' ? 'check' : ''}">${f.type === 'check' ? html`${fieldInput(f, row[f.key])} ${f.label}` : html`${f.label}${f.help ? html`<small>${f.help}</small>` : ''}${fieldInput(f, row[f.key])}`}</label>`)}
        <div class="row"><button class="btn">${isNew ? 'Add' : 'Save'}</button>
        ${isNew ? '' : html`<button class="link danger" name="_delete" value="1" formnovalidate>Delete this ${L.one}</button>`}</div>
      </form>`,
      sess,
      await counts(c.env.DB),
    );
  });

  hq.post(`${L.path}/:id`, async (c) => {
    const g = await guardedPost(c);
    if (g instanceof Response) return g;
    const isNew = c.params.id === 'new';
    if (!isNew && g.f._delete) {
      await c.env.DB.prepare(`DELETE FROM ${L.table} WHERE id=?`).bind(c.params.id).run();
      await db.audit(c.env.DB, g.sess.staff.name, `deleted ${L.one}`, `#${c.params.id}`);
      return redirect(`${L.path}?ok=` + encodeURIComponent('Deleted.'), 303);
    }
    const cols: string[] = [];
    const vals: unknown[] = [];
    for (const f of L.fields) {
      let v: unknown = (g.f[f.key] ?? '').trim();
      if (f.type === 'check') v = g.f[f.key] ? 1 : 0;
      if (f.type === 'number') v = parseInt(String(v), 10) || 0;
      if (f.key === 'slug') v = String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (f.type === 'color' && !/^#[0-9a-f]{6}$/i.test(String(v))) v = '#9c44c8';
      cols.push(f.key);
      vals.push(v);
    }
    const required = L.fields[0].key;
    if (!String(g.f[required] || '').trim()) return text(`${L.fields[0].label} is required.`, 400);
    if (isNew) {
      await c.env.DB.prepare(`INSERT INTO ${L.table}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`).bind(...vals).run();
    } else {
      await c.env.DB.prepare(`UPDATE ${L.table} SET ${cols.map((k) => `${k}=?`).join(',')} WHERE id=?`).bind(...vals, c.params.id).run();
    }
    await db.audit(c.env.DB, g.sess.staff.name, `${isNew ? 'added' : 'edited'} ${L.one}`, String(g.f[required]).slice(0, 80));
    return redirect(`${L.path}?ok=` + encodeURIComponent('Saved.'), 303);
  });
}

// ---------- settings ----------

hq.get('/hq/settings', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const s = await db.getSettings(c.env.DB);
  const staff = await c.env.DB.prepare('SELECT id,name,role,created_at,last_login_at FROM staff ORDER BY id').all<db.Staff>().then((r) => r.results);
  return shell(
    c,
    'Settings',
    html`<form method="post" action="/hq/settings" class="hq-form">
      <input type="hidden" name="csrf" value="${sess.csrf}">
      <fieldset><legend>Search engines</legend>
        <label class="check"><input type="checkbox" name="site_indexable" value="1" ${s.site_indexable === '1' ? raw('checked') : ''}> Let search engines index the site <small>Keep this off until playcoffeetime.com points at the new site, then turn it on once.</small></label>
      </fieldset>
      <fieldset><legend>Notifications</legend>
        <label class="check"><input type="checkbox" name="notify_enabled" value="1" ${s.notify_enabled === '1' ? raw('checked') : ''}> Email us when an order or message arrives</label>
        <label>Send notifications to <input name="notify_email" type="email" value="${s.notify_email || ''}"></label>
        <p class="muted small">${c.env.RESEND_API_KEY && c.env.MAIL_FROM ? 'Email sending is configured.' : 'Email sending is not configured yet, so orders and messages only appear in HQ. The site maintainer can turn it on by setting RESEND_API_KEY and MAIL_FROM.'}</p>
      </fieldset>
      <fieldset><legend>Search listing</legend>
        <label>Site description <small>What Google shows under the site name. About 150 characters.</small><textarea name="seo_description" rows="3">${s.seo_description || ''}</textarea></label>
      </fieldset>
      <button class="btn">Save settings</button>
    </form>
    <h2>Staff</h2>
    <table class="table"><tbody>${staff.map((x) => html`<tr><td>${x.name}</td><td>${x.role}</td><td class="muted">last login ${x.last_login_at || 'never'}</td></tr>`)}</tbody></table>
    <form method="post" action="/hq/staff" class="hq-form grid2">
      <input type="hidden" name="csrf" value="${sess.csrf}">
      <label>Add a staff member <input name="name" placeholder="First name" required></label>
      <label>Password <input name="password" type="password" minlength="12" required autocomplete="new-password"></label>
      <div class="wide"><button class="btn btn-quiet">Add</button></div>
    </form>
    <h2>Change your password</h2>
    <form method="post" action="/hq/password" class="hq-form grid2">
      <input type="hidden" name="csrf" value="${sess.csrf}">
      <label>Current password <input name="current" type="password" required autocomplete="current-password"></label>
      <label>New password <input name="password" type="password" minlength="12" required autocomplete="new-password"></label>
      <div class="wide"><button class="btn btn-quiet">Change password</button></div>
    </form>`,
    sess,
    await counts(c.env.DB),
  );
});

hq.post('/hq/settings', async (c) => {
  const g = await guardedPost(c);
  if (g instanceof Response) return g;
  await db.setSetting(c.env.DB, 'site_indexable', g.f.site_indexable ? '1' : '0');
  await db.setSetting(c.env.DB, 'notify_enabled', g.f.notify_enabled ? '1' : '0');
  await db.setSetting(c.env.DB, 'notify_email', (g.f.notify_email || '').trim());
  await db.setSetting(c.env.DB, 'seo_description', (g.f.seo_description || '').trim());
  await db.audit(c.env.DB, g.sess.staff.name, 'edited settings', `indexable=${g.f.site_indexable ? 1 : 0}`);
  return redirect('/hq/settings?ok=' + encodeURIComponent('Settings saved.'), 303);
});

hq.post('/hq/staff', async (c) => {
  const g = await guardedPost(c);
  if (g instanceof Response) return g;
  const name = (g.f.name || '').trim();
  if (!name || (g.f.password || '').length < 12) return text('Name and a 12+ character password are required.', 400);
  await c.env.DB.prepare('INSERT INTO staff(name,pass_hash,role) VALUES(?,?,?)').bind(name, await hashPassword(g.f.password), 'admin').run();
  await db.audit(c.env.DB, g.sess.staff.name, 'added staff', name);
  return redirect('/hq/settings?ok=' + encodeURIComponent(`${name} can now log in.`), 303);
});

hq.post('/hq/password', async (c) => {
  const g = await guardedPost(c);
  if (g instanceof Response) return g;
  if (!(await verifyPassword(g.f.current || '', g.sess.staff.pass_hash))) return redirect('/hq/settings?ok=' + encodeURIComponent('Current password was wrong; nothing changed.'), 303);
  if ((g.f.password || '').length < 12) return text('New password must be 12+ characters.', 400);
  await c.env.DB.prepare('UPDATE staff SET pass_hash=? WHERE id=?').bind(await hashPassword(g.f.password), g.sess.staff.id).run();
  await db.audit(c.env.DB, g.sess.staff.name, 'changed password');
  return redirect('/hq/settings?ok=' + encodeURIComponent('Password changed.'), 303);
});

