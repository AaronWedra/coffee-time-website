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
};

// The same nine links as the Wix site, in the same order. Six of them are sections of the home page.
export const NAV: { href: string; label: string }[] = [
  { href: '/#rules', label: 'Rules' },
  { href: '/#video-game', label: 'Video Game' },
  { href: '/#music', label: 'Music' },
  { href: '/#order', label: 'Order' },
  { href: '/story', label: 'Story' },
  { href: '/arcade', label: 'Arcade' },
  { href: '/#team', label: 'Team' },
  { href: '/news', label: 'News' },
  { href: '/#reviews', label: 'Reviews' },
];

export function layout(s: Settings, meta: PageMeta, body: Child, opts: { nonce: string; siteUrl: string; indexable: boolean }): string {
  const base = opts.siteUrl.replace(/\/$/, '');
  const fullTitle = meta.path === '/' ? `${s.site_name} | The board game where coffee heroes race King Tea` : `${meta.title} | ${s.site_name}`;
  const canonical = base + meta.path;
  const ogImage = base + (meta.image || '/img/og.jpg');
  const robots = meta.noindex || !opts.indexable ? 'noindex, nofollow' : 'index, follow';
  const current = (href: string) => (!href.includes('#') && meta.path === href ? raw('aria-current="page"') : '');
  const navItems = NAV.map((n) => html`<li><a href="${n.href}" ${current(n.href)}>${n.label}</a></li>`);
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
<meta name="theme-color" content="#320158">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/anton.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="/fonts/jost.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="/site.css?v=2">
${meta.jsonld ? raw(`<script type="application/ld+json" nonce="${opts.nonce}">${JSON.stringify(meta.jsonld).replace(/</g, '\\u003c')}</script>`) : ''}
</head>
<body class="${meta.bodyClass || ''}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap head-row">
    <a class="brand" href="/" aria-label="${s.site_name}, home"><img src="/img/logo-purple.webp" alt="Coffee Time" width="1200" height="195"></a>
    <nav class="nav" aria-label="Main"><ul>${navItems}</ul></nav>
    <details class="nav-m">
      <summary aria-label="Menu"><span></span><span></span><span></span></summary>
      <ul>${navItems}</ul>
    </details>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site-foot">
  <div class="wrap foot-row">
    <a class="foot-logo" href="/" aria-label="Coffee Time, home"><img src="/img/logo-white.webp" alt="" width="1200" height="195" loading="lazy"></a>
    <p class="foot-links"><a href="mailto:${s.email}">${s.email}</a> <span>|</span> <a href="${s.facebook}" target="_blank" rel="noopener">Facebook</a> <span>|</span> <a href="/video-tutorials">Tutorials</a> <span>|</span> <a href="/faq">FAQ</a></p>
    <p class="foot-credit">Website Design by <a href="https://www.smartzgraphics.com" target="_blank" rel="noopener">www.SmartzGraphics.com</a> <a href="/hq" class="quiet">Team login</a></p>
  </div>
</footer>
</body>
</html>`.s
  );
}

export function img(src: string, alt: string, extra = ''): Safe {
  return raw(`<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" ${extra}>`);
}

// A floating orb from the board's item cards, parked at the edge of a section like on the Wix site.
// side: l | r. y: 0..90 in steps of 10 (percent down the section). size: 1 small .. 4 large.
// Classes rather than inline styles because the CSP has no 'unsafe-inline' for styles.
export function orb(name: string, side: 'l' | 'r', y: number, size = 2): Safe {
  const yy = Math.min(90, Math.max(0, Math.round(y / 10) * 10));
  return raw(`<img class="orb orb-${side} orb-y${yy} orb-s${size}" src="/img/orb-${esc(name)}.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" width="420" height="420">`);
}
