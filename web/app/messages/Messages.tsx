'use client';
import SoundToggle from '@/components/SoundToggle';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Ban, ArrowLeft, MessagesSquare, Loader2, Phone, Video, Users, Inbox, Search, Smile, Check, X, UserPlus, Clock, School, UsersRound } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useCalls } from '@/components/calls/CallProvider';
import Verified from '@/components/campus/Verified';
import ReportButton from '@/components/community/ReportButton';
import SharedPost from '@/components/chat/SharedPost';
import { EMOJI, REACTIONS, POST_LINK, onlyEmoji } from '@/components/chat/chatUtils';
import { GroupList, GroupRoom, JoinGroup, type MyGroup } from '@/components/chat/Groups';
import { usePresence, lastSeenText, OnlineDot } from '@/components/chat/usePresence';

type Conv = { id: string; status: 'active' | 'pending' | 'declined'; i_requested: boolean; request_note: string | null; context_type: string; context_label: string | null;
  other_id: string; other_name: string; other_username: string | null; other_verified: boolean; other_last_seen: string | null; other_calls: boolean;
  last_message: string | null; last_message_at: string; unread: number };
type Msg = { id: string; sender_id: string; body: string; created_at: string; read_at: string | null; reactions: Record<string, string> | null };
type Person = { id: string; name: string; username: string | null; verified: boolean; course: string | null; batch_year: number | null; relation: string; mode: 'direct' | 'request'; last_seen: string | null; has_chat: string | null };

const seen = (iso: string | null) => {
  if (!iso) return null;
  const ago = Date.now() - new Date(iso).getTime();
  return ago < 3 * 60e3 ? 'online' : `last seen ${timeAgo(iso)}`;
};

