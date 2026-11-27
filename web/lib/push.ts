'use client';
import { supabaseBrowser } from './supabase/client';
import { API_URL } from './api';

// Turn on phone / browser notifications for new messages: ask permission, subscribe through the service worker,
// save the subscription for this account. iPhone: only works after "Add to Home Screen" (iOS 16.4+).
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushPermission = () => (pushSupported() ? Notification.permission : 'denied');

const b64ToBytes = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function enablePush(userId: string): Promise<'on' | 'denied' | 'unsupported' | 'error'> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const { key } = await fetch(`${API_URL}/api/push/key`).then((r) => r.json());
    if (!key) return 'error';
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const sb = supabaseBrowser();
    const { error } = await sb.from('push_subscriptions').insert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 300) });
    if (error && error.code !== '23505') return 'error';   // 23505: this browser is already saved
    return 'on';
  } catch { return 'error'; }
}
