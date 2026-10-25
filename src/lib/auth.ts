// HQ staff auth: PBKDF2 password hashes, D1-backed sessions, CSRF token per session.
import type { Ctx } from './router.ts';
import { parseCookies, randomToken } from './router.ts';
import type { Staff } from './db.ts';

export const COOKIE = 'hq_session';
const SESSION_DAYS = 14;
// Cloudflare Workers reject PBKDF2 above 100,000 iterations (NotSupportedError). scripts/dev-server.mjs mirrors this limit.
const PBKDF2_ITER = 100_000;

function b64(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

async function derive(password: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const out = await derive(password, salt, PBKDF2_ITER);
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(out)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterS, saltB, hashB] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  const out = await derive(password, unb64(saltB), parseInt(iterS, 10));
  const want = unb64(hashB);
  if (out.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < out.length; i++) diff |= out[i] ^ want[i];
  return diff === 0;
}

export type Session = { id: string; staff: Staff; csrf: string };

export async function currentSession(c: Ctx): Promise<Session | null> {
  const id = parseCookies(c.req)[COOKIE];
  if (!id) return null;
  const row = await c.env.DB.prepare(
    `SELECT s.id AS sid, s.csrf, st.* FROM sessions s JOIN staff st ON st.id = s.staff_id WHERE s.id = ? AND s.expires_at > datetime('now')`,
  )
    .bind(id)
    .first<Staff & { sid: string; csrf: string }>();
  if (!row) return null;
  const { sid, csrf, ...staff } = row;
  return { id: sid, csrf, staff: staff as Staff };
}

export async function startSession(c: Ctx, staffId: number): Promise<{ cookie: string }> {
  const id = randomToken(32);
  const csrf = randomToken(16);
  await c.env.DB.prepare(`INSERT INTO sessions(id, staff_id, csrf, expires_at) VALUES(?,?,?, datetime('now', ?))`)
    .bind(id, staffId, csrf, `+${SESSION_DAYS} days`)
    .run();
  await c.env.DB.prepare(`UPDATE staff SET last_login_at = datetime('now') WHERE id = ?`).bind(staffId).run();
  const secure = c.url.protocol === 'https:' ? '; Secure' : '';
  return { cookie: `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}` };
}

// Clears the cookie at both paths: sessions began life at /hq and now live at / (so the public site can
// tell a signed-in teammate from a visitor for Edit website mode).
export async function endSession(c: Ctx): Promise<string[]> {
  const id = parseCookies(c.req)[COOKIE];
  if (id) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
  return [`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`, `${COOKIE}=; Path=/hq; HttpOnly; SameSite=Lax; Max-Age=0`, 'hq_review=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'];
}

export async function staffCount(db: D1Database): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM staff').first<{ n: number }>();
  return r?.n ?? 0;
}
