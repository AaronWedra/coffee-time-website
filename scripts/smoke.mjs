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
for (const p of ['/', '/story', '/arcade', '/news', '/video-tutorials', '/faq', '/order', '/robots.txt']) {
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

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
