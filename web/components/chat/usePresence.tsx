'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export type Presence = { online: boolean; last_seen: string };

// Live "Active now / last seen" for the people on screen (chat partners, group members). Refreshes every 30 s.
// The database only answers for people who share a chat or group with you and allow it (Profile → "Show when I'm active").
export function usePresence(ids: (string | null | undefined)[]) {
  const key = useMemo(() => Array.from(new Set(ids.filter(Boolean) as string[])).sort().join(','), [ids]);
  const [map, setMap] = useState<Record<string, Presence>>({});
  useEffect(() => {
    if (!key) { setMap({}); return; }
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      const { data } = await supabaseBrowser().rpc('chat_presence', { p_users: key.split(',') });
      if (!stop) setMap(Object.fromEntries(((data || []) as any[]).map((r) => [r.user_id, { online: !!r.online, last_seen: r.last_seen }])));
    };
    load(); const t = setInterval(load, 30000);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [key]);
  return map;
}

export function lastSeenText(p?: Presence | null) {
  if (!p) return null;
  if (p.online) return 'Active now';
  const d = new Date(p.last_seen); const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `Active ${Math.max(mins, 1)} min ago`;
  const sameDay = d.toDateString() === new Date().toDateString();
  const yest = new Date(Date.now() - 864e5).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `Last seen today at ${time}` : yest ? `Last seen yesterday at ${time}` : `Last seen ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

export function OnlineDot({ on, className = '' }: { on?: boolean; className?: string }) {
  if (!on) return null;
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-2 ring-white ${className}`} title="Active now" aria-label="Active now" />;
}
