// Minimal router for a Cloudflare Worker. Patterns like "/worlds/:slug". No dependencies.

export type Env = {
  DB: D1Database;
  MEDIA?: R2Bucket;
  ASSETS: Fetcher;
  APP_ENV?: string;
  SITE_URL?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  NOTIFY_TO?: string;
  HQ_SETUP_TOKEN?: string;
};

export type Ctx = {
  req: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
  waitUntil: (p: Promise<unknown>) => void;
  // filled by middleware
  nonce: string;
  ip: string;
  state: Record<string, unknown>;
};

export type Handler = (c: Ctx) => Promise<Response> | Response;

type Route = { method: string; re: RegExp; keys: string[]; h: Handler };

export class Router {
  private routes: Route[] = [];
  private add(method: string, pattern: string, h: Handler) {
    const keys: string[] = [];
    const re = new RegExp(
      '^' +
        pattern
          .replace(/\/+$/, '')
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/:([a-zA-Z_]+)/g, (_m, k) => {
            keys.push(k);
            return '([^/]+)';
          }) +
        '/?$',
    );
    this.routes.push({ method, re, keys, h });
    return this;
  }
  get = (p: string, h: Handler) => this.add('GET', p, h);
  post = (p: string, h: Handler) => this.add('POST', p, h);
  match(method: string, path: string): { h: Handler; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.method !== method && !(r.method === 'GET' && method === 'HEAD')) continue;
      const m = r.re.exec(path);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { h: r.h, params };
    }
    return null;
  }
}

export function redirect(to: string, status = 302): Response {
  return new Response(null, { status, headers: { location: to } });
}

export function page(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(body, { ...init, headers });
}

export function text(body: string, status = 200, type = 'text/plain; charset=utf-8'): Response {
  return new Response(body, { status, headers: { 'content-type': type } });
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const c = req.headers.get('cookie');
  if (!c) return out;
  for (const part of c.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export async function formData(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get('content-type') || '';
  const out: Record<string, string> = {};
  if (ct.includes('application/json')) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    for (const k in j) out[k] = typeof j[k] === 'string' ? (j[k] as string) : JSON.stringify(j[k]);
    return out;
  }
  const fd = await req.formData().catch(() => null);
  if (!fd) return out;
  fd.forEach((v, k) => {
    if (typeof v === 'string') out[k] = v;
  });
  return out;
}
