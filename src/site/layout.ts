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

// Google Analytics 4, only when HQ > Settings holds a valid Measurement ID. The id is checked against a
// strict pattern before it goes anywhere near an inline script. Google signals and ad personalisation are
// off, which is what the privacy page promises ("Google's advertising features are turned off").
export const GA_ID = /^G-[A-Z0-9]{4,20}$/;

// The analytics notice ("Notice + Decline", the shared Smartz spec of 2026-10-29). It lives inside the GA
// snippet on purpose, so the bar can only appear where Analytics actually loads (never in HQ, never without an
// ID, and it skips itself in Edit website mode). No thanks is remembered in localStorage['analytics-choice'];
// the ga-disable flag is set BEFORE gtag config runs, so Google's library then sends nothing and sets no
// cookies. Built with createElement/textContent and styled by .ga-bar classes in site.css (no inline styles,
// the CSP has no unsafe-inline). window.analyticsChoice() clears the choice and shows the bar again; the
// privacy page's button calls it and stays hidden when this script is not on the page.
function consentJs(id: string): string {
  return `(function(){var ids=['${id}'],K='analytics-choice',bar=null;
function get(){try{return localStorage.getItem(K)}catch(e){return null}}
function put(v){try{if(v)localStorage.setItem(K,v);else localStorage.removeItem(K)}catch(e){}}
function flag(on){for(var i=0;i<ids.length;i++)window['ga-disable-'+ids[i]]=on}
if(get()==='denied')flag(true);
function wipe(){var h=location.hostname,p=h.split('.'),d=p.length>2?p.slice(-2).join('.'):h,x='=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
document.cookie.split(';').forEach(function(c){var n=c.split('=')[0].trim();if(n.indexOf('_ga')!==0)return;
document.cookie=n+x;document.cookie=n+x+'; domain='+h;document.cookie=n+x+'; domain=.'+d;});}
function hide(){if(bar){bar.parentNode&&bar.parentNode.removeChild(bar);bar=null}}
function btn(label,cls,fn){var b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.addEventListener('click',fn);return b}
function show(){if(bar)return bar;bar=document.createElement('div');bar.className='ga-bar';bar.setAttribute('role','region');bar.setAttribute('aria-label','Analytics notice');
var p=document.createElement('p');p.appendChild(document.createTextNode('We use Google Analytics to count visits and see which pages help. No ads, and nothing is sold. '));
var a=document.createElement('a');a.href='/privacy';a.textContent='Privacy';p.appendChild(a);
var row=document.createElement('div');row.className='ga-bar-actions';
row.appendChild(btn('No thanks','btn ga-no',function(){put('denied');flag(true);wipe();hide()}));
row.appendChild(btn('OK','btn',function(){put('granted');flag(false);hide()}));
bar.appendChild(p);bar.appendChild(row);document.body.appendChild(bar);return bar}
window.analyticsChoice=function(){put(null);hide();var b=show();var f=b.querySelector('button');if(f)f.focus()};
function init(){var bs=document.querySelectorAll('[data-analytics-choice]');for(var i=0;i<bs.length;i++){bs[i].hidden=false;bs[i].addEventListener('click',window.analyticsChoice)}
if(!get()&&!document.getElementById('hq-review-host'))show()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();})();`;
}

function ga(id: string | undefined, nonce: string) {
  const v = (id || '').trim();
  if (!GA_ID.test(v)) return '';
  return raw(`<script async src="https://www.googletagmanager.com/gtag/js?id=${v}"></script>
<script nonce="${nonce}">${consentJs(v)}
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${v}',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});</script>`);
}

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
<link rel="stylesheet" href="/site.css?v=3">
${ga(s.ga4_id, opts.nonce)}
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
    <p class="foot-links"><a href="mailto:${s.email}">${s.email}</a> <span>|</span> <a href="${s.facebook}" target="_blank" rel="noopener">Facebook</a> <span>|</span> <a href="/video-tutorials">Tutorials</a> <span>|</span> <a href="/faq">FAQ</a> <span>|</span> <a href="/privacy">Privacy</a></p>
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