export default function Messages() {
  const { user, profile, loading } = useAuth();
  const sb = supabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get('c');
  const groupId = params.get('g'); const joinCode = params.get('join');
  const opened = active || groupId || joinCode;
  const [tab, setTab] = useState<'chats' | 'groups' | 'requests' | 'people'>((params.get('tab') as any) || (params.get('g') || params.get('join') ? 'groups' : 'chats'));
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [people, setPeople] = useState<Person[] | null>(null); const [q, setQ] = useState('');
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  const [text, setText] = useState(''); const [emoji, setEmoji] = useState(false); const [picker, setPicker] = useState<string | null>(null);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const { startCall, busy: inCall } = useCalls();

  const loadConvs = useCallback(async () => { const { data } = await sb.rpc('my_inbox'); setConvs((data || []) as Conv[]); }, [sb]);
  const loadMsgs = useCallback(async () => {
    if (!active || !user) return;
    const { data } = await sb.from('messages').select('id, sender_id, body, created_at, read_at, reactions').eq('conversation_id', active).order('created_at').limit(500);
    setMsgs((data || []) as Msg[]);
    const unread = (data || []).filter((m: Msg) => m.sender_id !== user.id && !m.read_at).map((m: Msg) => m.id);
    if (unread.length) { await sb.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread); loadConvs(); }
  }, [active, sb, user, loadConvs]);
  const loadGroups = useCallback(async () => { const { data } = await sb.rpc('my_groups'); setGroups((data || []) as MyGroup[]); }, [sb]);
  const loadPeople = useCallback(async () => { const { data } = await sb.rpc('campus_people', { p_q: q.trim() || null, p_lim: 60 }); setPeople((data || []) as Person[]); }, [sb, q]);

  useEffect(() => { if (user) { loadConvs(); loadGroups(); } }, [user, loadConvs, loadGroups]);
  useEffect(() => { if (!user) return; const t = setInterval(loadGroups, 20000); return () => clearInterval(t); }, [user, loadGroups]);
  useEffect(() => { setMsgs([]); loadMsgs(); const t = setInterval(() => { loadMsgs(); loadConvs(); }, 10000); return () => clearInterval(t); }, [loadMsgs, loadConvs]);
  useEffect(() => {   // new messages instantly
    if (!active || !user) return;
    const ch = sb.channel(`msgs-${active}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${active}` }, () => loadMsgs()).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [active, user, sb, loadMsgs]);
  useEffect(() => { if (tab === 'people' && user) { const h = setTimeout(loadPeople, 250); return () => clearTimeout(h); } }, [tab, user, loadPeople]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  if (loading) return <div className="card h-96 animate-pulse" />;
  const live = usePresence(user ? convs.map((c) => c.other_id) : []);   // before the early return (hooks rule)
  if (!user || (user as any).is_anonymous) return <div className="py-20 text-center"><Link href={`/login?next=${encodeURIComponent(joinCode ? `/messages?join=${joinCode}` : '/messages')}`} className="btn-primary">{joinCode ? 'Log in to join the group' : 'Log in to see your messages'}</Link></div>;

  const conv = convs.find((c) => c.id === active);
  const requests = convs.filter((c) => c.status === 'pending' && !c.i_requested);
  const chats = convs.filter((c) => !(c.status === 'pending' && !c.i_requested));
  const open = (id: string) => router.push(`/messages?c=${id}`);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim(); if (!body || !active) return;
    setBusy('send');
    const { error } = await sb.from('messages').insert({ conversation_id: active, sender_id: user.id, body });
    setBusy('');
    if (error) return setErr(/row-level|policy/i.test(error.message) ? 'You can’t message this person right now.' : error.message);
    setText(''); setErr(''); setEmoji(false);
    api('/api/notify/message', { method: 'POST', body: JSON.stringify({ conversation_id: active }) }).catch(() => {});
    loadMsgs(); loadConvs();
  };
  const respond = async (accept: boolean) => {
    if (!conv) return;
    setBusy('respond');
    const { error } = await sb.rpc('respond_chat_request', { p_conv: conv.id, p_accept: accept });
    setBusy(''); if (error) return setErr(error.message);
    await loadConvs(); if (!accept) router.push('/messages?tab=requests');
  };
  const block = async () => {
    if (!conv || !confirm(`Block ${conv.other_name}? They won’t be able to message or call you.`)) return;
    await sb.from('user_blocks').insert({ blocker_id: user.id, blocked_id: conv.other_id });
    loadConvs(); router.push('/messages');
  };
  const reactTo = async (m: Msg, em: string) => {
    setPicker(null);
    const { data, error } = await sb.rpc('react_message', { p_msg: m.id, p_emoji: em });
    if (!error) setMsgs((list) => list.map((x) => (x.id === m.id ? { ...x, reactions: (data || {}) as Record<string, string> } : x)));
  };
  const chatWith = async (p: Person, withNote?: string) => {
    setBusy(p.id); setErr('');
    const { data, error } = await sb.rpc('start_campus_chat', { p_other: p.id, p_note: withNote || null });
    setBusy(''); setNote(null);
    if (error) return setErr(error.message);
    await loadConvs(); open(data as string);
  };

  const Item = ({ c }: { c: Conv }) => (
    <button onClick={() => open(c.id)} className={`block w-full border-b border-slate-50 p-4 text-start hover:bg-slate-50 ${c.id === active ? 'bg-brand-50' : ''}`}>
      <p className="flex items-center justify-between gap-2 font-semibold text-slate-900"><span className="flex items-center gap-1 truncate"><OnlineDot on={live[c.other_id]?.online} />{c.other_name}<Verified on={c.other_verified} size={13} /></span>
        {c.unread > 0 ? <span className="rounded-full bg-brand-600 px-2 text-xs text-white">{c.unread}</span> : <span className="text-[11px] font-normal text-slate-400">{timeAgo(c.last_message_at)}</span>}</p>
      <p className="truncate text-sm text-slate-600">{c.status === 'pending' ? (c.i_requested ? 'Request sent · waiting' : c.request_note || 'Wants to chat with you') : c.status === 'declined' ? 'Request declined' : c.last_message || 'Say hello 👋'}</p>
    </button>);

  return (
    <div className="card grid h-[78vh] overflow-hidden md:grid-cols-[320px_1fr]">
      <aside className={`${opened ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-e border-slate-100`}>
        <p className="flex items-center gap-2 border-b border-slate-100 p-4 font-bold text-slate-900"><MessagesSquare size={18} />Messages<SoundToggle /></p>
        <div className="flex gap-1 border-b border-slate-100 p-2 text-sm">
          {([['chats', 'Chats', MessagesSquare, 0], ['groups', 'Groups', UsersRound, (groups || []).reduce((a, g) => a + g.unread, 0)], ['requests', 'Requests', Inbox, requests.length], ['people', 'College', Users, 0]] as const).map(([k, l, I, n]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-xs sm:text-sm ${tab === k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              <I size={14} />{l}{n > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{n}</span>}</button>))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'chats' && (chats.length ? chats.map((c) => <Item key={c.id} c={c} />) : <p className="p-6 text-sm text-slate-500">No chats yet. Find students of your college under <button onClick={() => setTab('people')} className="font-semibold text-brand-700">My college</button>.</p>)}
          {tab === 'groups' && <GroupList groups={groups} active={groupId} reload={loadGroups} />}
          {tab === 'requests' && (requests.length ? requests.map((c) => <Item key={c.id} c={c} />) : <p className="p-6 text-sm text-slate-500">No chat requests.</p>)}
          {tab === 'people' && (!profile?.college_id ? (
            <div className="p-6 text-center text-sm text-slate-600"><School className="mx-auto mb-2 text-brand-600" />Add your college to your profile to see and chat with students of your college.
              <Link href="/dashboard?tab=profile" className="btn-primary mt-3">Add my college</Link></div>
          ) : (
            <div>
              <div className="relative p-2"><Search size={14} className="absolute start-5 top-5 text-slate-400" /><input className="input ps-8 py-2 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, @username or course" /></div>
              {people === null ? <p className="p-4 text-sm text-slate-400">Loading…</p> : people.length === 0 ? <p className="p-6 text-sm text-slate-500">No students from your college here yet. Invite your friends!</p>
              : people.map((p) => (
                <div key={p.id} className="border-b border-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 font-semibold text-slate-900">{p.username ? <Link href={`/u/${p.username}`} className="truncate hover:underline">{p.name}</Link> : <span className="truncate">{p.name}</span>}<Verified on={p.verified} size={13} /></p>
                      <p className="truncate text-xs text-slate-500"><span className="capitalize">{p.relation}</span>{p.course ? ` · ${p.course}` : ''}{p.batch_year ? ` · ${p.batch_year}` : ''}{seen(p.last_seen) ? ` · ${seen(p.last_seen)}` : ''}</p>
                    </div>
                    {p.has_chat ? <button onClick={() => open(p.has_chat!)} className="btn-ghost shrink-0 py-1 text-xs">Open chat</button>
                      : p.mode === 'direct' ? <button onClick={() => chatWith(p)} disabled={!!busy} className="btn-primary shrink-0 py-1 text-xs">{busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <MessagesSquare size={13} />}Message</button>
                      : <button onClick={() => setNote({ id: p.id, text: '' })} className="btn-ghost shrink-0 py-1 text-xs"><UserPlus size={13} />Request</button>}
                  </div>
                  {note?.id === p.id && (
                    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
                      <textarea className="input text-sm" rows={2} maxLength={300} value={note.text} onChange={(e) => setNote({ id: p.id, text: e.target.value })} placeholder="Say why you want to chat (optional) — e.g. same batch, need notes" />
                      <div className="flex justify-end gap-2"><button onClick={() => setNote(null)} className="btn-ghost py-1 text-xs">Cancel</button><button onClick={() => chatWith(p, note.text)} disabled={!!busy} className="btn-primary py-1 text-xs">Send request</button></div>
                    </div>)}
                </div>))}
            </div>))}
          {err && !active && <p className="p-3 text-sm text-rose-600">{err}</p>}
        </div>
      </aside>

      <section className={`${opened ? 'flex' : 'hidden md:flex'} min-h-0 flex-col`}>
        {joinCode ? <JoinGroup code={joinCode} onJoined={loadGroups} /> : groupId ? <GroupRoom id={groupId} reloadList={loadGroups} /> : conv ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <button onClick={() => router.push('/messages')} className="md:hidden" aria-label="Back"><ArrowLeft size={18} /></button>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 font-bold text-slate-900">{conv.other_username ? <Link href={`/u/${conv.other_username}`} className="truncate hover:underline">{conv.other_name}</Link> : conv.other_name}<Verified on={conv.other_verified} /></p>
                  <p className={`truncate text-xs ${live[conv.other_id]?.online ? 'font-semibold text-emerald-600' : 'text-slate-500'}`}>{live[conv.other_id] ? <span className="inline-flex items-center gap-1"><OnlineDot on={live[conv.other_id].online} />{lastSeenText(live[conv.other_id])}</span> : seen(conv.other_last_seen) || conv.context_label}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {conv.status === 'active' && conv.other_calls && <>
                  <button onClick={() => startCall(conv.id, 'audio', conv.other_name)} disabled={inCall} className="btn-ghost px-2 py-1.5" title="Voice call" aria-label="Voice call"><Phone size={16} /></button>
                  <button onClick={() => startCall(conv.id, 'video', conv.other_name)} disabled={inCall} className="btn-ghost px-2 py-1.5" title="Video call" aria-label="Video call"><Video size={16} /></button>
                </>}
                {conv.status === 'active' && !conv.other_calls && <span className="hidden text-[11px] text-slate-400 sm:inline">Calls off</span>}
                <ReportButton type="conversation" id={conv.id} label="" className="px-2 py-1.5" />
                <button onClick={block} className="btn-ghost px-2 py-1.5 text-rose-600" title="Block" aria-label="Block"><Ban size={14} /></button>
              </div>
            </div>
            {conv.status === 'pending' && !conv.i_requested ? (
              <div className="m-auto max-w-sm p-6 text-center">
                <UserPlus className="mx-auto text-brand-600" size={36} />
                <p className="mt-3 font-bold text-slate-900">{conv.other_name} wants to chat with you</p>
                {conv.request_note && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">“{conv.request_note}”</p>}
                <p className="mt-2 text-xs text-slate-500">They can’t message or call you unless you accept. You can block or report them anytime.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button onClick={() => respond(false)} disabled={!!busy} className="btn-ghost"><X size={16} />Decline</button>
                  <button onClick={() => respond(true)} disabled={!!busy} className="btn-primary"><Check size={16} />Accept</button>
                </div>
              </div>
            ) : conv.status !== 'active' ? (
              <div className="m-auto max-w-sm p-6 text-center text-slate-600">
                <Clock className="mx-auto text-amber-500" size={36} />
                <p className="mt-3 font-semibold">{conv.status === 'pending' ? 'Chat request sent' : 'Your request was declined'}</p>
                <p className="mt-1 text-sm">{conv.status === 'pending' ? 'You can start chatting as soon as they accept. We’ll notify you.' : 'You can send a new request after 30 days.'}</p>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4" onClick={(e) => { if (picker && !(e.target as Element).closest('button')) setPicker(null); }}>
                  {msgs.map((m) => {
                    const mine = m.sender_id === user.id;
                    const big = onlyEmoji(m.body);
                    const link = m.body.match(POST_LINK);
                    const counts = Object.values(m.reactions || {}).reduce((a: Record<string, number>, e) => ({ ...a, [e]: (a[e] || 0) + 1 }), {});
                    const myR = (m.reactions || {})[user.id];
                    return (
                    <div key={m.id} className={`group flex items-center gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
                      <div onDoubleClick={() => reactTo(m, '❤️')} className={`relative max-w-[80%] text-sm ${big ? '' : `rounded-2xl px-3 py-2 ${mine ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 shadow-sm'}`}`}>
                        {big ? <p className="text-4xl leading-tight">{m.body}</p> : <>
                          {link && <div className="mb-1"><SharedPost id={link[1]} /></div>}
                          {(() => { const t = link ? m.body.replace(/https?:\/\/\S*\/community\/post\/\S+/i, '').trim() : m.body; return t ? <p className="whitespace-pre-wrap break-words">{t}</p> : null; })()}
                        </>}
                        <p className={`mt-0.5 text-[10px] ${mine && !big ? 'text-white/70' : 'text-slate-400'}`} title={new Date(m.created_at).toLocaleString('en-IN')}>{timeAgo(m.created_at)}{mine && m.read_at ? ' · seen' : ''}</p>
                        {Object.keys(counts).length > 0 && (
                          <div className={`absolute -bottom-3 ${mine ? 'end-2' : 'start-2'} flex gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-xs shadow`}>
                            {Object.entries(counts).map(([e, n]) => <button key={e} onClick={() => reactTo(m, e)} className={myR === e ? 'scale-110' : ''}>{e}{n > 1 ? <span className="text-[10px] text-slate-500">{n}</span> : null}</button>)}
                          </div>)}
                        {picker === m.id && (
                          <div className={`absolute -top-10 z-10 ${mine ? 'end-0' : 'start-0'} flex gap-1 rounded-full bg-white px-2 py-1 text-xl shadow-lg`}>
                            {REACTIONS.map((e) => <button key={e} onClick={() => reactTo(m, e)} className={`transition hover:scale-125 ${myR === e ? 'rounded-full bg-brand-100' : ''}`}>{e}</button>)}
                          </div>)}
                      </div>
                      <button onClick={() => setPicker(picker === m.id ? null : m.id)} className="rounded-full p-1 text-slate-400 opacity-60 hover:bg-white hover:text-amber-500 group-hover:opacity-100" aria-label="React"><Smile size={15} /></button>
                    </div>); })}
                  {!msgs.length && <div className="flex justify-center gap-2">{['👋', '😊', '🙏', '🔥'].map((e) => <button key={e} onClick={() => setText(e)} className="rounded-full bg-white px-3 py-1 text-2xl shadow-sm hover:scale-110">{e}</button>)}</div>}
                  {msgs.length > 0 && msgs.length < 4 && <p className="text-center text-[11px] text-slate-400">Tip: double-tap a message to ❤️ it, or tap 🙂 to react</p>}
                  {!msgs.length && <p className="text-center text-sm text-slate-400">Say hello 👋 Keep it friendly — never share bank details or pay anyone through chat.</p>}
                  <p className="pt-2 text-center text-[11px] text-slate-400">Messages are deleted automatically after 6 months.</p>
                  <div ref={bottom} />
                </div>
                {emoji && <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto border-t border-slate-100 px-3 pt-2">{EMOJI.map((em) => <button key={em} type="button" onClick={() => setText((t) => t + em)} className="rounded-lg p-1 text-xl hover:bg-slate-100">{em}</button>)}</div>}
                <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3">
                  <button type="button" onClick={() => setEmoji(!emoji)} className="btn-ghost px-2" aria-label="Emoji"><Smile size={18} className="text-amber-500" /></button>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e as any); } }}
                    rows={1} maxLength={2000} className="input flex-1 resize-none" placeholder="Write a message…" />
                  <button className="btn-primary" disabled={busy === 'send' || !text.trim()} aria-label="Send">{busy === 'send' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
                </form>
              </>
            )}
            {err && <p className="px-4 pb-2 text-sm text-rose-600">{err}</p>}
          </>
        ) : <div className="m-auto p-8 text-center text-slate-400">Choose a chat or group, answer a request, or find students from your college</div>}
      </section>
    </div>
  );
}
