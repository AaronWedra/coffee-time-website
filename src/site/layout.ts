import { FOAM_JS } from './foam.ts';
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

// 2026 header: the games come first now. Most links are sections of the home page.
export const NAV: { href: string; label: string }[] = [
  { href: '/arcade', label: 'Video Games' },
  { href: '/board-game', label: 'Board Game' },
  { href: '/story', label: 'Story' },
  { href: '/music', label: 'Music' },
  { href: '/team', label: 'Team' },
  { href: '/news', label: 'News' },
];
// Everything else the old nine-link bar carried, tucked under "More" so nothing was lost.
export const MORE: { href: string; label: string }[] = [
  { href: '/board-game#reviews', label: 'Reviews' },
  { href: '/video-tutorials', label: 'Tutorials' },
  { href: '/faq', label: 'FAQ' },
];

// Google Analytics 4, only when HQ > Settings holds a valid Measurement ID. The id is checked against a
// strict pattern before it goes anywhere near an inline script. Google signals and ad personalisation are
// off, which is what the privacy page promises ("Google's advertising features are turned off").
export const GA_ID = /^G-[A-Z0-9]{4,20}$/;

function ga(id: string | undefined, nonce: string) {
  const v = (id || '').trim();
  if (!GA_ID.test(v)) return '';
  return raw(`<script async src="https://www.googletagmanager.com/gtag/js?id=${v}"></script>
<script nonce="${nonce}">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${v}',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});</script>`);
}

export function layout(s: Settings, meta: PageMeta, body: Child, opts: { nonce: string; siteUrl: string; indexable: boolean; kicker?: string }): string {
  const base = opts.siteUrl.replace(/\/$/, '');
  const fullTitle = meta.path === '/' ? `${s.site_name} | The board game where coffee heroes race King Tea` : `${meta.title} | ${s.site_name}`;
  const canonical = base + meta.path;
  const ogImage = base + (meta.image || '/img/og.jpg');
  const robots = meta.noindex || !opts.indexable ? 'noindex, nofollow' : 'index, follow';
  const current = (href: string) => (!href.includes('#') && meta.path === href ? raw('aria-current="page"') : '');
  const li = (n: { href: string; label: string }) => html`<li><a href="${n.href}" ${current(n.href)}>${n.label}</a></li>`;
  const navItems = NAV.map(li);
  const moreItems = MORE.map(li);
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
<link rel="stylesheet" href="/site.css?v=13">
<link rel="stylesheet" href="/fx.css?v=106">
${ga(s.ga4_id, opts.nonce)}
${meta.jsonld ? raw(`<script type="application/ld+json" nonce="${opts.nonce}">${JSON.stringify(meta.jsonld).replace(/</g, '\\u003c')}</script>`) : ''}
</head>
<body class="${meta.bodyClass || ''}">
<div class="space" aria-hidden="true"><div class="sp-neb n1"></div><div class="sp-neb n2"></div><div class="sp-neb n3"></div><div class="sp-aur"></div><div class="sp-st a"></div><div class="sp-st b"></div><div class="sp-st c"></div><i class="sp-shoot s1"></i><i class="sp-shoot s2"></i><i class="sp-shoot s3"></i></div>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap head-row">
    <a class="brand" href="/" aria-label="${s.site_name}, home"><img src="/img/logo-purple.webp" alt="Coffee Time" width="1200" height="195"></a>
    <nav class="nav" aria-label="Main"><ul>${navItems}</ul></nav>
    ${opts.kicker ? html`<p class="head-tag"><span class="dot" aria-hidden="true"></span>${opts.kicker}</p>` : ''}
    <details class="nav-m">
      <summary aria-label="Menu"><span></span><span></span><span></span></summary>
      <ul>${navItems}${moreItems}</ul>
    </details>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site-foot">
  <div class="wrap foot-row">
    <a class="foot-logo" href="/" aria-label="Coffee Time, home"><img src="/img/logo-white.webp" alt="" width="1200" height="195" loading="lazy"></a>
    <p class="foot-links"><a href="mailto:${s.email}">${s.email}</a> <span>|</span> <a href="${s.facebook}" target="_blank" rel="noopener">Facebook</a> <span>|</span> <a href="/video-tutorials">Tutorials</a> <span>|</span> <a href="/faq">FAQ</a> <span>|</span> <a href="/privacy">Privacy</a></p>
    <p class="foot-credit">Website Design by <a href="https://www.smartzgraphics.com" target="_blank" rel="noopener">www.SmartzGraphics.com</a></p>
  </div>
</footer>
<script nonce="${opts.nonce}">${raw(FOAM_JS)}</script>
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
export function orb(name: string, side: 'l' | 'r', y: number, size = 2, dx = 0): Safe {
  const yy = Math.min(90, Math.max(0, Math.round(y / 10) * 10));
  const xx = Math.min(8, Math.max(-8, Math.round(dx)));
  return raw(`<span class="orb orb-${side} orb-y${yy} orb-s${size} orb-x${xx < 0 ? 'n' + -xx : xx} orb-${esc(name)}" aria-hidden="true"><i class="o-aura"></i><i class="o-ring"></i><img src="/img/orb-${esc(name)}.webp" alt="" loading="lazy" decoding="async" width="420" height="420"><i class="o-glint"></i><i class="o-spark s1"></i><i class="o-spark s2"></i></span>`);
}
