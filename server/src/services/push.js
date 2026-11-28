import webpush from 'web-push';
import { supabase } from '../supabase.js';
import { saveSecret } from './secrets.js';

// Phone / browser notifications (Web Push). The server makes its own key pair once (VAPID) and keeps it in app_secrets,
// so no one has to create or paste a key. Browsers subscribe from the site (push_subscriptions); the notifier sends
// new-message and chat-request notifications here first.
let ready = false;

export async function initPush() {
  try {
    let pub = process.env.VAPID_PUBLIC_KEY; let priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) {
      const k = webpush.generateVAPIDKeys(); pub = k.publicKey; priv = k.privateKey;
      try { await saveSecret('VAPID_PRIVATE_KEY', priv); await saveSecret('VAPID_PUBLIC_KEY', pub); console.log('[push] created notification keys'); }
      catch (e) { console.warn('[push] keys could not be saved — subscriptions will reset on restart:', e.message); process.env.VAPID_PUBLIC_KEY = pub; process.env.VAPID_PRIVATE_KEY = priv; }
    }
    const contact = (process.env.MAIL_FROM || '').match(/[\w.+-]+@[\w.-]+/)?.[0] || 'support@collegeolo.com';
    webpush.setVapidDetails(`mailto:${contact}`, pub, priv);
    ready = true;
  } catch (e) { console.warn('[push] off:', e.message); }
}

export const pushReady = () => ready;
export const pushPublicKey = () => (ready ? process.env.VAPID_PUBLIC_KEY : null);

// Send to every browser / phone the person turned notifications on in. Returns how many got it.
export async function pushToUser(userId, { title, body = '', url = '/', tag } = {}) {
  if (!ready || !userId) return 0;
  const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth, failures').eq('user_id', userId).limit(10);
  if (!subs?.length) return 0;
  const payload = JSON.stringify({ title: String(title).slice(0, 120), body: String(body || '').slice(0, 240), url: url.startsWith('/') ? url : '/', tag: tag || undefined });
  let ok = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high', timeout: 10000 });
      ok++;
      await supabase.from('push_subscriptions').update({ last_ok_at: new Date().toISOString(), failures: 0 }).eq('id', s.id);
    } catch (e) {
      // 404 / 410: the browser dropped this subscription (app removed, permission revoked) → forget it
      if (e.statusCode === 404 || e.statusCode === 410 || s.failures >= 4) await supabase.from('push_subscriptions').delete().eq('id', s.id);
      else await supabase.from('push_subscriptions').update({ failures: s.failures + 1 }).eq('id', s.id);
    }
  }));
  return ok;
}
