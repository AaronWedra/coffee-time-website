// The single email seam. Every message is written to `outbox` first; it is only sent when
// RESEND_API_KEY and MAIL_FROM are configured. Without them the row is marked `simulated`
// and the message still lives in HQ, so nothing is lost.
import type { Env } from './router.ts';

export async function sendEmail(env: Env, to: string, subject: string, body: string): Promise<'sent' | 'simulated' | 'failed'> {
  const id = (
    await env.DB.prepare('INSERT INTO outbox(to_addr,subject,body) VALUES(?,?,?) RETURNING id').bind(to, subject, body).first<{ id: number }>()
  )!.id;
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    await env.DB.prepare("UPDATE outbox SET status='simulated' WHERE id=?").bind(id).run();
    return 'simulated';
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text: body }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await env.DB.prepare("UPDATE outbox SET status='sent', sent_at=datetime('now') WHERE id=?").bind(id).run();
    return 'sent';
  } catch (e) {
    await env.DB.prepare("UPDATE outbox SET status='failed', error=? WHERE id=?").bind(String(e).slice(0, 500), id).run();
    return 'failed';
  }
}
