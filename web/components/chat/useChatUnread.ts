'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

// Unread chats + group messages + new chat requests, for the badge on the header and the bottom bar.
// Refreshes when a message arrives (event from MessageAlert), when the tab comes back, on navigation and every minute.
export function useChatUnread(pathname?: string | null) {
  const { user } = useAuth();
  const [n, setN] = useState(0);
  const on = !!user && !(user as any).is_anonymous;
  useEffect(() => {
    if (!on) { setN(0); return; }
    let live = true;
    const load = () => supabaseBrowser().rpc('chat_unread_total').then(({ data }: { data: { chats: number; groups: number; requests: number }[] | null }) => {
      const r = data?.[0]; if (live) setN(r ? r.chats + r.groups + r.requests : 0);
    });
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 60_000);
    const vis = () => { if (!document.hidden) load(); };
    window.addEventListener('collegeolo:chat', load); document.addEventListener('visibilitychange', vis);
    return () => { live = false; clearInterval(t); window.removeEventListener('collegeolo:chat', load); document.removeEventListener('visibilitychange', vis); };
  }, [on, pathname]);
  return n;
}

export const badge = (n: number) => (n > 99 ? '99+' : String(n));
