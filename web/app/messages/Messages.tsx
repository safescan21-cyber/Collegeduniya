'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Ban, Flag, ArrowLeft, MessagesSquare, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

type Conv = { id: string; context_type: string; context_id: string; context_label: string | null; other_id: string; other_name: string; last_message: string | null; last_message_at: string; unread: number };
type Msg = { id: string; sender_id: string; body: string; created_at: string; read_at: string | null };

export default function Messages() {
  const { user, loading } = useAuth();
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get('c');
  const [convs, setConvs] = useState<Conv[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(async () => {
    const { data } = await supabase.rpc('my_conversations');
    setConvs((data || []) as Conv[]);
  }, [supabase]);
  const loadMsgs = useCallback(async () => {
    if (!active || !user) return;
    const { data } = await supabase.from('messages').select('id, sender_id, body, created_at, read_at').eq('conversation_id', active).order('created_at').limit(500);
    setMsgs((data || []) as Msg[]);
    const unread = (data || []).filter((m: Msg) => m.sender_id !== user.id && !m.read_at).map((m: Msg) => m.id);
    if (unread.length) { await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread); loadConvs(); }
  }, [active, supabase, user, loadConvs]);

  useEffect(() => { if (user) loadConvs(); }, [user, loadConvs]);
  useEffect(() => { loadMsgs(); const t = setInterval(() => { loadMsgs(); loadConvs(); }, 8000); return () => clearInterval(t); }, [loadMsgs, loadConvs]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  if (loading) return <div className="card h-96 animate-pulse" />;
  if (!user) return <div className="py-20 text-center"><Link href="/login?next=/messages" className="btn-primary">Login to see your messages</Link></div>;

  const conv = convs.find((c) => c.id === active);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !active) return;
    setBusy(true);
    const { error } = await supabase.from('messages').insert({ conversation_id: active, sender_id: user.id, body });
    setBusy(false);
    if (error) return alert(/row-level|policy/i.test(error.message) ? 'You can’t message this person.' : error.message);
    setText('');
    api('/api/notify/message', { method: 'POST', body: JSON.stringify({ conversation_id: active }) }).catch(() => {});
    loadMsgs(); loadConvs();
  };
  const block = async () => {
    if (!conv || !confirm(`Block ${conv.other_name}? They won’t be able to message you.`)) return;
    await supabase.from('user_blocks').insert({ blocker_id: user.id, blocked_id: conv.other_id });
    alert('Blocked.');
  };
  const report = async () => {
    if (!conv) return;
    const reason = prompt('What’s wrong? (spam, harassment, fake, asking for money…)');
    if (!reason) return;
    await supabase.from('reports').insert({ reporter_id: user.id, target_type: 'user', target_id: conv.other_id, reason: `${reason} [conversation ${conv.id}]` });
    alert('Thanks — our team will review it.');
  };

  return (
    <div className="card grid h-[75vh] overflow-hidden md:grid-cols-[300px_1fr]">
      <aside className={`${active ? 'hidden md:block' : ''} overflow-y-auto border-e border-slate-100`}>
        <p className="flex items-center gap-2 border-b border-slate-100 p-4 font-bold text-slate-900"><MessagesSquare size={18} />Messages</p>
        {convs.map((c) => (
          <button key={c.id} onClick={() => router.push(`/messages?c=${c.id}`)} className={`block w-full border-b border-slate-50 p-4 text-start hover:bg-slate-50 ${c.id === active ? 'bg-brand-50' : ''}`}>
            <p className="flex items-center justify-between font-semibold text-slate-900">{c.other_name}{c.unread > 0 && <span className="rounded-full bg-brand-600 px-2 text-xs text-white">{c.unread}</span>}</p>
            <p className="truncate text-xs text-slate-500">{c.context_label}</p>
            <p className="truncate text-sm text-slate-600">{c.last_message || 'No messages yet'}</p>
          </button>
        ))}
        {!convs.length && <p className="p-6 text-sm text-slate-500">No conversations yet. Message seniors from a college page, or answer a roommate post.</p>}
      </aside>
      <section className={`${active ? 'flex' : 'hidden md:flex'} min-h-0 flex-col`}>
        {conv ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4">
              <div className="flex items-center gap-2">
                <button onClick={() => router.push('/messages')} className="md:hidden" aria-label="Back"><ArrowLeft size={18} /></button>
                <div><p className="font-bold text-slate-900">{conv.other_name}</p><p className="text-xs text-slate-500">{conv.context_label}</p></div>
              </div>
              <div className="flex gap-1"><button onClick={report} className="btn-ghost px-2 py-1.5" title="Report"><Flag size={14} /></button><button onClick={block} className="btn-ghost px-2 py-1.5 text-rose-600" title="Block"><Ban size={14} /></button></div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === user.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 shadow-sm'}`}>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-0.5 text-[10px] ${m.sender_id === user.id ? 'text-white/70' : 'text-slate-400'}`}>{timeAgo(m.created_at)}{m.sender_id === user.id && m.read_at ? ' · seen' : ''}</p>
                  </div>
                </div>
              ))}
              {!msgs.length && <p className="text-center text-sm text-slate-400">Say hello 👋 Keep it friendly — never share bank details or pay anyone through chat.</p>}
              <div ref={bottom} />
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3">
              <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e as any); } }}
                rows={1} maxLength={2000} className="input flex-1 resize-none" placeholder="Write a message…" />
              <button className="btn-primary" disabled={busy || !text.trim()} aria-label="Send">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
            </form>
          </>
        ) : <div className="m-auto p-8 text-center text-slate-400">Choose a conversation</div>}
      </section>
    </div>
  );
}
