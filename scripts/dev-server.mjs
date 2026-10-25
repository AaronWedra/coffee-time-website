// Local dev server WITHOUT wrangler: runs the Worker in Node with a D1 shim over node:sqlite and a
// static-asset shim over ./public. Good enough for layout work and smoke tests. Production is Cloudflare.
//   node scripts/dev-server.mjs            -> http://127.0.0.1:8788
//   DB_FILE=.dev.sqlite node scripts/...   -> persistent local DB (default: in-memory, seeded fresh)
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const PORT = parseInt(process.env.PORT || '8788', 10);

// ---- Workers parity: PBKDF2 limit ----
// Cloudflare Workers throw on PBKDF2 above 100,000 iterations; Node does not. Mirror it here.
{
  const orig = crypto.subtle.deriveBits.bind(crypto.subtle);
  crypto.subtle.deriveBits = (alg, key, len) => {
    if (alg && alg.name === 'PBKDF2' && alg.iterations > 100000) return Promise.reject(new Error('NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported'));
    return orig(alg, key, len);
  };
}

// ---- D1 shim ----
class D1Shim {
  constructor(file) {
    this.db = new DatabaseSync(file || ':memory:');
    this.db.exec('PRAGMA foreign_keys=ON');
  }
  migrate() {
    const dir = join(root, 'db/migrations');
    for (const f of readdirSync(dir).sort()) this.db.exec(readFileSync(join(dir, f), 'utf8'));
    this.db.exec(readFileSync(join(root, 'db/seed.sql'), 'utf8'));
  }
  prepare(sql) {
    const db = this.db;
    let args = [];
    const stmt = {
      bind(...a) { args = a.map((x) => (x === undefined ? null : x)); return stmt; },
      async first(col) {
        const row = db.prepare(sql).get(...args) ?? null;
        return col && row ? row[col] : row;
      },
      async all() { return { results: db.prepare(sql).all(...args), success: true, meta: {} }; },
      async run() {
        const r = db.prepare(sql).run(...args);
        return { success: true, meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
      },
    };
    return stmt;
  }
  async batch(stmts) { return Promise.all(stmts.map((s) => s.run())); }
  async exec(sql) { this.db.exec(sql); return { count: 0, duration: 0 }; }
}

// ---- static assets shim ----
const TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain', '.xml': 'application/xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const ASSETS = {
  async fetch(req) {
    const u = new URL(req.url);
    const p = join(root, 'public', decodeURIComponent(u.pathname));
    if (!p.startsWith(join(root, 'public')) || !existsSync(p) || !statSync(p).isFile()) return new Response('not found', { status: 404 });
    return new Response(readFileSync(p), { headers: { 'content-type': TYPES[extname(p)] || 'application/octet-stream' } });
  },
};

// ---- load the worker ----
// Imports use explicit .ts extensions, so Node (22.18+ / 24) runs the TypeScript directly by stripping
// types. No bundler needed locally; Cloudflare bundles it with esbuild on deploy.
const worker = (await import(pathToFileURL(join(root, 'src/worker.ts')).href)).default;

const DB = new D1Shim(process.env.DB_FILE);
// Schema + seed are applied by the Worker itself (src/db/bootstrap.ts), exactly as in production.

// In-memory stand-in for the R2 bucket (binding MEDIA).
const blobs = new Map();
const MEDIA = {
  async put(key, value, opts) { const buf = value instanceof ArrayBuffer ? value : await new Response(value).arrayBuffer(); blobs.set(key, { buf, type: opts?.httpMetadata?.contentType || 'application/octet-stream' }); },
  async get(key) { const b = blobs.get(key); return b ? { body: new Response(b.buf).body, httpMetadata: { contentType: b.type }, size: b.buf.byteLength } : null; },
  async delete(key) { blobs.delete(key); },
};
const env = { DB, ASSETS, MEDIA, APP_ENV: 'dev', SITE_URL: process.env.SITE_URL || '', HQ_SETUP_TOKEN: process.env.HQ_SETUP_TOKEN || 'dev', NOTIFY_TO: '' };

createServer(async (req, res) => {
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, { method: req.method, headers, body, duplex: 'half' });
  const pending = [];
  const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };
  try {
    const r = await worker.fetch(request, env, ctx);
    const hd = Object.fromEntries(r.headers); const sc = r.headers.getSetCookie?.(); if (sc && sc.length) hd['set-cookie'] = sc;
    res.writeHead(r.status, hd);
    res.end(Buffer.from(await r.arrayBuffer()));
    await Promise.allSettled(pending);
  } catch (e) {
    console.error(e);
    res.writeHead(500); res.end(String(e));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`dev server http://127.0.0.1:${PORT}  (HQ setup token: ${env.HQ_SETUP_TOKEN})`));
