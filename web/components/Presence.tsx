'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

function sessionId() {
  try {
    let id = sessionStorage.getItem('ses_sid');
    if (!id) { id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, ''); sessionStorage.setItem('ses_sid', id); }
    return id;
  } catch { return 'tmp' + Math.random().toString(36).slice(2, 12); }
}

// Heartbeat every 60 s while the tab is visible → admins see who is online
export function PresencePing() {
  const path = usePathname();
  const { user } = useAuth();
  const pathRef = useRef(path); pathRef.current = path;
  useEffect(() => {
    const send = () => { if (document.visibilityState === 'visible') api('/api/presence', { method: 'POST', body: JSON.stringify({ session_id: sessionId(), path: pathRef.current }) }).catch(() => undefined); };
    send();
    const t = setInterval(send, 60_000);
    const vis = () => { if (document.visibilityState === 'visible') send(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [user?.id]);
  return null;
}

type Ev = { id: string; display: string | null; city: string | null; created_at: string };
const HIDE_ON = ['/admin', '/mock-tests/attempt', '/login'];

// Silent "… is online" alerts (no sound): first names only for students who opted in, otherwise "A student"
export function OnlineAlerts() {
  const path = usePathname();
  const { profile } = useAuth();
  const [toast, setToast] = useState<(Ev & { n: number }) | null>(null);
  const [off, setOff] = useState(true);
  const since = useRef<string>(new Date(Date.now() - 120_000).toISOString());   // include people who arrived in the last 2 minutes
  const shown = useRef<Set<string>>(new Set());
  const queue = useRef<Ev[]>([]);
  const count = useRef(0);

  useEffect(() => { try { setOff(localStorage.getItem('ses-online-alerts') === 'off'); } catch { setOff(false); } }, []);
  const hidden = off || HIDE_ON.some((p) => path?.startsWith(p));

  useEffect(() => {
    if (hidden) return;
    const sb = supabaseBrowser();
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      const [{ data }, { data: n }] = await Promise.all([sb.rpc('recent_online', { p_since: since.current }), sb.rpc('online_count')]);
      count.current = Number(n) || 0;
      const me = (profile?.full_name || '').split(' ')[0];
      for (const e of ((data || []) as Ev[]).reverse()) {
        if (shown.current.has(e.id)) continue;
        shown.current.add(e.id);
        if (e.created_at > since.current) since.current = e.created_at;
        if (me && e.display === me && (!e.city || e.city === profile?.city)) continue;   // that's probably me
        queue.current.push(e);
      }
    };
    poll();
    const p = setInterval(poll, 25_000);
    // show at most one alert every 20 s, each for 6 s
    const s = setInterval(() => {
      const next = queue.current.shift();
      if (next) { setToast({ ...next, n: count.current }); setTimeout(() => setToast((t) => (t?.id === next.id ? null : t)), 6000); }
      if (queue.current.length > 3) queue.current = queue.current.slice(-3);
    }, 20_000);
    const first = setTimeout(() => { const n = queue.current.shift(); if (n) { setToast({ ...n, n: count.current }); setTimeout(() => setToast(null), 6000); } }, 4000);
    return () => { clearInterval(p); clearInterval(s); clearTimeout(first); };
  }, [hidden, profile?.full_name, profile?.city]);

  if (hidden || !toast) return null;
  const who = toast.display || 'A student';
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 start-4 z-40 flex max-w-xs items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur motion-safe:animate-[fadein_.3s_ease-out]">
      <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
      <div className="min-w-0">
        <p className="text-slate-800"><b>{who}</b>{toast.city ? ` from ${toast.city}` : ''} is online</p>
        {toast.n > 1 && <p className="text-xs text-slate-500">{toast.n.toLocaleString()} students on StudyEarnstay right now</p>}
      </div>
      <button onClick={() => { setToast(null); try { localStorage.setItem('ses-online-alerts', 'off'); } catch { /* ignore */ } setOff(true); }}
        className="ms-1 shrink-0 text-slate-400 hover:text-slate-700" aria-label="Hide online alerts" title="Hide these alerts"><X size={15} /></button>
    </div>
  );
}
