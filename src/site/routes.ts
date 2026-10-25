import { Router, page, redirect, text, formData, type Ctx } from '../lib/router.ts';
import * as db from '../lib/db.ts';
import { layout, type PageMeta } from './layout.ts';
import * as P from './pages.ts';
import { sendEmail } from '../lib/email.ts';
import type { Safe } from '../lib/html.ts';

type MetaIn = Omit<PageMeta, 'description'> & { description?: string };

export const site = new Router();

// Old URLs -> current ones. Keep these forever: they are printed in the rulebook, linked from
// Facebook, Comic-Con programs and old emails. Covers the Wix site and the 2026 previews.
const REDIRECTS: Record<string, string> = {
  '/home': '/',
  '/rules': '/#rules',
  '/how-to-play': '/video-tutorials',
  '/tutorials': '/video-tutorials',
  '/learn-to-play': '/video-tutorials',
  '/faqs': '/faq',
  '/worlds': '/story',
  '/the-story': '/story',
  '/video-game': '/arcade',
  '/videogame': '/arcade',
  '/coffee-time-adventures': '/arcade',
  '/music': '/#music',
  '/warp-world-music': '/#music',
  '/team': '/#team',
  '/community': '/#team',
  '/meet-the-creators': '/#team',
  '/reviews': '/#reviews',
  '/pre-order': '/order',
  '/preorder': '/order',
  '/orders': '/order',
  '/shop': '/order',
  '/buy': '/order',
  '/contact': '/#newsletter',
  '/newsletter': '/#newsletter',
};

export const STATIC_PATHS = ['/', '/story', '/arcade', '/play/', '/news', '/video-tutorials', '/faq', '/order'];

const siteUrl = (c: Ctx) => (c.env.SITE_URL || `${c.url.protocol}//${c.url.host}`).replace(/\/$/, '');

async function render(c: Ctx, meta: MetaIn, body: Safe, status = 200) {
  const s = (c.state.settings as db.Settings) || (await db.getSettings(c.env.DB));
  const indexable = s.site_indexable === '1';
  const out = layout(s, { ...meta, description: meta.description || s.seo_description }, body, { nonce: c.nonce, siteUrl: siteUrl(c), indexable });
  const headers: Record<string, string> = {};
  if (!indexable) headers['x-robots-tag'] = 'noindex, nofollow';
  if (c.req.method === 'POST' || /[?&](sent|joined|error)=/.test(c.url.search)) headers['cache-control'] = 'no-store';
  return page(out, { status, headers });
}

async function base(c: Ctx) {
  const [s, b] = await Promise.all([db.getSettings(c.env.DB), db.getBlocks(c.env.DB)]);
  c.state.settings = s;
  return { s, b };
}

for (const [from, to] of Object.entries(REDIRECTS)) site.get(from, () => redirect(to, 301));

site.get('/', async (c) => {
  const { s, b } = await base(c);
  const [tracks, creators, reviews] = await Promise.all([db.listTracks(c.env.DB), db.listCreators(c.env.DB), db.listReviews(c.env.DB)]);
  const url = siteUrl(c);
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Coffee Time board game',
    description: s.seo_description,
    image: [url + '/img/box-cover.webp', url + '/img/board.webp'],
    brand: { '@type': 'Brand', name: 'Coffee Time' },
    audience: { '@type': 'PeopleAudience', suggestedMinAge: 8 },
    offers: { '@type': 'Offer', price: s.price, priceCurrency: 'USD', availability: s.orders_open === '0' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', url: url + '/#order' },
  };
  const q = c.url.searchParams;
  return render(c, { title: 'Home', path: '/', bodyClass: 'is-home', jsonld }, P.home(s, b, tracks, creators, reviews, { joined: q.get('joined') || undefined, order: { sent: q.get('sent') === '1' } }));
});

site.get('/story', async (c) => {
  const { s, b } = await base(c);
  return render(c, { title: 'Story', description: 'The illustrated Coffee Time story from the box: King Tea, the crumpets, the Duchess, Roamer, and the heroes who race the World Clocks.', path: '/story', image: '/img/story-1.webp' }, P.story(s, b));
});

site.get('/arcade', async (c) => {
  const { s, b } = await base(c);
  const games = await db.listGames(c.env.DB);
  return render(c, { title: 'Arcade', description: 'Coffee Time Adventures, the video game, plus Rapid Refill and Donut Dash to play in your browser.', path: '/arcade', image: '/img/trailer-poster.webp' }, P.arcade(s, b, games));
});

site.get('/news', async (c) => {
  const { s, b } = await base(c);
  const items = await db.listNews(c.env.DB);
  return render(c, { title: 'News', description: 'Coffee Time at San Diego Comic-Con, on KDVS radio, the first 100 games and the video game.', path: '/news', image: '/img/comic-con-2025-a.webp' }, P.news(s, b, items));
});

site.get('/video-tutorials', async (c) => {
  const { s, b } = await base(c);
  const items = await db.listTutorials(c.env.DB);
  return render(c, { title: 'Video Tutorials', description: 'Learn to play Coffee Time like a pro: 46 short video tutorials covering setup, moving, battles, every card, Roamer, King Tea and how to win.', path: '/video-tutorials' }, P.tutorials(s, b, items));
});

