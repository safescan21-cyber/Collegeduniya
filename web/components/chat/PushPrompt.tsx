'use client';
import { useEffect, useState } from 'react';
import { BellRing, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { enablePush, pushPermission, pushSupported } from '@/lib/push';

const KEY = 'collegeolo:push-prompt';

// "Get notified of new messages" — shown on Messages and Find people until turned on or dismissed (asks again after 14 days)
export default function PushPrompt({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!user || (user as any).is_anonymous || !pushSupported() || pushPermission() !== 'default') return;
    try { const t = Number(localStorage.getItem(KEY) || 0); if (Date.now() - t < 14 * 864e5) return; } catch { /* private mode */ }
    setShow(true);
  }, [user]);
  if (!show || !user) return null;
  const later = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } setShow(false); };
  const on = async () => {
    setBusy(true); const r = await enablePush(user.id); setBusy(false);
    if (r === 'on') { setMsg('Notifications are on ✓'); setTimeout(() => setShow(false), 2500); }
    else if (r === 'denied') { setMsg('Notifications are blocked — allow them in your browser settings.'); later(); }
    else setMsg('Could not turn on notifications on this device.');
  };
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm ${className}`}>
      <BellRing size={20} className="shrink-0 text-brand-600" />
      <p className="flex-1 text-slate-700">{msg || <>Get a notification when someone messages you — even when Collegeolo is closed.</>}</p>
      {!msg && <button onClick={on} disabled={busy} className="btn-primary shrink-0 py-1.5 text-xs">{busy ? <Loader2 size={13} className="animate-spin" /> : null}Turn on</button>}
      <button onClick={later} aria-label="Not now" className="shrink-0 text-slate-400 hover:text-slate-600"><X size={16} /></button>
    </div>
  );
}
