// Entry point. One Worker: static assets, the public site (server-rendered from D1), and HQ at /hq.
import { randomToken, type Env, type Ctx } from './lib/router.ts';
import { site, notFound } from './site/routes.ts';
import { hq } from './hq/routes.ts';
import { ensureDatabase } from './db/bootstrap.ts';
import { inject } from './hq/review.ts';
import { runWatchdog } from './hq/watchdog.ts';

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

// Fonts, images and the trailer are self-hosted. Third parties: the SoundCloud players (music) and
// YouTube (tutorials), both in iframes.
function csp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'nonce-${nonce}' https://www.googletagmanager.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    `font-src 'self'`,
    `img-src 'self' data: https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com`,
    `connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.googletagmanager.com`,
    `media-src 'self'`,
    `frame-src https://w.soundcloud.com https://www.youtube-nocookie.com`,
    `form-action 'self' mailto:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].join('; ');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Canonical host: apex -> www (only when SITE_URL is set to a www host).
    if (env.SITE_URL) {
      const canon = new URL(env.SITE_URL);
      if (url.hostname !== canon.hostname && url.hostname === canon.hostname.replace(/^www\./, '')) {
        return Response.redirect(canon.origin + url.pathname + url.search, 301);
      }
    }

    // One URL per page: no trailing slashes.
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) return Response.redirect(url.origin + url.pathname.replace(/\/+$/, '') + url.search, 301);

    // Static files first (css, images, fonts, pdfs). Anything under public/ is served by Workers Static Assets.
    if (/\.[a-z0-9]{2,5}$/i.test(url.pathname) && !url.pathname.endsWith('.xml') && !url.pathname.endsWith('.txt')) {
      const res = await env.ASSETS.fetch(request);
      if (res.status !== 404) {
        const h = new Headers(res.headers);
        if (/\.(webp|png|jpe?g|gif|svg|ico|woff2?|mp4)$/i.test(url.pathname)) h.set('cache-control', 'public, max-age=31536000, immutable');
        else if (/\.(css|js)$/i.test(url.pathname)) h.set('cache-control', 'public, max-age=86400');
        else if (/\.pdf$/i.test(url.pathname)) h.set('cache-control', 'public, max-age=3600');
        h.set('x-content-type-options', 'nosniff');
        return new Response(res.body, { status: res.status, headers: h });
      }
    }

    const c: Ctx = {
      req: request,
      env,
      url,
      params: {},
      waitUntil: (p) => ctx.waitUntil(p),
      nonce: randomToken(12),
      ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '0.0.0.0',
      state: {},
    };

    const isHq = url.pathname === '/hq' || url.pathname.startsWith('/hq/');
    const router = isHq ? hq : site;
    const m = router.match(request.method, url.pathname);

    let res: Response;
    try {
      await ensureDatabase(env.DB);
      if (m) {
        c.params = m.params;
        res = await m.h(c);
      } else if (isHq) {
        res = new Response('Not found', { status: 404 });
      } else {
        res = await notFound(c);
      }
    } catch (e) {
      console.error('unhandled', url.pathname, e);
      const detail = env.APP_ENV === 'dev' ? `\n\n${String(e)}` : '';
      res = new Response('Something went wrong on our side. Please try again in a minute, or email playcoffeetime@yahoo.com.' + detail, { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    if (!isHq) res = await inject(c, res).catch(() => res);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
    if ((h.get('content-type') || '').includes('text/html')) {
      h.set('content-security-policy', csp(c.nonce));
      if (isHq) h.set('cache-control', 'no-store');
      else if (!h.has('cache-control')) h.set('cache-control', 'public, max-age=60, stale-while-revalidate=600');
    }
    if (isHq) h.set('x-robots-tag', 'noindex, nofollow');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  },
  async scheduled(_e: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(ensureDatabase(env.DB).then(() => runWatchdog(env.DB)));
  },
};