site.get('/faq', async (c) => {
  const { s, b } = await base(c);
  const items = await db.listFaqs(c.env.DB);
  const jsonld = items.length
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer.replace(/\*\*/g, '') } })) }
    : undefined;
  return render(c, { title: 'FAQ', description: 'Answers to the Coffee Time rules questions players ask most: turn order, King Tea and the World Clocks, the Team Path, sharing heat, Roamer.', path: '/faq', jsonld }, P.faq(s, b, items));
});

site.get('/order', async (c) => {
  const { s, b } = await base(c);
  return render(c, { title: 'Order', description: `Order Coffee Time, the board game, for $${s.price}. Send your details and we email you to arrange shipping and payment.`, path: '/order', image: '/img/box-cover.webp' }, P.orderPage(s, b, { sent: c.url.searchParams.get('sent') === '1' }));
});

// Shared bot checks for public forms: honeypot, too-fast submit, per-IP rate limit.
async function botCheck(c: Ctx, f: Record<string, string>, kind: string, limit: number): Promise<'bot' | 'limited' | null> {
  const t = parseInt(f._t || '0', 10);
  if (f.website || (t && Date.now() - t < 2500)) return 'bot';
  if (await db.overLimit(c.env.DB, `${kind}:${c.ip}`, limit, 3600)) return 'limited';
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

site.post('/order', async (c) => {
  const { s, b } = await base(c);
  const f = await formData(c.req);
  const max = Math.max(1, parseInt(s.max_quantity || '10', 10));
  const values = {
    name: (f.name || '').trim().slice(0, 120),
    email: (f.email || '').trim().slice(0, 200),
    phone: (f.phone || '').trim().slice(0, 40),
    quantity: String(Math.min(max, Math.max(1, parseInt(f.quantity || '1', 10) || 1))),
    address: (f.address || '').trim().slice(0, 600),
    notes: (f.notes || '').trim().slice(0, 1500),
    newsletter: f.newsletter ? '1' : '',
  };
  const fail = (error: string, status = 400) => render(c, { title: 'Order', path: '/order', noindex: true }, P.orderPage(s, b, { error, values }), status);

  if (s.orders_open === '0') return redirect('/order', 303);
  const bot = await botCheck(c, f, 'order', 5);
  if (bot === 'bot') return redirect('/order?sent=1', 303);
  if (bot === 'limited') return fail(`Too many order requests from this connection in the last hour. Please email ${s.email} instead.`, 429);
  if (!values.name) return fail('Please add your name.');
  if (!EMAIL_RE.test(values.email)) return fail('That email address does not look right. Please check it so we can reach you.');
  if (values.address.length < 10) return fail('Please add the full shipping address, including city and ZIP code.');

  const qty = parseInt(values.quantity, 10);
  const id = await db.insertOrder(c.env.DB, { ...values, quantity: qty, newsletter: values.newsletter ? 1 : 0, ip: c.ip });
  if (values.newsletter) await db.subscribe(c.env.DB, values.email, 'order', c.ip);
  const to = c.env.NOTIFY_TO || s.notify_email;
  if (s.notify_enabled === '1' && to) {
    const subtotal = (qty * parseFloat(s.price || '0')).toFixed(2);
    const body = `New order request #${id} on the Coffee Time website\n\nName: ${values.name}\nEmail: ${values.email}\nPhone: ${values.phone || '(none)'}\nGames: ${qty} (subtotal $${subtotal} before shipping)\n\nShip to:\n${values.address}\n\nNotes: ${values.notes || '(none)'}\nNewsletter: ${values.newsletter ? 'yes' : 'no'}\n\nOpen it in HQ: ${siteUrl(c)}/hq/orders/${id}\n`;
    c.waitUntil(sendEmail(c.env, to, `[Order #${id}] ${qty} x Coffee Time for ${values.name}`, body));
  }
  return redirect('/order?sent=1', 303);
});

site.post('/newsletter', async (c) => {
  const { s } = await base(c);
  const f = await formData(c.req);
  const email = (f.email || '').trim().slice(0, 200);
  const bot = await botCheck(c, f, 'newsletter', 10);
  if (bot === 'bot') return redirect('/?joined=1#newsletter', 303);
  if (bot === 'limited') return redirect('/?joined=0#newsletter', 303);
  if (!EMAIL_RE.test(email)) return redirect('/?joined=0#newsletter', 303);
  const isNew = await db.subscribe(c.env.DB, email, 'newsletter', c.ip);
  const to = c.env.NOTIFY_TO || s.notify_email;
  if (isNew && s.notify_enabled === '1' && to) c.waitUntil(sendEmail(c.env, to, `[Newsletter] ${email} joined`, `${email} signed up for the Coffee Time newsletter.\n\nThe full list is in HQ: ${siteUrl(c)}/hq/subscribers\n`));
  return redirect('/?joined=1#newsletter', 303);
});

site.get('/sitemap.xml', async (c) => {
  const s = await db.getSettings(c.env.DB);
  if (s.site_indexable !== '1') return text('', 404);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${STATIC_PATHS.map((u) => `  <url><loc>${siteUrl(c)}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  return text(xml, 200, 'application/xml; charset=utf-8');
});

site.get('/robots.txt', async (c) => {
  const s = await db.getSettings(c.env.DB);
  if (s.site_indexable !== '1') return text('User-agent: *\nDisallow: /\n');
  return text(`User-agent: *\nAllow: /\nDisallow: /hq\n\nSitemap: ${siteUrl(c)}/sitemap.xml\n`);
});

export async function notFound(c: Ctx) {
  await base(c);
  return render(c, { title: 'Page not found', path: c.url.pathname, noindex: true }, P.notFound(), 404);
}
