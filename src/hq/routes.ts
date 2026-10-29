// HQ: the staff backend at /hq. Server-rendered forms, no JavaScript required.
import { Router, page, redirect, formData, text, type Ctx } from '../lib/router.ts';
import { html, raw, paragraphs, inline, type Child, type Safe } from '../lib/html.ts';
import * as db from '../lib/db.ts';
import { currentSession, startSession, endSession, hashPassword, verifyPassword, staffCount, type Session } from '../lib/auth.ts';
import { shell, requireSession, guardedPost, navCounts } from './shell.ts';
import { ORDER_STATUSES } from '../lib/db.ts';
import { mountBoard } from './board.ts';
import { mountReview } from './review.ts';
import { CHANGELOG } from '../db/bundled.ts';

export const hq = new Router();
mountBoard(hq);
mountReview(hq);

type Counts = { newOrders: number };
async function counts(d: D1Database): Promise<Counts> {
  const r = await d.prepare("SELECT COUNT(*) AS newOrders FROM orders WHERE status='new'").first<Counts>();
  return { newOrders: r?.newOrders ?? 0 };
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
  const headers = new Headers({ location: '/hq' });
  for (const k of await endSession(c)) headers.append('set-cookie', k);
  return new Response(null, { status: 303, headers });
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
  const [n, recentOrders, subs, s, outbox, lastEdit, sold] = await Promise.all([
    counts(c.env.DB),
    c.env.DB.prepare("SELECT * FROM orders WHERE status IN ('new','contacted','paid') ORDER BY created_at DESC LIMIT 8").all<db.Order>().then((r) => r.results),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE unsubscribed_at IS NULL').first<{ n: number }>(),
    db.getSettings(c.env.DB),
    c.env.DB.prepare('SELECT status, COUNT(*) n FROM outbox GROUP BY status').all<{ status: string; n: number }>().then((r) => r.results),
    c.env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 8').all<{ who: string; what: string; detail: string; created_at: string }>().then((r) => r.results),
    c.env.DB.prepare("SELECT COALESCE(SUM(quantity),0) AS q FROM orders WHERE status IN ('paid','shipped')").first<{ q: number }>(),
  ]);
  const live = s.site_indexable === '1';
  const lastRun = s.watchdog_last_run ? Date.parse(s.watchdog_last_run.replace(' ', 'T') + (s.watchdog_last_run.endsWith('Z') ? '' : 'Z')) : 0;
  const silent = !lastRun || Date.now() - lastRun > 3 * 3600 * 1000;
  let stale: { id: number; title: string; hours: number }[] = [];
  try { stale = JSON.parse(s.watchdog_stale || '[]'); } catch { /* ignore */ }
  const nav = await navCounts(c.env.DB, sess.staff.name);
  const mail = !!(c.env.RESEND_API_KEY && c.env.MAIL_FROM);
  return shell(
    c,
    'Dashboard',
    html`
    ${stale.length ? html`<div class="flash flash-err"><b>${stale.length} ${stale.length === 1 ? 'request has' : 'requests have'} been waiting over 3 hours with no reply:</b> ${stale.map((r) => html`<a href="/hq/requests/${r.id}">#${r.id} ${r.title}</a> `)}</div>` : ''}
    ${silent && live ? html`<div class="flash flash-err">The hourly watchdog has not reported in. Requests could be sitting unseen.</div>` : ''}
    <div class="cards">
      <a class="card ${nav['/hq/requests'].fresh ? 'card-hot' : ''}" href="/hq/requests"><b>${nav['/hq/requests'].fresh}</b><span>requests nobody has picked up (${nav['/hq/requests'].total} open)</span></a>
      <a class="card ${nav['/hq/punchlist'].fresh ? 'card-hot' : ''}" href="/hq/punchlist"><b>${nav['/hq/punchlist'].total}</b><span>punch list items left${nav['/hq/punchlist'].fresh ? ` (${nav['/hq/punchlist'].fresh} yours)` : ''}</span></a>
      <a class="card ${n.newOrders ? 'card-hot' : ''}" href="/hq/orders"><b>${n.newOrders}</b><span>${n.newOrders === 1 ? 'new order request' : 'new order requests'}</span></a>
      <a class="card" href="/hq/subscribers"><b>${subs?.n ?? 0}</b><span>newsletter sign-ups</span></a>
      <div class="card"><b>${sold?.q ?? 0}</b><span>games paid or shipped through the website</span></div>
      <a class="card" href="/hq/settings"><b>${live ? 'Live' : 'Hidden'}</b><span>${live ? 'Search engines may index the site' : 'Search engines are told to stay away'}</span></a>
      <a class="card" href="/hq/details"><b>${s.orders_open === '0' ? 'Paused' : 'Open'}</b><span>Order form</span></a>
      <div class="card"><b>${mail ? 'On' : 'Off'}</b><span>Email alerts ${mail ? `to ${c.env.NOTIFY_TO || s.notify_email}` : '(orders and sign-ups still land here)'}</span></div>
    </div>
    <h2>Orders to handle</h2>
    ${ordersTable(recentOrders)}
    <h2>Recent changes</h2>
    <ul class="log">${lastEdit.map((l) => html`<li><time>${l.created_at}</time> ${l.who} ${l.what}${l.detail ? html`: <span class="muted">${l.detail}</span>` : ''}</li>`)}</ul>
    <p class="muted small">Outbox: ${outbox.map((o) => `${o.n} ${o.status}`).join(', ') || 'empty'}.</p>`,
    sess,
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

// ---------- newsletter sign-ups ----------

hq.get('/hq/subscribers', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const list = await c.env.DB.prepare('SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 2000').all<db.Subscriber>().then((r) => r.results);
  const active = list.filter((x) => !x.unsubscribed_at);
  return shell(
    c,
    'Newsletter sign-ups',
    html`<p class="muted">${active.length} ${active.length === 1 ? 'address' : 'addresses'}. Sign-ups come from the home page form and the order form. <a href="/hq/subscribers.csv">Download as CSV</a> to paste into your mailing tool.</p>
    ${list.length ? html`<table class="table"><thead><tr><th>Email</th><th>From</th><th>When</th><th></th></tr></thead><tbody>${list.map(
      (x) => html`<tr class="${x.unsubscribed_at ? 'muted' : ''}"><td>${x.email}</td><td>${x.source}</td><td>${x.created_at.slice(0, 16)}</td>
        <td><form method="post" action="/hq/subscribers/${x.id}/toggle"><input type="hidden" name="csrf" value="${sess.csrf}"><button class="link">${x.unsubscribed_at ? 'Re-subscribe' : 'Unsubscribe'}</button></form></td></tr>`,
    )}</tbody></table>` : html`<p class="muted">Nobody has signed up yet.</p>`}`,
    sess,
  );
});

hq.get('/hq/subscribers.csv', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const list = await c.env.DB.prepare('SELECT email, source, created_at FROM subscribers WHERE unsubscribed_at IS NULL ORDER BY created_at').all<db.Subscriber>().then((r) => r.results);
  const csv = 'email,source,signed_up\n' + list.map((x) => `${x.email.replace(/[",\n]/g, '')},${x.source},${x.created_at}`).join('\n') + '\n';
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="coffee-time-newsletter.csv"' } });
});

