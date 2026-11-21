'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Reply, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';
import Verified from '@/components/campus/Verified';
import ReportButton from './ReportButton';
import { fullDate } from './types';

type C = { id: string; parent_id: string | null; body: string; created_at: string; author_name: string; author_username: string | null; author_verified: boolean; is_mine: boolean; can_delete: boolean };

export default function Comments({ postId, onCount }: { postId: string; onCount?: (n: number) => void }) {
  const { user } = useAuth();
  const sb = supabaseBrowser();
  const [list, setList] = useState<C[] | null>(null);
  const [text, setText] = useState(''); const [replyTo, setReplyTo] = useState<C | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const countRef = useRef(onCount); countRef.current = onCount;
  const load = useCallback(() => sb.rpc('post_comments_list', { p_post: postId }).then(({ data }: { data: C[] | null }) => { setList(data || []); countRef.current?.((data || []).length); }), [sb, postId]);
  useEffect(() => { load(); }, [load]);
  const can = user && !(user as any).is_anonymous;
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); if (!text.trim()) return;
    setBusy(true); setErr('');
    const { error } = await sb.from('post_comments').insert({ post_id: postId, user_id: user!.id, body: text.trim(), parent_id: replyTo?.id || null });
    setBusy(false);
    if (error) return setErr(error.message);
    setText(''); setReplyTo(null); load();
  };
  const del = async (c: C) => { if (!confirm('Delete this comment?')) return; await sb.from('post_comments').delete().eq('id', c.id); load(); };
  const top = (list || []).filter((c) => !c.parent_id);
  const replies = (id: string) => (list || []).filter((c) => c.parent_id === id);
  const Item = ({ c, reply }: { c: C; reply?: boolean }) => (
    <div className={`${reply ? 'ms-8 mt-2' : 'mt-3'} rounded-xl bg-slate-50 px-3 py-2`}>
      <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        {c.author_username ? <Link href={`/u/${c.author_username}`} className="font-semibold text-slate-800 hover:underline">{c.author_name}</Link> : <span className="font-semibold text-slate-800">{c.author_name}</span>}
        <Verified on={c.author_verified} size={12} /><span title={fullDate(c.created_at)}>· {timeAgo(c.created_at)}</span>
      </div>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800">{c.body}</p>
      <div className="mt-1 flex items-center gap-3">
        {can && <button type="button" onClick={() => { setReplyTo(reply ? list!.find((x) => x.id === c.parent_id) || c : c); setText(reply ? `@${c.author_name} ` : ''); }} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700"><Reply size={12} />Reply</button>}
        {c.can_delete && <button type="button" onClick={() => del(c)} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600"><Trash2 size={12} />Delete</button>}
        {!c.is_mine && <ReportButton type="comment" id={c.id} />}
      </div>
    </div>);
  return (
    <div className="border-t border-slate-100 px-4 pb-4">
      {list === null ? <p className="py-3 text-sm text-slate-400"><Loader2 size={14} className="inline animate-spin" /> Loading comments…</p>
        : top.map((c) => <div key={c.id}><Item c={c} />{replies(c.id).map((r) => <Item key={r.id} c={r} reply />)}</div>)}
      {can ? (
        <form onSubmit={send} className="mt-3">
          {replyTo && <p className="mb-1 text-xs text-slate-500">Replying to {replyTo.author_name} <button type="button" onClick={() => { setReplyTo(null); setText(''); }} className="text-brand-700">cancel</button></p>}
          <div className="flex gap-2"><input className="input flex-1 py-2" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={replyTo ? 'Write a reply…' : 'Write a comment…'} />
            <button disabled={busy || !text.trim()} className="btn-primary px-3" aria-label="Send">{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button></div>
          {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
        </form>
      ) : <p className="mt-3 text-sm text-slate-500"><Link href="/login?mode=register&next=/community" className="font-semibold text-brand-700">Log in</Link> to comment and reply.</p>}
    </div>
  );
}
