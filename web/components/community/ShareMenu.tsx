'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Link2, Loader2, MessagesSquare, Share2, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { api } from '@/lib/api';

type Chat = { id: string; status: string; other_name: string; group?: boolean; emoji?: string };

// Share = the only way content leaves the site: send it to a friend's chat, or share the link through the phone's apps.
// Nothing is downloaded — the friend opens it on Collegeolo.
export default function ShareMenu({ postId, text, path, onShared, onClose }: { postId: string; text: string; path?: string; onShared: (n: number) => void; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [sent, setSent] = useState<string[]>([]); const [busy, setBusy] = useState(''); const [copied, setCopied] = useState(false);
  const url = `${typeof location !== 'undefined' ? location.origin : 'https://www.collegeolo.com'}${path || `/community/post/${postId}`}`;   // shots: their own page
  const loggedIn = !!user && !(user as any).is_anonymous;
  const canShare = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';
  const counted = async () => { const { data } = await sb.rpc('share_post', { p_post: postId }); if (typeof data === 'number') onShared(data); };

  const openChats = async () => {
    if (!loggedIn) return router.push('/login?next=/community');
    const [{ data }, { data: gs }] = await Promise.all([sb.rpc('my_inbox'), sb.rpc('my_groups')]);
    setChats([...((gs || []) as any[]).map((g) => ({ id: g.id, status: 'active', other_name: g.name, group: true, emoji: g.emoji })),
              ...((data || []) as Chat[]).filter((c) => c.status === 'active')]);
  };
  const sendTo = async (c: Chat) => {
    setBusy(c.id);
    const body = `${text ? `${text.slice(0, 120)}\n` : ''}${url}`;
    const { error } = c.group ? await sb.from('group_messages').insert({ group_id: c.id, sender_id: user!.id, body })
      : await sb.from('messages').insert({ conversation_id: c.id, sender_id: user!.id, body });
    setBusy('');
    if (error) return alert(/row-level|policy/i.test(error.message) ? 'You can’t message this person right now.' : error.message);
    setSent((s) => [...s, c.id]); counted();
    if (!c.group) api('/api/notify/message', { method: 'POST', body: JSON.stringify({ conversation_id: c.id }) }).catch(() => {});
  };
  const apps = async () => {
    try {
      if (canShare) await navigator.share({ title: text || 'Post on Collegeolo', url });
      else { await navigator.clipboard.writeText(url); setCopied(true); }
      counted();
    } catch { /* closed the share sheet */ }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 text-slate-800 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><p className="font-bold">Share</p><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {chats === null ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={openChats} className="flex flex-col items-center gap-1 rounded-xl bg-brand-50 p-4 text-sm font-semibold text-brand-700 hover:bg-brand-100"><MessagesSquare size={22} />Send in chat</button>
            <button onClick={apps} className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 p-4 text-sm font-semibold hover:bg-slate-100">{copied ? <Check size={22} /> : canShare ? <Share2 size={22} /> : <Link2 size={22} />}{copied ? 'Link copied' : canShare ? 'WhatsApp & apps' : 'Copy link'}</button>
          </div>
        ) : chats.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No chats or groups yet — start one under Messages.</p> : (
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">{chats.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2">
              <span className="truncate text-sm font-medium">{c.group ? `${c.emoji} ` : ''}{c.other_name}{c.group && <span className="ms-1 text-[10px] text-slate-400">group</span>}</span>
              {sent.includes(c.id) ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><Check size={14} />Sent</span>
                : <button onClick={() => sendTo(c)} disabled={!!busy} className="btn-primary py-1 text-xs">{busy === c.id ? <Loader2 size={13} className="animate-spin" /> : 'Send'}</button>}
            </li>))}</ul>)}
        <p className="mt-3 text-[11px] text-slate-400">Photos and videos can’t be downloaded — friends open them on Collegeolo.</p>
      </div>
    </div>
  );
}