hq.post('/hq/subscribers/:id/toggle', async (c) => {
  const g = await guardedPost(c);
  if (g instanceof Response) return g;
  await c.env.DB.prepare("UPDATE subscribers SET unsubscribed_at = CASE WHEN unsubscribed_at IS NULL THEN datetime('now') ELSE NULL END WHERE id=?").bind(c.params.id).run();
  await db.audit(c.env.DB, g.sess.staff.name, 'toggled subscriber', `#${c.params.id}`);
  return redirect('/hq/subscribers', 303);
});

// ---------- game details (settings shown across the site) ----------

const DETAIL_FIELDS: { key: string; label: string; help?: string; wide?: boolean; type?: 'check' }[] = [
  { key: 'orders_open', label: 'Order form is open', help: 'Untick while you are out of stock. The form then says orders are paused.', type: 'check', wide: true },
  { key: 'price', label: 'Price (USD, numbers only)', help: 'Used by the order form, for example 39.99. The price in the Orders paragraph is edited under Page copy.' },
  { key: 'max_quantity', label: 'Most games in one order request' },
  { key: 'players', label: 'Players badge', help: 'For example: 2-6 Players' },
  { key: 'ages', label: 'Ages badge', help: 'For example: Ages 8+' },
  { key: 'email', label: 'Public email address' },
  { key: 'facebook', label: 'Facebook page URL', wide: true },
  { key: 'demo_url', label: 'Video game demo URL (itch.io)', wide: true },
  { key: 'hmp_url', label: 'HMP Bikes website', wide: true },
  { key: 'charity_url', label: 'Purple Tree Café website', wide: true },
  { key: 'rules_pdf', label: 'Instructions PDF', help: 'A /files/... path on this site, or a full URL.', wide: true },
  { key: 'story_pdf', label: 'Story PDF', wide: true },
  { key: 'coloring_pdf', label: 'Coloring page PDF', wide: true },
  { key: 'trailer_video', label: 'Trailer video', help: 'A /video/... path on this site.', wide: true },
  { key: 'trailer_poster', label: 'Trailer poster image', help: 'Shown before the video plays.', wide: true },
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
    if (f.key === 'max_quantity') v = String(parseInt(v, 10) || parseInt(before[f.key] || '1', 10));
    if (v !== (before[f.key] ?? '')) {
      await db.setSetting(c.env.DB, f.key, v);
      changed.push(f.label);
    }
  }
  if (changed.length) await db.audit(c.env.DB, g.sess.staff.name, 'edited game details', changed.join(', '));
  return redirect('/hq/details?ok=' + encodeURIComponent(changed.length ? `Saved: ${changed.join(', ')}.` : 'Nothing changed.'), 303);
});

