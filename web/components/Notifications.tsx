'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

type N = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string; channel: string | null };

// Header bell with unread count
export function NotificationBell() {
  const { user } = useAuth();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!user) return;
    const sb = supabaseBrowser();
    const load = () => sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null)
      .then(({ count }: { count: number | null }) => setN(count || 0));
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [user]);
  if (!user) return null;
  return (
    <Link href="/dashboard?tab=notifications" className="btn-ghost relative px-3" aria-label={`Notifications${n ? ` (${n} unread)` : ''}`}>
      <Bell size={16} />
      {n > 0 && <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{n > 9 ? '9+' : n}</span>}
    </Link>
  );
}

// Dashboard → Notifications
export function NotificationList() {
  const { user } = useAuth();
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<N[] | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await sb.from('notifications').select('id, title, body, link, read_at, created_at, channel').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    setRows((data || []) as N[]);
  }, [user, sb]);
  useEffect(() => { load(); }, [load]);
  const markAll = async () => {
    if (!user) return;
    await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    load();
  };
  const open = (x: N) => { if (!x.read_at) sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', x.id).then(() => undefined); };
  if (!rows) return <div className="card h-40 animate-pulse" />;
  if (!rows.length) return <div className="card p-10 text-center text-slate-500">No notifications yet. Application updates, visit requests and messages will show up here.</div>;
  return (
    <div className="space-y-3">
      {rows.some((r) => !r.read_at) && <button onClick={markAll} className="btn-ghost text-sm"><CheckCheck size={15} />Mark all as read</button>}
      <div className="card divide-y divide-slate-100">
        {rows.map((x) => (
          <Link key={x.id} href={x.link || '/dashboard'} onClick={() => open(x)} className={`flex gap-3 p-4 hover:bg-slate-50 ${x.read_at ? '' : 'bg-brand-50/40'}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${x.read_at ? 'bg-transparent' : 'bg-brand-600'}`} />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{x.title}</p>
              {x.body && <p className="text-sm text-slate-600">{x.body}</p>}
              <p className="mt-0.5 text-xs text-slate-400">{timeAgo(x.created_at)}{x.channel ? ` · sent by ${x.channel === 'whatsapp' ? 'WhatsApp' : 'email'}` : ''}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
