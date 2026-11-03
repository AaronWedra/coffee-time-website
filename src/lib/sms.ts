// Text-message alerts for new orders, through Twilio. Off until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_FROM and NOTIFY_SMS_TO are all set. Every attempt is written to `outbox` like email is,
// so HQ > Sent email shows what was texted. Never throws: a failed text must not fail an order.
import type { Env } from './router.ts';

export function smsConfigured(env: Env): boolean {
  return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM && env.NOTIFY_SMS_TO);
}

export async function sendSms(env: Env, body: string): Promise<'sent' | 'off' | 'failed'> {
  if (!smsConfigured(env)) return 'off';
  const to = env.NOTIFY_SMS_TO!;
  const id = (
    await env.DB.prepare('INSERT INTO outbox(to_addr,subject,body) VALUES(?,?,?) RETURNING id').bind(to, 'Text message', body).first<{ id: number }>()
  )!.id;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: env.TWILIO_FROM!, Body: body.slice(0, 300) }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await env.DB.prepare("UPDATE outbox SET status='sent', sent_at=datetime('now') WHERE id=?").bind(id).run();
    return 'sent';
  } catch (e) {
    await env.DB.prepare("UPDATE outbox SET status='failed', error=? WHERE id=?").bind(String(e).slice(0, 500), id).run();
    return 'failed';
  }
}