// ---------- page copy blocks ----------

const PAGE_NAMES: Record<string, string> = { home: 'Home page', story: 'Story page', arcade: 'Arcade page', news: 'News page', tutorials: 'Video tutorials page', faq: 'FAQ page' };

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

// ---------- generic list editors (reviews, news, tutorials, FAQ, music, arcade, team) ----------

type Field = { key: string; label: string; type?: 'text' | 'textarea' | 'select' | 'url' | 'check' | 'number'; options?: { v: string; l: string }[]; help?: string };
type ListDef = { table: 'reviews' | 'news' | 'faqs' | 'tutorials' | 'tracks' | 'games' | 'creators'; path: string; title: string; one: string; fields: Field[]; summary: (r: Record<string, unknown>) => string; order: string; note?: string };

const IMAGE_HELP = 'Path of an image already on the site, like /img/comic-con-2025-a.webp. To add new pictures, send them to Smartz Graphics.';
const ORDER: Field = { key: 'sort', label: 'Order', type: 'number', help: 'Lower numbers come first.' };
const SHOWN: Field = { key: 'published', label: 'Shown on the site', type: 'check' };
const TEXT_HELP = 'Blank line between paragraphs. Lines starting with "- " become a list. **double stars** for bold. [words](https://...) for a link.';

