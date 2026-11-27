'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Compass, Crown, Globe2, Info, Link2, Loader2, Lock, LogOut, Plus, Search, Send, Share2, ShieldCheck, Smile, Trash2, UserMinus, Users, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';
import Verified from '@/components/campus/Verified';
import ReportButton from '@/components/community/ReportButton';
import SharedPost from './SharedPost';
import { EMOJI, REACTIONS, POST_LINK, onlyEmoji } from './chatUtils';

export type MyGroup = { id: string; name: string; emoji: string; is_public: boolean; member_count: number; my_role: string; last_message: string | null; last_sender: string | null; last_message_at: string; unread: number };
type GMsg = { id: string; sender_id: string; sender_name: string; sender_username: string | null; sender_verified: boolean; body: string; reactions: Record<string, string> | null; created_at: string };
type Member = { id: string; name: string; username: string | null; avatar: string | null; verified: boolean; role: 'owner' | 'admin' | 'member' };
type Info = { id: string; name: string; about: string | null; emoji: string; is_public: boolean; member_count: number; invite_code: string; my_role: string; college_name: string | null; members: Member[] };

const GROUP_EMOJI = ['💬', '🎓', '📚', '🏠', '🍜', '🏏', '⚽', '🎮', '🎶', '💻', '🧪', '⚙️', '🩺', '⚖️', '📈', '🎨', '✈️', '🔥'];
const COLORS = ['text-rose-600', 'text-sky-600', 'text-emerald-600', 'text-amber-600', 'text-violet-600', 'text-fuchsia-600', 'text-teal-600', 'text-orange-600'];
const colorOf = (id: string) => COLORS[parseInt(id.replace(/-/g, '').slice(0, 6), 16) % COLORS.length];
const inviteUrl = (code: string) => `${location.origin}/messages?join=${code}`;

