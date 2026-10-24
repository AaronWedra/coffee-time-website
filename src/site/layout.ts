import { html, raw, esc, type Child, type Safe } from '../lib/html.ts';
import type { Settings } from '../lib/db.ts';

export type PageMeta = {
  title: string; // without site name
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
  bodyClass?: string;
  jsonld?: unknown;
  css?: string; // page-specific CSS from content (world colors), emitted in a nonce'd <style>
};

export const NAV: { href: string; label: string }[] = [
  { href: '/worlds', label: 'Five Worlds' },
  { href: '/how-to-play', label: 'How to play' },
  { href: '/video-game', label: 'Video game' },
  { href: '/music', label: 'Music' },
  { href: '/community', label: 'Community' },
];

export const FOOTER_LINKS: { href: string; label: string }[] = [
  { href: '/news', label: 'News' },
  { href: '/how-to-play#faq', label: 'Rules questions' },
  { href: '/contact', label: 'Contact us' },
];

export const money = (s: Settings) => '$' + (s.price || '39.99');

export function layout(s: Settings, meta: PageMeta, body: Child, opts: { nonce: string; siteUrl: string; indexable: boolean }): string {
  const base = opts.siteUrl.replace(/\/$/, '');
  const fullTitle = meta.path === '/' ? `${s.site_name}: the board game where King Tea races the clock` : `${meta.title} | ${s.site_name}`;
  const canonical = base + meta.path;
  const ogImage = base + (meta.image || '/img/og.jpg');
  const robots = meta.noindex || !opts.indexable ? 'noindex, nofollow' : 'index, follow';
  const current = (href: string) => (meta.path === href || meta.path.startsWith(href + '/') ? raw('aria-current="page"') : '');
  const navItems = NAV.map((n) => html`<li><a href="${n.href}" ${current(n.href)}>${n.label}</a></li>`);
  const orderBtn = html`<a class="btn btn-crown" href="/order">Order the game, ${money(s)}</a>`;
  return (
    '<!doctype html>' +
    html`<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${meta.description}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="${s.site_name}">
<meta property="og:type" content="website">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${meta.description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#8e3cc0">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/anton.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="/fonts/lexend.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="/site.css?v=1">
${meta.css ? raw(`<style nonce="${opts.nonce}">${meta.css}</style>`) : ''}
${meta.jsonld ? raw(`<script type="application/ld+json" nonce="${opts.nonce}">${JSON.stringify(meta.jsonld).replace(/</g, '\\u003c')}</script>`) : ''}
</head>
<body class="${meta.bodyClass || ''}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap head-row">
    <a class="brand" href="/" aria-label="${s.site_name}, home">${clockMark()}<span>Coffee Time</span></a>
    <nav class="nav" aria-label="Main"><ul>${navItems}</ul></nav>
    ${orderBtn}
    <details class="nav-m">
      <summary aria-label="Menu"><span></span><span></span><span></span></summary>
      <ul>${navItems}<li><a href="/news" ${current('/news')}>News</a></li><li>${orderBtn}</li></ul>
    </details>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site-foot">
  <div class="wrap foot-grid">
    <div class="foot-brand">
      <p class="foot-mark">Coffee Time</p>
      <p>${s.tagline} A board game for ${s.players} players, ages ${s.ages}, made in Davis, California.</p>
    </div>
    <div>
      <h2>The game</h2>
      <p><a href="/order">Order a copy</a><br><a href="/how-to-play">How to play</a><br><a href="${s.rules_pdf}" rel="noopener">Rulebook (PDF)</a><br><a href="${s.coloring_pdf}" rel="noopener">Coloring page (PDF)</a></p>
    </div>
    <div>
      <h2>More</h2>
      <p>${FOOTER_LINKS.map((l) => html`<a href="${l.href}">${l.label}</a><br>`)}<a href="${s.demo_url}" rel="noopener">Free video game demo</a></p>
    </div>
    <div>
      <h2>Say hi</h2>
      <p><a href="mailto:${s.email}">${s.email}</a><br><a href="${s.facebook}" rel="noopener">Facebook</a></p>
      <p class="small">${s.charity_percent}% of every game sold supports <a href="${s.charity_url}" rel="noopener">${s.charity_name}</a>.</p>
    </div>
  </div>
  <div class="wrap foot-base">
    <p>&copy; ${new Date().getFullYear()} Coffee Time Adventures. Designed by Aaron Wedra and Stevie Price.</p>
    <p>Website by <a href="https://www.smartzgraphics.com" rel="noopener">Smartz Graphics</a>. <a href="/hq" class="quiet">Team login</a></p>
  </div>
</footer>
</body>
</html>`.s
  );
}

// Small clock used as the logo mark: a face with the hand just short of twelve.
export function clockMark(): Safe {
  return raw(
    `<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" class="mark-face"/><path d="M20 20 L20 3 A17 17 0 0 0 4.2 13.7 Z" class="mark-wedge"/><line x1="20" y1="20" x2="11" y2="9" class="mark-hand"/><circle cx="20" cy="20" r="2.4" class="mark-pin"/></svg>`,
  );
}

// One board-style clock: white face, hour ticks, "Tea Time" at twelve, the world's name across the middle.
// `cls` picks the hand position in site.css (.k1 to .k5 animate on the home page, .s1 to .s5 are still). `hours` is for the label.
export function clock(name: string, cls: string, hours: number): Safe {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const r1 = i % 3 === 0 ? 37 : 40;
    const x1 = 50 + r1 * Math.sin(a), y1 = 50 - r1 * Math.cos(a);
    const x2 = 50 + 44 * Math.sin(a), y2 = 50 - 44 * Math.cos(a);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${i % 3 === 0 ? 'tk tk-big' : 'tk'}"/>`;
  }).join('');
  const [a, b] = name.split(' ');
  return raw(`<svg class="clock ${cls}" viewBox="0 0 100 100" role="img" aria-label="${esc(name)} clock at ${hours} o'clock">
<circle cx="50" cy="50" r="48" class="rim"/><circle cx="50" cy="50" r="45" class="face"/>
<circle cx="50" cy="50" r="22.5" class="wedge" pathLength="100" transform="rotate(-90 50 50)"/>
${ticks}
<text x="50" y="22" class="tt">TEA TIME</text>
<text x="50" y="52" class="wn">${esc(a)}</text><text x="50" y="62" class="wn">${esc(b || '')}</text>
<g class="hand"><line x1="50" y1="50" x2="50" y2="14"/></g>
<circle cx="50" cy="50" r="3.2" class="pin"/>
</svg>`);
}

export function img(src: string, alt: string, extra = ''): Safe {
  return raw(`<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" ${extra}>`);
}

// Fact shields, shaped like the brown badges on the side of the box.
export function shields(s: Settings): Safe {
  return html`<ul class="shields" aria-label="Game facts">
    <li><b>${s.players.replace(' to ', '-')}</b><span>players</span></li>
    <li><b>${s.ages}</b><span>ages</span></li>
    <li><b>${s.play_time.replace(/\s*min.*/, '')}</b><span>minutes</span></li>
  </ul>`;
}
