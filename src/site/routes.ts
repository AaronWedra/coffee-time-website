import { Router, page, redirect, text, formData, type Ctx } from '../lib/router.ts';
import * as db from '../lib/db.ts';
import { layout, type PageMeta } from './layout.ts';
import * as P from './pages.ts';
import { sendEmail } from '../lib/email.ts';
import type { Safe } from '../lib/html.ts';

type MetaIn = Omit<PageMeta, 'description'> & { description?: string };

export const site = new Router();

// Old URLs -> new ones. Keep these forever; they are printed in the rulebook, linked from Facebook,
// Comic-Con programs and old emails. Covers the Wix site and the August 2026 preview.
const REDIRECTS: Record<string, string> = {
  '/home': '/',
  '/rules': '/how-to-play',
  '/video-tutorials': '/how-to-play',
  '/tutorials': '/how-to-play',
  '/learn-to-play': '/how-to-play',
  '/faq': '/how-to-play#faq',
  '/faqs': '/how-to-play#faq',
  '/story': '/worlds',
  '/the-story': '/worlds',
  '/five-worlds': '/worlds',
  '/arcade': '/video-game',
  '/videogame': '/video-game',
  '/video-games': '/video-game',
  '/coffee-time-adventures': '/video-game',
  '/warp-world-music': '/music',
  '/team': '/community',
  '/meet-the-creators': '/community',
  '/reviews': '/community#reviews',
  '/pre-order': '/order',
  '/preorder': '/order',
  '/orders': '/order',
  '/shop': '/order',
  '/buy': '/order',
  '/newsletter': '/contact',
};

export const STATIC_PATHS = ['/', '/worlds', '/how-to-play', '/video-game', '/music', '/community', '/news', '/order', '/contact'];

const siteUrl = (c: Ctx) => (c.env.SITE_URL || `${c.url.protocol}//${c.url.host}`).replace(/\/$/, '');

// Per-world colors live in D1 (editable in HQ), so they are emitted as CSS custom properties per page.
function worldCss(worlds: db.World[]): string {
  return worlds
    .filter((w) => /^#[0-9a-f]{3,8}$/i.test(w.color) && /^[a-z0-9-]+$/.test(w.slug))
    .map((w) => `.w-${w.slug}{--wc:${w.color}}`)
    .join('');
}

async function render(c: Ctx, meta: MetaIn, body: Safe, status = 200) {
  const s = (c.state.settings as db.Settings) || (await db.getSettings(c.env.DB));
  const indexable = s.site_indexable === '1';
  const out = layout(s, { ...meta, description: meta.description || s.seo_description }, body, { nonce: c.nonce, siteUrl: siteUrl(c), indexable });
  const headers: Record<string, string> = {};
  if (!indexable) headers['x-robots-tag'] = 'noindex, nofollow';
  if (c.req.method === 'POST' || /[?&](sent|error)=/.test(c.url.search)) headers['cache-control'] = 'no-store';
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
  const [worlds, chars, reviews] = await Promise.all([db.listWorlds(c.env.DB), db.listCharacters(c.env.DB), db.listReviews(c.env.DB)]);
  const url = siteUrl(c);
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Coffee Time board game',
    description: s.seo_description,
    image: [url + '/img/box-front.webp', url + '/img/board.webp'],
    brand: { '@type': 'Brand', name: 'Coffee Time Adventures' },
    audience: { '@type': 'PeopleAudience', suggestedMinAge: parseInt(s.ages, 10) || 8 },
    offers: { '@type': 'Offer', price: s.price, priceCurrency: 'USD', availability: s.orders_open === '0' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', url: url + '/order' },
  };
  return render(c, { title: 'Home', path: '/', bodyClass: 'is-home', jsonld, css: worldCss(worlds) }, P.home(s, b, worlds, chars, reviews));
});

site.get('/worlds', async (c) => {
  const { s, b } = await base(c);
  const worlds = await db.listWorlds(c.env.DB);
  return render(c, { title: 'The Five Worlds', description: 'Coffee World, Donut World, Warp World, Crumpet World and Tea World: the five worlds of the Coffee Time board game, and the illustrated story from the box.', path: '/worlds', image: '/img/story/page-1.webp', css: worldCss(worlds) }, P.worldsPage(s, b, worlds));
});

site.get('/how-to-play', async (c) => {
  const { s, b } = await base(c);
  const [lessons, faqs] = await Promise.all([db.listLessons(c.env.DB), db.listFaqs(c.env.DB)]);
  const jsonld = faqs.length
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer.replace(/\*\*/g, '') } })) }
    : undefined;
  return render(c, { title: 'How to play', description: 'The complete Coffee Time rules in 20 short lessons: setup, moving and battling, every card, playing Roamer and King Tea, and how to win. Plus answers to common rules questions.', path: '/how-to-play', jsonld }, P.howToPlay(s, b, lessons, faqs));
});

site.get('/video-game', async (c) => {
  const { s, b } = await base(c);
  const games = await db.listGames(c.env.DB);
  return render(c, { title: 'Coffee Time Adventures, the video game', description: 'Coffee Time Adventures is a 3D video game set in the Five Worlds. Play the free Windows demo, plus two quick browser games.', path: '/video-game', image: '/img/game/adventures-4.webp' }, P.videoGame(s, b, games));
});