// ---------------------------------------------------------------- list (left column)
export function GroupList({ groups, active, reload }: { groups: MyGroup[] | null; active: string | null; reload: () => void }) {
  const router = useRouter();
  const [modal, setModal] = useState<'new' | 'discover' | null>(null);
  return (
    <div>
      <div className="flex gap-2 p-2">
        <button onClick={() => setModal('new')} className="btn-primary flex-1 py-1.5 text-xs"><Plus size={14} />New group</button>
        <button onClick={() => setModal('discover')} className="btn-ghost flex-1 py-1.5 text-xs"><Compass size={14} />Discover</button>
      </div>
      {groups === null ? <p className="p-4 text-sm text-slate-400">Loading…</p> : groups.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500"><Users className="mx-auto mb-2 text-brand-600" />No groups yet. Make one for your class, hostel or exam prep — or find one under Discover.</div>
      ) : groups.map((g) => (
        <button key={g.id} onClick={() => router.push(`/messages?tab=groups&g=${g.id}`)} className={`flex w-full items-center gap-3 border-b border-slate-50 p-3 text-start hover:bg-slate-50 ${g.id === active ? 'bg-brand-50' : ''}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xl">{g.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2"><b className="truncate text-sm text-slate-900">{g.name}</b>
              {g.unread > 0 ? <span className="rounded-full bg-brand-600 px-2 text-xs text-white">{g.unread > 99 ? '99+' : g.unread}</span> : <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(g.last_message_at)}</span>}</span>
            <span className="block truncate text-xs text-slate-500">{g.last_message ? `${g.last_sender}: ${g.last_message}` : `${g.member_count} member${g.member_count > 1 ? 's' : ''} · say hi 👋`}</span>
          </span>
        </button>))}
      {modal === 'new' && <NewGroup onClose={() => setModal(null)} onDone={(id) => { setModal(null); reload(); router.push(`/messages?tab=groups&g=${id}`); }} />}
      {modal === 'discover' && <Discover onClose={() => setModal(null)} onJoined={(id) => { setModal(null); reload(); router.push(`/messages?tab=groups&g=${id}`); }} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 text-slate-800 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><p className="font-bold">{title}</p><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function GroupForm({ init, saving, submitLabel, onSubmit, showCollege }: {
  init: { name: string; about: string; emoji: string; is_public: boolean }; saving: boolean; submitLabel: string; showCollege?: boolean;
  onSubmit: (v: { name: string; about: string; emoji: string; is_public: boolean; college: boolean }) => void }) {
  const { profile } = useAuth();
  const [v, setV] = useState({ ...init, college: false });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.name.trim().length >= 3) onSubmit(v); }} className="space-y-3">
      <div className="flex flex-wrap gap-1">{GROUP_EMOJI.map((em) => (
        <button key={em} type="button" onClick={() => setV({ ...v, emoji: em })} className={`rounded-lg p-1 text-xl ${v.emoji === em ? 'bg-brand-100 ring-2 ring-brand-500' : 'hover:bg-slate-100'}`}>{em}</button>))}</div>
      <input className="input" maxLength={60} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Group name, e.g. CSE 2027 · Hostel B · NEET prep" required minLength={3} />
      <textarea className="input" rows={2} maxLength={300} value={v.about} onChange={(e) => setV({ ...v, about: e.target.value })} placeholder="What is this group for? (optional)" />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <button type="button" onClick={() => setV({ ...v, is_public: false })} className={`rounded-xl border p-3 text-start ${!v.is_public ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}><Lock size={15} className="mb-1" /><b>Private</b><span className="block text-xs text-slate-500">Join with invite link only</span></button>
        <button type="button" onClick={() => setV({ ...v, is_public: true })} className={`rounded-xl border p-3 text-start ${v.is_public ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}><Globe2 size={15} className="mb-1" /><b>Public</b><span className="block text-xs text-slate-500">Anyone can find & join</span></button>
      </div>
      {showCollege && profile?.college_id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={v.college} onChange={(e) => setV({ ...v, college: e.target.checked })} />Group for my college (shown first to students of my college)</label>}
      <button disabled={saving || v.name.trim().length < 3} className="btn-primary w-full">{saving && <Loader2 size={16} className="animate-spin" />}{submitLabel}</button>
    </form>
  );
}

function NewGroup({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [saving, setSaving] = useState(false); const [err, setErr] = useState('');
  return (
    <Modal title="New group" onClose={onClose}>
      <GroupForm init={{ name: '', about: '', emoji: '💬', is_public: false }} saving={saving} submitLabel="Create group" showCollege onSubmit={async (v) => {
        setSaving(true); setErr('');
        const { data, error } = await supabaseBrowser().rpc('create_group', { p_name: v.name, p_about: v.about, p_emoji: v.emoji, p_public: v.is_public, p_my_college: v.college });
        setSaving(false); if (error) return setErr(error.message); onDone(data as string);
      }} />
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <p className="mt-3 text-[11px] text-slate-400">After creating, share the invite link. Nobody can be added without opening the link themselves.</p>
    </Modal>
  );
}

function Discover({ onClose, onJoined }: { onClose: () => void; onJoined: (id: string) => void }) {
  const [q, setQ] = useState(''); const [rows, setRows] = useState<any[] | null>(null); const [busy, setBusy] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { supabaseBrowser().rpc('discover_groups', { p_q: q.trim() || null }).then(({ data }: { data: any[] | null }) => setRows(data || [])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const join = async (id: string) => {
    setBusy(id); const { error } = await supabaseBrowser().rpc('join_group', { p_group: id }); setBusy('');
    if (error) return alert(error.message); onJoined(id);
  };
  return (
    <Modal title="Discover public groups" onClose={onClose}>
      <div className="relative mb-2"><Search size={14} className="absolute start-3 top-3 text-slate-400" /><input className="input ps-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search — college, course, exam, city" /></div>
      {rows === null ? <Loader2 className="mx-auto my-6 animate-spin text-slate-400" /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No public groups found. Create the first one!</p>
        : <ul className="divide-y divide-slate-100">{rows.map((g) => (
          <li key={g.id} className="flex items-center gap-3 py-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xl">{g.emoji}</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm">{g.name}{g.my_college && <span className="ms-1 rounded bg-emerald-50 px-1 text-[10px] font-semibold text-emerald-700">Your college</span>}</b>
              <span className="block truncate text-xs text-slate-500">{g.member_count} member{g.member_count > 1 ? 's' : ''}{g.college_name ? ` · ${g.college_name}` : ''}{g.about ? ` · ${g.about}` : ''}</span>
            </span>
            {g.is_member ? <button onClick={() => onJoined(g.id)} className="btn-ghost py-1 text-xs">Open</button>
              : <button onClick={() => join(g.id)} disabled={!!busy} className="btn-primary py-1 text-xs">{busy === g.id ? <Loader2 size={13} className="animate-spin" /> : 'Join'}</button>}
          </li>))}</ul>}
    </Modal>
  );
}

// ---------------------------------------------------------------- invite link landing: /messages?join=CODE
export function JoinGroup({ code, onJoined }: { code: string; onJoined: () => void }) {
  const router = useRouter();
  const [g, setG] = useState<any | null | undefined>(undefined); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { supabaseBrowser().rpc('group_preview', { p_code: code }).then(({ data }: { data: any[] | null }) => setG(data?.[0] || null)); }, [code]);
  if (g === undefined) return <div className="m-auto"><Loader2 className="animate-spin text-slate-400" /></div>;
  if (g === null) return <div className="m-auto p-8 text-center text-slate-500">This invite link doesn’t work any more. Ask for a new one.</div>;
  const join = async () => {
    setBusy(true); const { data, error } = await supabaseBrowser().rpc('join_group', { p_code: code }); setBusy(false);
    if (error) return setErr(error.message); onJoined(); router.replace(`/messages?tab=groups&g=${data}`);
  };
  return (
    <div className="m-auto max-w-sm p-6 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-slate-100 text-4xl">{g.emoji}</span>
      <p className="mt-3 text-xl font-bold text-slate-900">{g.name}</p>
      <p className="text-sm text-slate-500">{g.member_count} member{g.member_count > 1 ? 's' : ''}</p>
      {g.about && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{g.about}</p>}
      {g.is_member ? <button onClick={() => router.replace(`/messages?tab=groups&g=${g.id}`)} className="btn-primary mt-4">Open group</button>
        : <button onClick={join} disabled={busy} className="btn-primary mt-4">{busy && <Loader2 size={16} className="animate-spin" />}Join group</button>}
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <p className="mt-3 text-xs text-slate-400">Members see your name and messages. You can leave anytime.</p>
    </div>
  );
}

// ---------------------------------------------------------------- the chat room
export function GroupRoom({ id, reloadList }: { id: string; reloadList: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<GMsg[]>([]);
  const [text, setText] = useState(''); const [emoji, setEmoji] = useState(false); const [picker, setPicker] = useState<string | null>(null);
  const [panel, setPanel] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [copied, setCopied] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadInfo = useCallback(async () => { const { data } = await sb.rpc('group_info', { p_group: id }); setInfo((data as Info) || null); }, [id, sb]);
  const loadMsgs = useCallback(async () => {
    const { data } = await sb.rpc('group_messages_list', { p_group: id });
    setMsgs((data || []) as GMsg[]); sb.rpc('mark_group_read', { p_group: id }).then(() => reloadList());
  }, [id, sb, reloadList]);
  useEffect(() => { setInfo(undefined); setMsgs([]); setPanel(false); loadInfo(); loadMsgs(); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ch = sb.channel(`grp-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${id}` }, () => loadMsgs()).subscribe();
    const t = setInterval(loadMsgs, 15000);
    return () => { sb.removeChannel(ch); clearInterval(t); };
  }, [id, sb, loadMsgs]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  if (!user) return null;
  if (info === undefined) return <div className="m-auto"><Loader2 className="animate-spin text-slate-400" /></div>;
  if (info === null) return <div className="m-auto p-8 text-center text-slate-500">You’re not in this group any more.</div>;
  const isAdmin = info.my_role === 'owner' || info.my_role === 'admin';

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); const body = text.trim(); if (!body) return;
    setBusy('send');
    const { error } = await sb.from('group_messages').insert({ group_id: id, sender_id: user.id, body });
    setBusy(''); if (error) return setErr(/row-level|policy/i.test(error.message) ? 'You can’t post in this group.' : error.message);
    setText(''); setErr(''); setEmoji(false); loadMsgs();
  };
  const reactTo = async (m: GMsg, em: string) => {
    setPicker(null);
    const { data, error } = await sb.rpc('react_group_message', { p_msg: m.id, p_emoji: em });
    if (!error) setMsgs((l) => l.map((x) => (x.id === m.id ? { ...x, reactions: (data || {}) as Record<string, string> } : x)));
  };
  const del = async (m: GMsg) => { if (!confirm('Delete this message for everyone?')) return; await sb.from('group_messages').delete().eq('id', m.id); loadMsgs(); };
  const invite = async () => {
    const url = inviteUrl(info.invite_code);
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: `Join “${info.name}” on Collegeolo`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch { /* closed */ }
  };
  const leave = async () => { if (!confirm(`Leave “${info.name}”?`)) return; await sb.rpc('leave_group', { p_group: id }); reloadList(); router.push('/messages?tab=groups'); };
  const manage = async (m: Member, action: 'admin' | 'member' | 'remove') => {
    if (action === 'remove' && !confirm(`Remove ${m.name} from the group?`)) return;
    const { error } = await sb.rpc('manage_group_member', { p_group: id, p_user: m.id, p_action: action });
    if (error) return alert(error.message); loadInfo();
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-3">
        <button onClick={() => setPanel(!panel)} className="flex min-w-0 items-center gap-2 text-start">
          <span onClick={(e) => { e.stopPropagation(); router.push('/messages?tab=groups'); }} className="md:hidden" aria-label="Back"><ArrowLeft size={18} /></span>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-lg">{info.emoji}</span>
          <span className="min-w-0"><b className="block truncate text-slate-900">{info.name}</b><span className="block truncate text-xs text-slate-500">{info.member_count} members · tap for info</span></span>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={invite} className="btn-ghost px-2 py-1.5 text-xs" title="Invite friends">{copied ? <Check size={15} /> : <Share2 size={15} />}<span className="hidden sm:inline">{copied ? 'Link copied' : 'Invite'}</span></button>
          <button onClick={() => setPanel(!panel)} className="btn-ghost px-2 py-1.5" aria-label="Group info"><Info size={15} /></button>
        </div>
      </div>

      {panel ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-3xl">{info.emoji}</span>
            <p className="mt-2 text-lg font-bold">{info.name}</p>
            <p className="text-xs text-slate-500">{info.is_public ? <><Globe2 size={12} className="inline" /> Public group</> : <><Lock size={12} className="inline" /> Private group</>}{info.college_name ? ` · ${info.college_name}` : ''}</p>
            {info.about && <p className="mt-2 text-sm text-slate-700">{info.about}</p>}
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
            <p className="flex items-center gap-1 font-semibold"><Link2 size={14} />Invite link</p>
            <p className="mt-1 break-all text-xs text-slate-600" data-copy-ok>{inviteUrl(info.invite_code)}</p>
            <button onClick={invite} className="btn-primary mt-2 py-1 text-xs"><Share2 size={13} />Share link</button>
          </div>
          {isAdmin && <EditGroup info={info} onSaved={() => { loadInfo(); reloadList(); }} />}
          <p className="mt-5 text-sm font-bold">{info.member_count} members</p>
          <ul className="mt-1 divide-y divide-slate-100">{info.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.avatar ? <img src={m.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{m.name[0]?.toUpperCase()}</span>}
              <span className="flex min-w-0 flex-1 items-center gap-1 text-sm">{m.username ? <Link href={`/u/${m.username}`} className="truncate hover:underline">{m.name}</Link> : <span className="truncate">{m.name}</span>}<Verified on={m.verified} size={12} />{m.id === user.id && <span className="text-xs text-slate-400">(you)</span>}</span>
              {m.role === 'owner' && <span className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-600"><Crown size={12} />Owner</span>}
              {m.role === 'admin' && <span className="flex items-center gap-0.5 text-[11px] font-semibold text-sky-600"><ShieldCheck size={12} />Admin</span>}
              {isAdmin && m.id !== user.id && m.role !== 'owner' && (
                <span className="flex gap-1">
                  {info.my_role === 'owner' && <button onClick={() => manage(m, m.role === 'admin' ? 'member' : 'admin')} className="rounded px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100">{m.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>}
                  {(info.my_role === 'owner' || m.role === 'member') && <button onClick={() => manage(m, 'remove')} className="rounded p-0.5 text-rose-500 hover:bg-rose-50" aria-label={`Remove ${m.name}`}><UserMinus size={14} /></button>}
                </span>)}
            </li>))}</ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={leave} className="btn-ghost text-rose-600"><LogOut size={15} />Leave group</button>
            <ReportButton type="group" id={info.id} label="Report group" className="btn-ghost" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4" onClick={(e) => { if (picker && !(e.target as Element).closest('button')) setPicker(null); }}>
            {msgs.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-4xl">{info.emoji}</p><p className="mt-2 text-sm text-slate-500">Welcome to <b>{info.name}</b>! Be the first to say something.</p>
                <div className="mt-3 flex justify-center gap-2">{['👋', '🎉', '🔥', '🙏'].map((em) => <button key={em} onClick={() => setText(em)} className="rounded-full bg-white px-3 py-1 text-2xl shadow-sm hover:scale-110">{em}</button>)}</div>
              </div>)}
            {msgs.map((m, i) => {
              const mine = m.sender_id === user.id;
              const big = onlyEmoji(m.body);
              const link = m.body.match(POST_LINK);
              const counts = Object.values(m.reactions || {}).reduce((a: Record<string, number>, e) => ({ ...a, [e]: (a[e] || 0) + 1 }), {});
              const myR = (m.reactions || {})[user.id];
              const showName = !mine && (i === 0 || msgs[i - 1].sender_id !== m.sender_id);
              const rest = link ? m.body.replace(/https?:\/\/\S*\/community\/post\/\S+/i, '').trim() : m.body;
              return (
                <div key={m.id} className={`group flex items-center gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
                  <div onDoubleClick={() => reactTo(m, '❤️')} className={`relative max-w-[80%] text-sm ${big ? '' : `rounded-2xl px-3 py-2 ${mine ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 shadow-sm'}`}`}>
                    {showName && <p className={`mb-0.5 flex items-center gap-1 text-xs font-bold ${colorOf(m.sender_id)}`}>{m.sender_username ? <Link href={`/u/${m.sender_username}`} className="hover:underline">{m.sender_name}</Link> : m.sender_name}<Verified on={m.sender_verified} size={11} /></p>}
                    {big ? <p className="text-4xl leading-tight">{m.body}</p> : <>
                      {link && <div className="mb-1"><SharedPost id={link[1]} /></div>}
                      {rest && <p className="whitespace-pre-wrap break-words">{rest}</p>}
                    </>}
                    <p className={`mt-0.5 text-[10px] ${mine && !big ? 'text-white/70' : 'text-slate-400'}`} title={new Date(m.created_at).toLocaleString('en-IN')}>{timeAgo(m.created_at)}</p>
                    {Object.keys(counts).length > 0 && (
                      <div className={`absolute -bottom-3 ${mine ? 'end-2' : 'start-2'} flex gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-xs shadow`}>
                        {Object.entries(counts).map(([e, n]) => <button key={e} onClick={() => reactTo(m, e)} className={myR === e ? 'scale-110' : ''}>{e}{n > 1 ? <span className="text-[10px] text-slate-500">{n}</span> : null}</button>)}
                      </div>)}
                    {picker === m.id && (
                      <div className={`absolute -top-10 z-10 ${mine ? 'end-0' : 'start-0'} flex gap-1 rounded-full bg-white px-2 py-1 text-xl shadow-lg`}>
                        {REACTIONS.map((e) => <button key={e} onClick={() => reactTo(m, e)} className={`transition hover:scale-125 ${myR === e ? 'rounded-full bg-brand-100' : ''}`}>{e}</button>)}
                      </div>)}
                  </div>
                  <span className="flex items-center opacity-60 group-hover:opacity-100">
                    <button onClick={() => setPicker(picker === m.id ? null : m.id)} className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-amber-500" aria-label="React"><Smile size={15} /></button>
                    {(mine || isAdmin) ? <button onClick={() => del(m)} className="rounded-full p-1 text-slate-300 hover:bg-white hover:text-rose-500" aria-label="Delete message"><Trash2 size={13} /></button>
                      : <ReportButton type="group_message" id={m.id} label="" className="p-1" />}
                  </span>
                </div>);
            })}
            <div ref={bottom} />
          </div>
          {emoji && <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto border-t border-slate-100 px-3 pt-2">{EMOJI.map((em) => <button key={em} type="button" onClick={() => setText((t) => t + em)} className="rounded-lg p-1 text-xl hover:bg-slate-100">{em}</button>)}</div>}
          <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3">
            <button type="button" onClick={() => setEmoji(!emoji)} className="btn-ghost px-2" aria-label="Emoji"><Smile size={18} className="text-amber-500" /></button>
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e as any); } }}
              rows={1} maxLength={2000} className="input flex-1 resize-none" placeholder={`Message ${info.name}…`} />
            <button className="btn-primary" disabled={busy === 'send' || !text.trim()} aria-label="Send">{busy === 'send' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
          </form>
          {err && <p className="px-4 pb-2 text-sm text-rose-600">{err}</p>}
        </>
      )}
    </>
  );
}