const LISTS: ListDef[] = [
  {
    table: 'reviews', path: '/hq/reviews', title: 'Reviews', one: 'review', order: 'sort, id',
    note: 'Shown on the home page in this order, newest at the bottom like the old site. Give a new review a higher number to add it at the end.',
    summary: (r) => `${r.name}: ${String(r.quote).slice(0, 60)}`,
    fields: [
      { key: 'quote', label: 'What they said', type: 'textarea' },
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Who they are', help: 'Playtester, San Diego Comic-Con, Game Purchaser...' },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'news', path: '/hq/news', title: 'News', one: 'news item', order: 'sort, id',
    note: 'Newest first: give a new item a lower order number than the rest (0 or a negative number is fine).',
    summary: (r) => `${r.date_label}: ${r.title}`,
    fields: [
      { key: 'title', label: 'Headline' },
      { key: 'date_label', label: 'When', help: 'Shown as written, like "March 2023" or "2026".' },
      { key: 'body', label: 'Story', type: 'textarea', help: TEXT_HELP },
      { key: 'images', label: 'Pictures', help: 'One or more image paths separated by commas. ' + IMAGE_HELP },
      { key: 'video', label: 'Video', help: 'A YouTube video id (the 11 characters after watch?v=) or a /video/... path on this site.' },
      { key: 'url', label: 'Link', type: 'url' },
      { key: 'link_label', label: 'Link button text', help: 'For example "Watch the interview".' },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'tutorials', path: '/hq/tutorials', title: 'Video tutorials', one: 'tutorial', order: 'sort, id',
    summary: (r) => `${r.num}. ${r.title}`,
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'num', label: 'Tutorial number', help: 'As on the page, like 7-c or 20-a.' },
      { key: 'body', label: 'Explanation', type: 'textarea', help: TEXT_HELP },
      { key: 'youtube_id', label: 'YouTube video id', help: 'The 11 characters after watch?v= in the video address.' },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'faqs', path: '/hq/faqs', title: 'FAQ', one: 'question', order: 'sort, id',
    summary: (r) => String(r.question),
    fields: [{ key: 'question', label: 'Question' }, { key: 'answer', label: 'Answer', type: 'textarea', help: TEXT_HELP }, ORDER, SHOWN],
  },
  {
    table: 'tracks', path: '/hq/tracks', title: 'Music', one: 'track', order: 'sort, id',
    note: 'Each track is a SoundCloud player, shown two across in this order.',
    summary: (r) => String(r.title),
    fields: [
      { key: 'title', label: 'Track title (shown under the player)' },
      { key: 'url', label: 'SoundCloud track page', type: 'url', help: 'Like https://soundcloud.com/user-565081345/wind-feather-theme' },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'games', path: '/hq/games', title: 'Arcade games', one: 'game', order: 'sort, id',
    note: 'The small games listed under the Coffee Time Adventures trailer on the Arcade page.',
    summary: (r) => String(r.title),
    fields: [
      { key: 'title', label: 'Game' },
      { key: 'blurb', label: 'One-line description', type: 'textarea' },
      { key: 'note', label: 'Small print', help: 'For example "For desktop only."' },
      { key: 'url', label: 'Link', type: 'url' },
      { key: 'button', label: 'Button text', help: 'For example "Play Rapid Refill Now!"' },
      { key: 'image', label: 'Screenshot', help: IMAGE_HELP },
      ORDER, SHOWN,
    ],
  },
  {
    table: 'creators', path: '/hq/creators', title: 'Meet the Creators', one: 'team member', order: 'sort, id',
    summary: (r) => `${r.name}, ${r.role}`,
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role', help: 'For example Game Designer.' },
      { key: 'place', label: 'Place', help: 'For example Davis, CA' },
      { key: 'bio', label: 'Bio', type: 'textarea', help: TEXT_HELP },
      { key: 'url', label: 'Website', type: 'url' },
      { key: 'image', label: 'Photo', help: IMAGE_HELP },
      ORDER, SHOWN,
    ],
  },
];

function fieldInput(f: Field, v: unknown): Safe {
  const val = v === null || v === undefined ? '' : String(v);
  switch (f.type) {
    case 'textarea':
      return html`<textarea name="${f.key}" rows="${['body', 'answer', 'bio'].includes(f.key) ? 10 : 3}">${val}</textarea>`;
    case 'select':
      return html`<select name="${f.key}">${(f.options || []).map((o) => html`<option value="${o.v}" ${o.v === val ? raw('selected') : ''}>${o.l}</option>`)}</select>`;
    case 'check':
      return html`<input type="checkbox" name="${f.key}" value="1" ${val === '1' || val === 'true' ? raw('checked') : ''}>`;
    case 'number':
      return html`<input type="number" name="${f.key}" value="${val || '0'}">`;
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
      <fieldset><legend>Google Analytics</legend>
        <label>Measurement ID <small>Looks like G-XXXXXXXXXX. Leave blank to turn analytics off.</small><input name="ga4_id" value="${s.ga4_id || ''}" placeholder="G-XXXXXXXXXX" pattern="G-[A-Za-z0-9]{4,20}"></label>
      </fieldset>
      <fieldset><legend>Notifications</legend>
        <label class="check"><input type="checkbox" name="notify_enabled" value="1" ${s.notify_enabled === '1' ? raw('checked') : ''}> Email us when an order or newsletter sign-up arrives</label>
        <label>Send notifications to <input name="notify_email" type="email" value="${s.notify_email || ''}"></label>
        <p class="muted small">${c.env.RESEND_API_KEY && c.env.MAIL_FROM ? 'Email sending is configured.' : 'Email sending is not configured yet, so orders and sign-ups only appear in HQ. The site maintainer can turn it on by setting RESEND_API_KEY and MAIL_FROM.'}</p>
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
  );
});

