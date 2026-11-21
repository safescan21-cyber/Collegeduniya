import { supabase } from '../supabase.js';
import { sendMail, mailEnabled } from './mailer.js';
import { sendNotification, notifyReady, waNumber } from './whatsapp.js';

// Delivers the notifications outbox (filled by database triggers — migration 012) every minute:
// WhatsApp when the person opted in and the WhatsApp template is configured, otherwise email.
// Anything that can't be delivered stays visible in the dashboard's Notifications tab.
const SITE = (process.env.SITE_URL || 'https://www.collegeolo.com').replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function deliverPending({ limit = 100 } = {}) {
  const { data, error } = await supabase.from('notifications')
    .select('id, title, body, link, attempts, profiles(email, phone, whatsapp, whatsapp_opt_in, is_blocked)')
    .eq('status', 'pending').order('created_at').limit(limit);
  if (error) throw error;
  const stats = { sent: 0, skipped: 0, failed: 0 };
  for (const n of data || []) {
    const p = n.profiles || {};
    const url = n.link ? `${SITE}${n.link}` : SITE;
    const patch = { attempts: n.attempts + 1 };
    try {
      if (p.is_blocked) throw Object.assign(new Error('blocked'), { skip: true });
      const wa = waNumber(p.whatsapp || p.phone);
      if (p.whatsapp_opt_in && wa && notifyReady()) {
        await sendNotification(wa, n.title, `${n.body || ''} ${url}`);
        Object.assign(patch, { status: 'sent', channel: 'whatsapp', sent_at: new Date().toISOString(), error: null });
      } else if (p.email && mailEnabled()) {
        await sendMail({
          to: p.email, subject: n.title,
          text: `${n.body || ''}\n\n${url}\n\nManage notifications: ${SITE}/dashboard?tab=profile`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#4f46e5">${esc(n.title)}</h2><p>${esc(n.body)}</p>
            <p><a href="${esc(url)}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open Collegeolo</a></p>
            <p style="color:#888;font-size:12px"><a href="${SITE}/dashboard?tab=profile">Manage notifications</a></p></div>`,
        });
        Object.assign(patch, { status: 'sent', channel: 'email', sent_at: new Date().toISOString(), error: null });
      } else {
        Object.assign(patch, { status: 'skipped', error: 'No channel (WhatsApp/email not configured or no contact)' });
      }
    } catch (e) {
      Object.assign(patch, e.skip ? { status: 'skipped', error: e.message } : { status: n.attempts + 1 >= 3 ? 'failed' : 'pending', error: String(e.message).slice(0, 300) });
    }
    await supabase.from('notifications').update(patch).eq('id', n.id);
    stats[patch.status === 'sent' ? 'sent' : patch.status === 'pending' || patch.status === 'failed' ? 'failed' : 'skipped']++;
  }
  return stats;
}

export function startNotifier() {
  if (process.env.NOTIFICATIONS === 'off') return;
  const tick = () => deliverPending().then((s) => (s.sent || s.failed) && console.log('[notify]', s)).catch((e) => console.error('[notify]', e.message));
  setTimeout(tick, 15_000);
  setInterval(tick, 60_000).unref();
}