function EditGroup({ info, onSaved }: { info: Info; onSaved: () => void }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [err, setErr] = useState('');
  const newLink = async () => {
    if (!confirm('Make a new invite link? The old link will stop working.')) return;
    const { error } = await supabaseBrowser().rpc('update_group', { p_group: info.id, p_name: info.name, p_about: info.about, p_emoji: info.emoji, p_public: info.is_public, p_new_link: true });
    if (error) return alert(error.message); onSaved();
  };
  return (
    <div className="mt-3">
      <div className="flex gap-2"><button onClick={() => setOpen(!open)} className="btn-ghost py-1 text-xs">Edit group</button><button onClick={newLink} className="btn-ghost py-1 text-xs">New invite link</button></div>
      {open && <div className="mt-2 rounded-xl border border-slate-100 p-3">
        <GroupForm init={{ name: info.name, about: info.about || '', emoji: info.emoji, is_public: info.is_public }} saving={saving} submitLabel="Save" onSubmit={async (v) => {
          setSaving(true); setErr('');
          const { error } = await supabaseBrowser().rpc('update_group', { p_group: info.id, p_name: v.name, p_about: v.about, p_emoji: v.emoji, p_public: v.is_public, p_new_link: false });
          setSaving(false); if (error) return setErr(error.message); setOpen(false); onSaved();
        }} />
        {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      </div>}
    </div>
  );
}
