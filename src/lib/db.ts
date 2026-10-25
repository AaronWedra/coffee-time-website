// All D1 reads and writes go through here.

export type Settings = Record<string, string>;
export type Block = { key: string; label: string; kind: string; value: string; page: string; sort: number };
export type Review = { id: number; name: string; role: string; quote: string; sort: number; published: number };
export type News = { id: number; date_label: string; title: string; body: string; images: string; video: string; url: string; link_label: string; sort: number; published: number };
export type Faq = { id: number; question: string; answer: string; sort: number; published: number };
export type Tutorial = { id: number; num: string; title: string; body: string; youtube_id: string; sort: number; published: number };
export type Track = { id: number; title: string; url: string; sort: number; published: number };
export type Game = { id: number; title: string; blurb: string; note: string; url: string; button: string; image: string; sort: number; published: number };
export type Creator = { id: number; name: string; role: string; place: string; bio: string; url: string; image: string; sort: number; published: number };
export type Order = { id: number; name: string; email: string; phone: string; quantity: number; address: string; notes: string; newsletter: number; status: string; staff_notes: string; ip: string; created_at: string; updated_at: string };
export type Subscriber = { id: number; email: string; source: string; ip: string; created_at: string; unsubscribed_at: string | null };
export type Staff = { id: number; name: string; pass_hash: string; role: string; created_at: string; last_login_at: string | null };

export const ORDER_STATUSES: { key: string; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Emailed' },
  { key: 'paid', label: 'Paid' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'cancelled', label: 'Cancelled' },
];

export async function getSettings(db: D1Database): Promise<Settings> {
  const r = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const out: Settings = {};
  for (const row of r.results) out[row.key] = row.value;
  return out;
}

export async function setSetting(db: D1Database, key: string, value: string) {
  await db
    .prepare("INSERT INTO settings(key,value,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
    .bind(key, value)
    .run();
}

export async function getBlocks(db: D1Database): Promise<Record<string, Block>> {
  const r = await db.prepare('SELECT * FROM blocks ORDER BY page, sort').all<Block>();
  const out: Record<string, Block> = {};
  for (const b of r.results) out[b.key] = b;
  return out;
}

export async function setBlock(db: D1Database, key: string, value: string) {
  await db.prepare("UPDATE blocks SET value=?, updated_at=datetime('now') WHERE key=?").bind(value, key).run();
}

function list<T>(table: string, order = 'sort, id') {
  return (db: D1Database, all = false) =>
    db.prepare(`SELECT * FROM ${table} ${all ? '' : 'WHERE published=1'} ORDER BY ${order}`).all<T>().then((r) => r.results);
}

export const listReviews = list<Review>('reviews');
export const listNews = list<News>('news');
export const listFaqs = list<Faq>('faqs');
export const listTutorials = list<Tutorial>('tutorials');
export const listTracks = list<Track>('tracks');
export const listGames = list<Game>('games');
export const listCreators = list<Creator>('creators');

export async function insertOrder(db: D1Database, o: Pick<Order, 'name' | 'email' | 'phone' | 'quantity' | 'address' | 'notes' | 'newsletter' | 'ip'>): Promise<number> {
  const r = await db
    .prepare('INSERT INTO orders(name,email,phone,quantity,address,notes,newsletter,ip) VALUES(?,?,?,?,?,?,?,?) RETURNING id')
    .bind(o.name, o.email, o.phone, o.quantity, o.address, o.notes, o.newsletter, o.ip)
    .first<{ id: number }>();
  return r!.id;
}

// Adds an email to the newsletter list. Re-subscribing clears an earlier unsubscribe. Returns true when new.
export async function subscribe(db: D1Database, email: string, source: string, ip: string): Promise<boolean> {
  const existing = await db.prepare('SELECT id, unsubscribed_at FROM subscribers WHERE lower(email)=lower(?)').bind(email).first<{ id: number; unsubscribed_at: string | null }>();
  if (existing) {
    if (existing.unsubscribed_at) await db.prepare('UPDATE subscribers SET unsubscribed_at=NULL WHERE id=?').bind(existing.id).run();
    return false;
  }
  await db.prepare('INSERT INTO subscribers(email,source,ip) VALUES(?,?,?)').bind(email, source, ip).run();
  return true;
}

export async function audit(db: D1Database, who: string, what: string, detail = '') {
  await db.prepare('INSERT INTO audit_log(who,what,detail) VALUES(?,?,?)').bind(who, what, detail.slice(0, 2000)).run();
}

// Fixed-window rate limit stored in D1. Returns true when the caller is over the limit.
export async function overLimit(db: D1Database, key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare('SELECT count, window_start FROM rate_limits WHERE key=?').bind(key).first<{ count: number; window_start: number }>();
  if (!row || now - row.window_start >= windowSec) {
    await db.prepare('INSERT INTO rate_limits(key,count,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1, window_start=excluded.window_start').bind(key, now).run();
    return false;
  }
  await db.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').bind(key).run();
  return row.count + 1 > limit;
}
