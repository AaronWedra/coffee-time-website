// End-to-end smoke test against a running dev server (fresh in-memory DB). Never point this at production:
// it places order requests, signs up for the newsletter, creates staff and edits content.
//   npm run dev   (in one terminal)
//   npm run smoke (in another)
const base = process.env.BASE || 'http://127.0.0.1:8788';
if (/playcoffeetime\.com|workers\.dev/.test(base)) throw new Error('smoke.mjs must not run against a deployed site: it writes orders, sign-ups and staff.');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const get = (p, init) => fetch(base + p, { redirect: 'manual', ...init });
const form = (o) => new URLSearchParams(o).toString();
const H = { 'content-type': 'application/x-www-form-urlencoded' };
const old = () => String(Date.now() - 9000);

// ---- public pages
for (const p of ['/', '/story', '/arcade', '/news', '/video-tutorials', '/faq', '/order', '/privacy', '/robots.txt']) {
  const r = await get(p);
  ok(r.status === 200, `${p} 200`);
  if (p !== '/robots.txt') {
    const t = await r.text();
    ok(t.includes('<title>') && !/undefined|\[object |NaN/.test(t), `${p} renders cleanly`);
    ok(!t.includes('—'), `${p} has no em dashes`);
  }
}
ok((await get('/nope')).status === 404, '/nope 404');
for (const [from, to] of [['/rules', '/#rules'], ['/faqs', '/faq'], ['/how-to-play', '/video-tutorials'], ['/video-game', '/arcade'], ['/reviews', '/#reviews'], ['/pre-order', '/order'], ['/story/', '/story']]) {
  const r = await get(from);
  ok(r.status === 301 && (r.headers.get('location') || '').replace(base, '') === to, `${from} -> ${to}`);
}
ok((await get('/img/box-cover.webp')).headers.get('content-type')?.includes('webp'), 'images served');
ok((await get('/fonts/anton.woff')).status === 200, 'fonts self-hosted');
ok((await get('/files/coffee-time-instructions.pdf')).headers.get('content-type')?.includes('pdf'), 'rulebook PDF served from this site');
ok((await get('/video/coffee-time-adventures-trailer.mp4', { method: 'HEAD' })).status === 200, 'trailer video served from this site');
const home = await get('/');
ok(home.headers.get('content-security-policy')?.includes('nonce-'), 'CSP header with nonce');
ok(home.headers.get('x-robots-tag') === 'noindex, nofollow', 'noindex while site_indexable=0');
ok((await get('/sitemap.xml')).status === 404, 'sitemap hidden while not indexable');
const htxt = await (await get('/')).text();
ok(htxt.includes('$39.99') && htxt.includes('id="rules"') && htxt.includes('id="reviews"'), 'home shows price and the anchored sections');
ok((htxt.match(/w\.soundcloud\.com\/player/g) || []).length === 12, 'twelve SoundCloud players');
ok(htxt.includes('Zacharia O.') && htxt.includes('Avery Armstrong Stockert'), 'all reviews on the home page');
ok(htxt.includes('/img/logo-purple.webp') && !htxt.includes('<svg class="mark"'), 'real logo in the header');
ok(!/style="/.test(htxt), 'no inline styles (CSP)');
// ---- analytics + privacy (migration 0004 seeds the GA4 id, so a fresh DB has analytics on; no consent bar by Aarons decision)
ok(/<script nonce="[A-Za-z0-9_-]+">window\.dataLayer/.test(htxt) && htxt.includes('allow_google_signals:false') && htxt.includes('allow_ad_personalization_signals:false'), 'GA snippet nonce\'d, signals and ad personalisation off');
ok(!/analytics-choice|ga-disable-|analyticsChoice|ga-bar|_ga=|localStorage/.test(htxt), 'no consent bar or choice code on public pages (Aaron, 2026-10-29)');
ok(/<a href="\/privacy">Privacy<\/a>/.test(htxt), 'footer links to /privacy');
const priv = await (await get('/privacy')).text();
ok(priv.includes('<h2>Analytics and cookies</h2>') && priv.includes('href="https://tools.google.com/dlpage/gaoptout"') && priv.includes('href="https://policies.google.com/technologies/partner-sites"') && priv.includes('mailto:playcoffeetime@yahoo.com'), 'privacy page: analytics section, both Google links, contact email');
ok(priv.includes('You can opt out at any time by installing Google&#39;s opt-out browser add-on (<a href="https://tools.google.com/dlpage/gaoptout"') && !priv.includes('say no at any time') && !priv.includes('analytics choice') && !/style="/.test(priv), 'privacy: new opt-out sentence, no choice button, no inline styles');
ok(/connect-src[^;]* https:\/\/analytics\.google\.com /.test(home.headers.get('content-security-policy') || ''), 'CSP allows the analytics.google.com transport host');
const tut = await (await get('/video-tutorials')).text();
ok((tut.match(/youtube-nocookie\.com\/embed\//g) || []).length === 46, '46 tutorial videos');
ok(/href="\/files\/coffee-time-story\.pdf"/.test(tut), 'story PDF linked locally');
ok((await (await get('/story')).text()).includes('/img/story-8.webp'), 'story page shows all eight pages');

// ---- newsletter
let r = await get('/newsletter', { method: 'POST', headers: H, body: form({ email: 'spam@x.com', website: 'spam', _t: old() }) });
ok(r.status === 303 && r.headers.get('location') === '/?joined=1#newsletter', 'newsletter honeypot: pretends success');
r = await get('/newsletter', { method: 'POST', headers: H, body: form({ email: 'nope', _t: old() }) });
ok(r.headers.get('location') === '/?joined=0#newsletter', 'newsletter: bad email bounced');
r = await get('/newsletter', { method: 'POST', headers: H, body: form({ email: 'fan@example.com', _t: old() }) });
ok(r.headers.get('location') === '/?joined=1#newsletter', 'newsletter: joined');
ok((await (await get('/?joined=1')).text()).includes("You're on the list"), 'newsletter thank-you shown');

// ---- order form
r = await get('/order', { method: 'POST', headers: H, body: form({ name: 'Bot', email: 'b@x.com', address: '1 Spam St, Nowhere', website: 'spam', _t: old() }) });
ok(r.status === 303 && r.headers.get('location') === '/order?sent=1', 'order honeypot: pretends success');
r = await get('/order', { method: 'POST', headers: H, body: form({ name: 'Fast', email: 'f@x.com', address: '1 Quick St, Davis CA', _t: String(Date.now()) }) });
ok(r.status === 303, 'order too-fast submit: pretends success');
r = await get('/order', { method: 'POST', headers: H, body: form({ name: 'Test Buyer', email: 'nope', address: '1 Main St, Davis CA 95616', _t: old() }) });
ok(r.status === 400 && (await r.text()).includes('does not look right'), 'order: bad email rejected with message');
r = await get('/order', { method: 'POST', headers: H, body: form({ name: 'Test Buyer', email: 'buyer@example.com', address: 'short', _t: old() }) });
ok(r.status === 400 && (await r.text()).includes('full shipping address'), 'order: short address rejected');
r = await get('/order', { method: 'POST', headers: H, body: form({ name: 'Test Buyer', email: 'buyer@example.com', phone: '530-555-0100', quantity: '99', address: '1 Main St\nDavis, CA 95616', notes: 'Gift for my niece', newsletter: '1', _t: old() }) });
ok(r.status === 303 && r.headers.get('location') === '/order?sent=1', 'order accepted');
ok((await (await get('/order?sent=1')).text()).includes('Order request sent'), 'order thank-you shown');

// ---- HQ
ok((await get('/hq')).headers.get('location') === '/hq/setup', 'HQ sends first visit to setup');
r = await get('/hq/setup', { method: 'POST', headers: H, body: form({ token: 'wrong', name: 'Aaron', password: 'correct horse battery' }) });
ok((await r.text()).includes('does not match'), 'setup refuses a wrong phrase');
r = await get('/hq/setup', { method: 'POST', headers: H, body: form({ token: 'dev', name: 'Aaron', password: 'correct horse battery' }) });
ok(r.status === 303, 'setup creates the first admin');
const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
const A = { cookie };
const dash = await (await get('/hq/dashboard', { headers: A })).text();
ok(dash.includes('new order request') && dash.includes('Test Buyer'), 'dashboard shows the new order');
ok(dash.includes('<b>2</b><span>newsletter sign-ups'), 'dashboard counts the two sign-ups (form + order)');
const orders = await (await get('/hq/orders', { headers: A })).text();
const id = /\/hq\/orders\/(\d+)/.exec(orders)?.[1];
ok(!!id, 'order listed in HQ');
const detail = await (await get(`/hq/orders/${id}`, { headers: A })).text();
ok(detail.includes('<b>10</b>') && detail.includes('Gift for my niece'), 'quantity capped at 10, notes kept');
const csrf = /name="csrf" value="([0-9a-f]+)"/.exec(detail)?.[1];
r = await get(`/hq/orders/${id}`, { method: 'POST', headers: { ...H, ...A }, body: form({ csrf: 'bad', status: 'paid' }) });
ok(r.status === 403, 'HQ rejects a bad CSRF token');
r = await get(`/hq/orders/${id}`, { method: 'POST', headers: { ...H, ...A }, body: form({ csrf, status: 'shipped', staff_notes: 'USPS 9400' }) });
ok(r.status === 303, 'order marked shipped');
ok((await (await get('/hq/dashboard', { headers: A })).text()).includes('<b>10</b><span>games paid or shipped'), 'dashboard counts shipped games');
const subs = await (await get('/hq/subscribers', { headers: A })).text();
ok(subs.includes('fan@example.com') && subs.includes('buyer@example.com'), 'subscribers listed in HQ');
const csv = await get('/hq/subscribers.csv', { headers: A });
ok(csv.headers.get('content-type')?.includes('text/csv') && (await csv.text()).includes('fan@example.com'), 'subscriber CSV download');

// edit content from HQ and see it on the site
r = await get('/hq/details', { method: 'POST', headers: { ...H, ...A }, body: form({ csrf, price: '44.50', orders_open: '1', players: '2-6 Players', ages: 'Ages 8+', max_quantity: '10' }) });
ok(r.status === 303, 'price changed in HQ');
ok((await (await get('/order')).text()).includes('$44.50'), 'new price shows on the order form');
const pages = await (await get('/hq/pages', { headers: A })).text();
ok(pages.includes('Top of the page: headline'), 'page copy editor lists blocks');
r = await get('/hq/pages', { method: 'POST', headers: { ...H, ...A }, body: form({ csrf, 'b:hero_title': 'Learn to play like a hero' }) });
ok((await (await get('/')).text()).includes('Learn to play like a hero'), 'page copy edit shows on the site');
for (const p of ['/hq/reviews', '/hq/news', '/hq/tutorials', '/hq/faqs', '/hq/tracks', '/hq/games', '/hq/creators', '/hq/settings', '/hq/reviews/1', '/hq/news/new']) {
  ok((await get(p, { headers: A })).status === 200, `${p} 200`);
}
r = await get('/hq/reviews/new', { method: 'POST', headers: { ...H, ...A }, body: form({ csrf, quote: 'Best game night ever.', name: 'Smoke Tester', role: 'Playtester', sort: '99', published: '1' }) });
ok(r.status === 303 && (await (await get('/')).text()).includes('Smoke Tester'), 'new review added in HQ shows on the site');
r = await get('/hq/details', { method: 'POST', headers: { ...H, ...A }, body: form({ csrf, price: '39.99', players: '2-6 Players', ages: 'Ages 8+', max_quantity: '10' }) });
ok((await (await get('/order')).text()).includes('Orders are paused'), 'unticking "order form is open" pauses orders');
ok((await get('/hq/dashboard')).status === 302, 'HQ needs a login');

// ---- requests board, pencil, punch list ----
const J = { ...H, ...A, 'x-hq': '1', 'content-type': 'application/json' };
ok((await get('/hq/review.js')).status === 401, 'review.js needs a session');
ok((await get('/hq/review.js', { headers: A })).status === 200, 'review.js served to staff');
r = await get('/hq/review/start?to=/story', { headers: A, redirect: 'manual' });
const rc = (r.headers.get('set-cookie') || '').match(/hq_review=1/);
ok(r.status === 302 && rc && r.headers.get('location') === '/story', 'Edit website sets the review cookie and lands on the page');
r = await get('/hq/review/start?to=//evil.com', { headers: A, redirect: 'manual' });
ok(r.headers.get('location') === '/', 'review start refuses off-site redirects');
const R = { cookie: A.cookie + '; hq_review=1' };
const withBoth = await (await get('/story', { headers: R })).text();
ok(withBoth.includes('/hq/review.js'), 'pencil injected with session plus review cookie');
ok(!(await (await get('/story', { headers: { cookie: 'hq_review=1' } })).text()).includes('/hq/review.js'), 'no pencil without a session');
ok(!(await (await get('/story', { headers: A })).text()).includes('/hq/review.js'), 'no pencil without the review cookie');
r = await get('/hq/api/requests', { method: 'POST', headers: { ...H, ...A, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'x', body: 'y' }) });
ok(r.status >= 400, 'API post without X-HQ header is refused');
r = await get('/hq/api/requests', { method: 'POST', headers: J, body: JSON.stringify({ title: 'Make the title bigger [/story]', body: 'Smoke request', page: '/story', source: 'site', attachment_ids: [] }) });
const filed = await r.json();
ok(r.status === 200 && filed.id, 'request filed from the pencil');
ok((await (await get('/hq/api/page-thread?page=/story', { headers: A })).text()).includes('Make the title bigger'), 'page thread lists it');
ok((await (await get('/hq/requests', { headers: A })).text()).includes('Make the title bigger'), 'request on the board');
r = await get(`/hq/api/requests/${filed.id}/pickup`, { method: 'POST', headers: J, body: '{}' });
ok((await (await get('/hq/api/page-thread?page=/story', { headers: A })).text()).includes('is on it') || r.status === 200, 'pickup works');
r = await get(`/hq/api/requests/${filed.id}/messages`, { method: 'POST', headers: J, body: JSON.stringify({ body: 'Done, check it', asks: false }) });
ok(r.status === 200, 'reply posted');
r = await get(`/hq/api/requests/${filed.id}/status`, { method: 'POST', headers: J, body: JSON.stringify({ status: 'done' }) });
ok(r.status === 200, 'status set');
const fd = new FormData(); fd.append('file', new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], { type: 'image/png' }), 's.png');
r = await get('/hq/api/attachments', { method: 'POST', headers: { ...A, 'x-hq': '1' }, body: fd });
const att = await r.json();
ok(r.status === 200 && att.id, 'screenshot uploads');
ok((await get(`/hq/attachments/${att.id}`, { headers: A })).status === 200, 'screenshot served to staff');
ok((await get(`/hq/attachments/${att.id}`)).status !== 200, 'screenshot not served to strangers');
const pl = await (await get('/hq/punchlist?f=all', { headers: A })).text();
ok(pl.includes('Point the domain') || pl.includes('domain'), 'punch list seeded');
for (const p of ['/hq/punchlist', '/hq/requests', `/hq/requests/${filed.id}`, '/hq/whats-new', '/hq/outbox']) ok((await get(p, { headers: A })).status === 200, `${p} 200`);
ok((await (await get('/hq/dashboard', { headers: A })).text()).includes('Edit website'), 'sidebar has the Edit website button');
for (const p of ['/hq/requests', '/hq/punchlist', '/hq/dashboard']) {
  const t = await (await get(p, { headers: A })).text();
  ok(!t.includes('gtag/js') && !t.includes('googletagmanager'), `${p}: HQ has no analytics`);
  ok(!/ style="/.test(t) && !t.includes('\u2014'), `${p}: no inline style, no em dash`);
}
r = await get('/hq/api/review/stop', { method: 'POST', headers: J, body: '{}' });
ok(/hq_review=;/.test(r.headers.get('set-cookie') || ''), 'leaving review mode clears the cookie');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
