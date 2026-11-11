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
  { href: '/#video-games', label: 'Video Games' },
  { href: '/#board-game', label: 'Board Game' },
  { href: '/story', label: 'Story' },
  { href: '/#music', label: 'Music' },
  { href: '/#team', label: 'Team' },
  { href: '/news', label: 'News' },
];
// Everything else the old nine-link bar carried, tucked under "More" so nothing was lost.
export const MORE: { href: string; label: string }[] = [
  { href: '/#order', label: 'Order the board game' },
  { href: '/#reviews', label: 'Reviews' },
  { href: '/video-tutorials', label: 'Tutorials' },
  { href: '/faq', label: 'FAQ' },
  { href: '/arcade', label: 'Arcade page' },
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

export function layout(s: Settings, meta: PageMeta, body: Child, opts: { nonce: string; siteUrl: string; indexable: boolean }): string {
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
<link rel="stylesheet" href="/site.css?v=12">
<link rel="stylesheet" href="/fx.css?v=11">
${ga(s.ga4_id, opts.nonce)}
${meta.jsonld ? raw(`<script type="application/ld+json" nonce="${opts.nonce}">${JSON.stringify(meta.jsonld).replace(/</g, '\\u003c')}</script>`) : ''}
</head>
<body class="${meta.bodyClass || ''}">
<div class="space" aria-hidden="true"><div class="sp-neb n1"></div><div class="sp-neb n2"></div><div class="sp-neb n3"></div><div class="sp-aur"></div><div class="sp-st a"></div><div class="sp-st b"></div><div class="sp-st c"></div><i class="sp-shoot s1"></i><i class="sp-shoot s2"></i><i class="sp-shoot s3"></i></div>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap head-row">
    <a class="brand" href="/" aria-label="${s.site_name}, home"><img src="/img/logo-purple.webp" alt="Coffee Time" width="1200" height="195"></a>
    <nav class="nav" aria-label="Main"><ul>${navItems}<li class="more"><details><summary>More</summary><ul>${moreItems}</ul></details></li></ul></nav>
    <a class="head-cta" href="/#video-games">Play free</a>
    <details class="nav-m">
      <summary aria-label="Menu"><span></span><span></span><span></span></summary>
      <ul>${navItems}${moreItems}<li class="m-cta"><a href="/#video-games">Play our games free</a></li></ul>
    </details>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site-foot">
  <div class="wrap foot-row">
    <a class="foot-logo" href="/" aria-label="Coffee Time, home"><img src="/img/logo-white.webp" alt="" width="1200" height="195" loading="lazy"></a>
    <p class="foot-links"><a href="mailto:${s.email}">${s.email}</a> <span>|</span> <a href="${s.facebook}" target="_blank" rel="noopener">Facebook</a> <span>|</span> <a href="/video-tutorials">Tutorials</a> <span>|</span> <a href="/faq">FAQ</a> <span>|</span> <a href="/privacy">Privacy</a></p>
    <p class="foot-credit">Website Design by <a href="https://www.smartzgraphics.com" target="_blank" rel="noopener">www.SmartzGraphics.com</a> <a href="/hq" class="quiet">Team login</a></p>
  </div>
</footer>
<canvas class="latte" aria-hidden="true"></canvas>
<script nonce="${opts.nonce}">(function(){var c=document.querySelector('.latte');if(!c||matchMedia('(prefers-reduced-motion: reduce)').matches)return;var x=c.getContext('2d'),w=0,h=0,last=null,run=false,d=Math.min(devicePixelRatio||1,2);function fit(){w=innerWidth;h=innerHeight;c.width=w*d;c.height=h*d;x.setTransform(d,0,0,d,0,0)}fit();addEventListener('resize',fit);function dot(px,py,r,a){x.globalAlpha=a;x.fillStyle='#fff3dc';x.beginPath();x.arc(px,py,r,0,6.283);x.fill()}function draw(e){var px=e.clientX,py=e.clientY;var sp=last?Math.hypot(px-last.x,py-last.y):0,rad=Math.max(8,Math.min(20,20-sp*.12)),n=last?Math.ceil(sp/3):1;for(var i=0;i<n;i++){var t=last?i/n:0,qx=last?last.x+(px-last.x)*t:px,qy=last?last.y+(py-last.y)*t:py;dot(qx,qy,rad,.75);dot(qx,qy,rad*.6,1);if(Math.random()<.18)dot(qx+(Math.random()-.5)*rad*2.4,qy+(Math.random()-.5)*rad*2.4,1+Math.random()*3,.8)}last={x:px,y:py};if(!run){run=true;requestAnimationFrame(fade)}}function fade(){x.globalCompositeOperation='destination-out';x.globalAlpha=.022;x.fillRect(0,0,w,h);x.globalCompositeOperation='source-over';x.globalAlpha=1;requestAnimationFrame(fade)}addEventListener('pointermove',draw);document.addEventListener('pointerleave',function(){last=null})})();</script>
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
