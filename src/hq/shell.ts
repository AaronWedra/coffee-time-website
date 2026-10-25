// The HQ page frame: grouped sidebar with counts, the Edit website button, the ? bubble.
// Same layout as the Zombie Bike Parade Festival HQ, in Coffee Time colours.
import { page, redirect, text, formData, type Ctx } from '../lib/router.ts';
import { html, raw, type Child } from '../lib/html.ts';
import { currentSession, type Session } from '../lib/auth.ts';

type NavItem = { to: string; label: string; icon: string };
const NAV: { heading?: string; items: NavItem[] }[] = [
  { items: [{ to: '/hq/dashboard', label: 'Dashboard', icon: '◎' }] },
  { heading: 'Selling', items: [
    { to: '/hq/orders', label: 'Orders', icon: '▦' },
    { to: '/hq/subscribers', label: 'Newsletter', icon: '✉' },
    { to: '/hq/details', label: 'Game details', icon: '⚙' },
  ] },
  { heading: 'The website', items: [
    { to: '/hq/pages', label: 'Page copy', icon: '✎' },
    { to: '/hq/reviews', label: 'Reviews', icon: '★' },
    { to: '/hq/news', label: 'News', icon: '▤' },
    { to: '/hq/tutorials', label: 'Tutorials', icon: '▶' },
    { to: '/hq/faqs', label: 'FAQ', icon: '?' },
    { to: '/hq/tracks', label: 'Music', icon: '♪' },
    { to: '/hq/games', label: 'Arcade', icon: '◆' },
    { to: '/hq/creators', label: 'Team', icon: '♟' },
  ] },
  { heading: 'Waiting on you', items: [
    { to: '/hq/punchlist', label: 'Punch list', icon: '☑' },
    { to: '/hq/requests', label: 'Requests', icon: '✉' },
  ] },
  { heading: 'Setup', items: [
    { to: '/hq/whats-new', label: "What's new", icon: '✨' },
    { to: '/hq/outbox', label: 'Sent email', icon: '➤' },
    { to: '/hq/settings', label: 'Settings', icon: '⚙' },
  ] },
];

export type NavCount = { fresh: number; total: number };

// One query for every badge. "fresh" is what is waiting on somebody; "total" is the size of the pile.
export async function navCounts(db: D1Database, me: string): Promise<Record<string, NavCount>> {
  const r = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM orders WHERE status='new') AS orders_new,
        (SELECT COUNT(*) FROM orders WHERE status IN ('new','contacted','paid')) AS orders_open,
        (SELECT COUNT(*) FROM requests WHERE status IN ('awaiting','waiting') AND picked_up_by IS NULL) AS req_new,
        (SELECT COUNT(*) FROM requests WHERE status IN ('awaiting','waiting')) AS req_open,
        (SELECT COUNT(*) FROM checklist_items WHERE status IN ('open','doing') AND lower(COALESCE(owner,'')) = lower(?)) AS punch_new,
        (SELECT COUNT(*) FROM checklist_items WHERE status IN ('open','doing')) AS punch_open,
        (SELECT COUNT(*) FROM subscribers WHERE unsubscribed_at IS NULL) AS subs`,
    )
    .bind(me)
    .first<Record<string, number>>();
  const x = r || {};
  return {
    '/hq/orders': { fresh: x.orders_new || 0, total: x.orders_open || 0 },
    '/hq/requests': { fresh: x.req_new || 0, total: x.req_open || 0 },
    '/hq/punchlist': { fresh: x.punch_new || 0, total: x.punch_open || 0 },
    '/hq/subscribers': { fresh: 0, total: x.subs || 0 },
  };
}

function badge(label: string, n?: NavCount) {
  if (!n || (!n.fresh && !n.total)) return '';
  const fresh = n.fresh > 0;
  const title = fresh ? `${n.fresh} waiting on you, ${n.total} in total` : `${n.total} in total`;
  return html`<span class="badge ${fresh ? 'badge-fresh' : ''}" title="${title}" aria-label="${label}: ${title}">${fresh ? `${n.fresh}/${n.total}` : n.total}</span>`;
}

export async function shell(c: Ctx, title: string, body: Child, sess: Session | null, _legacy?: unknown): Promise<Response> {
  const flash = c.url.searchParams.get('ok') ? html`<div class="flash">${c.url.searchParams.get('ok')}</div>` : '';
  const counts = sess ? await navCounts(c.env.DB, sess.staff.name).catch(() => ({}) as Record<string, NavCount>) : {};
  const here = c.url.pathname;
  const active = (to: string) => (to === '/hq/dashboard' ? here === to : here === to || here.startsWith(to + '/'));
  const out =
    '<!doctype html>' +
    html`<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | HQ</title><meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/hq.css?v=3"></head>
<body class="hq ${sess ? 'in' : 'out'}" ${sess ? raw(`data-csrf="${sess.csrf}" data-staff="${sess.staff.name.replace(/[^\w .'-]/g, '')}" data-path="${here.replace(/[^\w/.\-]/g, '')}"`) : ''}>
${sess
  ? html`<div class="hq-wrap">
<aside class="hq-side" id="hq-side">
  <a class="hq-brand" href="/hq/dashboard"><span class="mark">C</span><span><b>Coffee Time HQ</b><small>Team backend</small></span></a>
  <nav class="side-nav">
    ${NAV.map(
      (g) => html`<div class="side-group">${g.heading ? html`<div class="side-h">${g.heading}</div>` : ''}
      ${g.items.map((n) => html`<a href="${n.to}" class="side-link" ${active(n.to) ? raw('aria-current="page"') : ''}><span class="ic">${n.icon}</span><span class="lb">${n.label}</span>${badge(n.label, counts[n.to])}</a>`)}</div>`,
    )}
  </nav>
  <div class="side-foot">
    <div class="who"><span>${sess.staff.name}</span><em>${sess.staff.role}</em></div>
    <div class="side-row"><button type="button" class="link" id="hq-theme">Dark mode</button>
      <form method="post" action="/hq/logout"><input type="hidden" name="csrf" value="${sess.csrf}"><button class="link">Sign out</button></form></div>
    <a class="edit-site" href="/hq/review/start?to=/" target="_blank" rel="noopener" title="Browse the real site with a pencil in the corner, so you can ask for a change on the page you are looking at">✎ Edit website ↗</a>
    <a class="view-site" href="/" target="_blank" rel="noopener">View public site ↗</a>
  </div>
</aside>
<div class="hq-body">
  <header class="hq-top"><button type="button" id="hq-menu" aria-label="Menu">☰</button><b>Coffee Time HQ</b></header>
  <main class="hq-main">${flash}<h1>${title}</h1>${body}</main>
</div>
</div>`
  : html`<main class="hq-main hq-login"><div class="login-brand"><span class="mark">C</span><b>Coffee Time HQ</b></div>${flash}<h1>${title}</h1>${body}</main>`}
<script nonce="${c.nonce}" src="/hq.js?v=3" defer></script>
</body></html>`.s;
  return page(out, { headers: { 'cache-control': 'no-store' } });
}

export async function requireSession(c: Ctx): Promise<Session | Response> {
  const s = await currentSession(c);
  if (!s) return redirect('/hq?next=' + encodeURIComponent(c.url.pathname));
  return s;
}

export async function guardedPost(c: Ctx): Promise<{ sess: Session; f: Record<string, string> } | Response> {
  const sess = await requireSession(c);
  if (sess instanceof Response) return sess;
  const f = await formData(c.req);
  if (f.csrf !== sess.csrf) return text('Form expired. Go back, reload the page and try again.', 403);
  return { sess, f };
}
