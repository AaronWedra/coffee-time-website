// Creates the schema and seeds content on first request, and applies any migration not yet recorded.
// Runs once per Worker isolate (cheap: one SELECT when already set up).
import { MIGRATIONS, SEED } from './bundled.ts';

let ready: Promise<void> | null = null;

export function ensureDatabase(db: D1Database): Promise<void> {
  if (!ready) ready = run(db).catch((e) => { ready = null; throw e; });
  return ready;
}

async function run(db: D1Database) {
  await db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')))');
  const done = new Set((await db.prepare('SELECT name FROM _migrations').all<{ name: string }>()).results.map((r) => r.name));
  let changed = false;
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    await runAll(db, m.sql);
    await db.prepare('INSERT INTO _migrations(name) VALUES(?)').bind(m.name).run();
    changed = true;
  }
  if (changed || !done.has('seed')) {
    // INSERT OR IGNORE throughout: safe to re-run, never overwrites HQ edits.
    await runAll(db, SEED);
    await db.prepare("INSERT OR IGNORE INTO _migrations(name) VALUES('seed')").run();
  }
}

// Split SQL into statements (respecting '...' string literals with '' escapes), strip comments,
// and run them as prepared statements in batches. Avoids D1 exec()'s line-splitting quirks.
export function splitSql(sql: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inStr) {
      cur += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") { cur += "'"; i++; } else inStr = false;
      }
      continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (ch === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function runAll(db: D1Database, sql: string) {
  const stmts = splitSql(sql);
  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50).map((q) => db.prepare(q)));
  }
}