site.get('/music', async (c) => {
  const { s, b } = await base(c);
  const tracks = await db.listTracks(c.env.DB);
  return render(c, { title: 'Warp World music', description: 'The original Coffee Time soundtrack: a theme for every world, battle music and character themes.', path: '/music' }, P.music(s, b, tracks));
});

site.get('/community', async (c) => {
  const { s, b } = await base(c);
  const reviews = await db.listReviews(c.env.DB);
  return render(c, { title: 'Community and reviews', description: 'The creators, artists, playtesters and partners behind Coffee Time, and what players say about it.', path: '/community' }, P.community(s, b, reviews));
});

site.get('/news', async (c) => {
  await base(c);
  const items = await db.listNews(c.env.DB);
  return render(c, { title: 'News', description: 'Coffee Time at San Diego Comic-Con, on KDVS radio, the first 100 games and the video game.', path: '/news' }, P.news(items));
});

site.get('/order', async (c) => {
  const { s, b } = await base(c);
  return render(c, { title: 'Order the board game', description: `Order Coffee Time, the board game for ${s.players} players, for $${s.price}. Fill in the form and we email you to arrange shipping and payment.`, path: '/order', image: '/img/box-front.webp' }, P.order(s, b, { sent: c.url.searchParams.get('sent') === '1' }));
});

site.get('/contact', async (c) => {
  const { s, b } = await base(c);
  const q = c.url.searchParams;
  const values: Record<string, string> = {};
  if (q.get('subject') && P.CONTACT_SUBJECTS.includes(q.get('subject')!)) values.subject = q.get('subject')!;
  return render(c, { title: 'Contact', description: `Contact the Coffee Time team: ${s.email}.`, path: '/contact' }, P.contact(s, b, { sent: q.get('sent') === '1', values }));
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
  const fail = (error: string, status = 400) => render(c, { title: 'Order the board game', path: '/order', noindex: true }, P.order(s, b, { error, values }), status);

  if (s.orders_open === '0') return redirect('/order', 303);
  const bot = await botCheck(c, f, 'order', 5);
  if (bot === 'bot') return redirect('/order?sent=1', 303);
  if (bot === 'limited') return fail(`Too many order requests from this connection in the last hour. Please email ${s.email} instead.`, 429);
  if (!values.name) return fail('Please add your name.');
  if (!EMAIL_RE.test(values.email)) return fail('That email address does not look right. Please check it so we can reach you.');
  if (values.address.length < 10) return fail('Please add the full shipping address, including city and ZIP code.');

  const qty = parseInt(values.quantity, 10);
  const id = await db.insertOrder(c.env.DB, { ...values, quantity: qty, newsletter: values.newsletter ? 1 : 0, ip: c.ip });
  const to = c.env.NOTIFY_TO || s.notify_email;
  if (s.notify_enabled === '1' && to) {
    const subtotal = (qty * parseFloat(s.price || '0')).toFixed(2);
    const body = `New order request #${id} on the Coffee Time website\n\nName: ${values.name}\nEmail: ${values.email}\nPhone: ${values.phone || '(none)'}\nGames: ${qty} (subtotal $${subtotal} before shipping)\n\nShip to:\n${values.address}\n\nNotes: ${values.notes || '(none)'}\nNews by email: ${values.newsletter ? 'yes' : 'no'}\n\nOpen it in HQ: ${siteUrl(c)}/hq/orders/${id}\n`;
    c.waitUntil(sendEmail(c.env, to, `[Order #${id}] ${qty} x Coffee Time for ${values.name}`, body));
  }
  return redirect('/order?sent=1', 303);
});

site.post('/contact', async (c) => {
  const { s, b } = await base(c);
  const f = await formData(c.req);
  const values = { name: (f.name || '').trim().slice(0, 120), email: (f.email || '').trim().slice(0, 200), subject: (f.subject || '').trim().slice(0, 80), body: (f.body || '').trim().slice(0, 4000) };
  const fail = (error: string, status = 400) => render(c, { title: 'Contact', path: '/contact', noindex: true }, P.contact(s, b, { error, values }), status);

  const bot = await botCheck(c, f, 'contact', 5);
  if (bot === 'bot') return redirect('/contact?sent=1', 303);
  if (bot === 'limited') return fail(`Too many messages from this connection in the last hour. Please email ${s.email} instead.`, 429);
  if (!values.name || !values.body) return fail('Please add your name and a message.');
  if (!EMAIL_RE.test(values.email)) return fail('That email address does not look right. Please check it so we can reply.');
  if (!P.CONTACT_SUBJECTS.includes(values.subject)) values.subject = P.CONTACT_SUBJECTS[P.CONTACT_SUBJECTS.length - 1];

  const id = await db.insertMessage(c.env.DB, { ...values, phone: '', ip: c.ip });
  const to = c.env.NOTIFY_TO || s.notify_email;
  if (s.notify_enabled === '1' && to) {
    const body = `New message on the Coffee Time website\n\nFrom: ${values.name}\nEmail: ${values.email}\nAbout: ${values.subject}\n\n${values.body}\n\nRead and reply in HQ: ${siteUrl(c)}/hq/messages/${id}\n`;
    c.waitUntil(sendEmail(c.env, to, `[Website] ${values.subject}: ${values.name}`, body));
  }
  return redirect('/contact?sent=1', 303);
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
