// Hourly watchdog: finds requests whose newest message is from the team (not us) and is over 3 hours old,
// and records them for the dashboard banner. No email on purpose; the banner is the alarm.
import { setSetting } from '../lib/db.ts';
import { notOurs } from './board.ts';

export async function runWatchdog(d: D1Database): Promise<void> {
  const rows = (
    await d
      .prepare(
        `SELECT r.id, r.title, m.created_at AS last_at FROM requests r
         JOIN request_messages m ON m.id = (SELECT MAX(id) FROM request_messages WHERE request_id = r.id)
         WHERE r.status NOT IN ('done','archived') AND ${notOurs('m.author')}
           AND m.created_at < datetime('now','-3 hours') ORDER BY m.created_at LIMIT 20`,
      )
      .all<{ id: number; title: string; last_at: string }>()
  ).results;
  const now = Date.now();
  const stale = rows.map((r) => ({ id: r.id, title: r.title, hours: Math.floor((now - Date.parse(r.last_at.replace(' ', 'T') + 'Z')) / 3600000) }));
  await setSetting(d, 'watchdog_stale', JSON.stringify(stale));
  await setSetting(d, 'watchdog_last_run', new Date().toISOString());
}