hq.post('/hq/settings', async (c) => {
  const g = await guardedPost(c);
  if (g instanceof Response) return g;
  await db.setSetting(c.env.DB, 'site_indexable', g.f.site_indexable ? '1' : '0');
  const ga4 = (g.f.ga4_id || '').trim().toUpperCase();
  await db.setSetting(c.env.DB, 'ga4_id', /^G-[A-Z0-9]{4,20}$/.test(ga4) ? ga4 : '');
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


// ---------- what's new / sent email ----------

hq.get('/hq/whats-new', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const out: Safe[] = [];
  let list: Safe[] = [];
  const flush = () => { if (list.length) out.push(html`<ul>${list}</ul>`); list = []; };
  for (const line of CHANGELOG.split('\n')) {
    if (line.startsWith('## ')) { flush(); out.push(html`<h2>${line.slice(3)}</h2>`); }
    else if (line.startsWith('- ')) list.push(html`<li>${raw(inline(line.slice(2)))}</li>`);
    else if (/^\s+\S/.test(line) && list.length) list[list.length - 1] = html`${list[list.length - 1]}${' ' + line.trim()}`;
  }
  flush();
  return shell(c, "What's new", html`<p class="muted">Every change to the website and HQ, newest first.</p><div class="rich">${out}</div>`, sess);
});

hq.get('/hq/outbox', async (c) => {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const rows = (await c.env.DB.prepare('SELECT * FROM outbox ORDER BY id DESC LIMIT 100').all<{ id: number; to_addr: string; subject: string; status: string; error: string | null; created_at: string }>()).results;
  return shell(c, 'Sent email', html`<p class="muted">Every email the site tried to send. "simulated" means email is not switched on yet, so it only landed here.</p>
  ${rows.length ? html`<table class="table"><thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th></tr></thead><tbody>${rows.map((r) => html`<tr><td class="nowrap"><time class="loc">${r.created_at}</time></td><td>${r.to_addr}</td><td>${r.subject}</td><td>${r.status}${r.error ? html` <span class="muted">${r.error}</span>` : ''}</td></tr>`)}</tbody></table>` : html`<p class="empty">Nothing sent yet.</p>`}`, sess);
});
