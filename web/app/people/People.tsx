'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Sparkles, Circle, School, BookOpen, MapPin, Heart, Clapperboard, UsersRound, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import FollowButton from '@/components/community/FollowButton';
import Verified from '@/components/campus/Verified';
import MessageButton, { type ChatMode } from '@/components/chat/MessageButton';

type Person = { id: string; name: string; username: string | null; verified: boolean; avatar_url: string | null; college_name: string | null; college_slug: string | null;
  same_college: boolean; course: string | null; batch_year: number | null; relation: string; mode: ChatMode; last_seen: string | null; i_follow: boolean; follows_me: boolean;
  followers: number; shots: number; has_chat: string | null };
const TABS = [
  { k: 'suggested', l: 'Suggested', I: Sparkles }, { k: 'online', l: 'Online now', I: Circle }, { k: 'college', l: 'My college', I: School },
  { k: 'course', l: 'Same course', I: BookOpen }, { k: 'nearby', l: 'Near me', I: MapPin }, { k: 'following', l: 'Following', I: Heart },
  { k: 'creators', l: 'Shot creators', I: Clapperboard },
] as const;
type Tab = typeof TABS[number]['k'];
const PAGE = 30;

const ago = (iso: string | null) => {
  if (!iso) return null; const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 3) return 'online'; if (m < 60) return `${Math.round(m)} min ago`; if (m < 1440) return `${Math.round(m / 60)} h ago`; return null;
};

export default function People() {
  const { user, profile, loading } = useAuth();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((TABS.find((t) => t.k === params.get('tab'))?.k) || 'suggested');
  const [q, setQ] = useState(params.get('q') || '');
  const [rows, setRows] = useState<Person[] | null>(null); const [more, setMore] = useState(false); const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const loggedIn = !!user && !(user as any).is_anonymous;

  const load = useCallback(async (offset = 0) => {
    const my = ++seq.current; setBusy(true);
    const { data } = await supabaseBrowser().rpc('people_search', { p_tab: q.trim() ? 'suggested' : tab, p_q: q.trim() || null, p_offset: offset, p_lim: PAGE });
    if (my !== seq.current) return;
    const list = (data || []) as Person[];
    setRows((r) => (offset ? [...(r || []), ...list] : list)); setMore(list.length === PAGE); setBusy(false);
  }, [tab, q]);
  useEffect(() => { if (!loggedIn) return; const h = setTimeout(() => { setRows(null); load(0); }, q ? 300 : 0); return () => clearTimeout(h); }, [load, loggedIn, q]);

  if (loading) return <div className="container-x py-10" />;
  if (!loggedIn) return (
    <div className="container-x max-w-xl py-16 text-center">
      <UsersRound size={40} className="mx-auto text-brand-600" />
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900">Find students to chat with</h1>
      <p className="mt-2 text-slate-600">Seniors and batchmates from your college, students on your course and near you — follow them and chat.</p>
      <Link href="/login?mode=register&next=/people" className="btn-primary mt-5">Sign up free to find people</Link>
      <p className="mt-3 text-sm text-slate-500">Already have an account? <Link href="/login?next=/people" className="font-semibold text-brand-700">Log in</Link></p>
    </div>);

  const needCollege = !profile?.college_id && (tab === 'college' || tab === 'nearby');
  const needCourse = !profile?.course && tab === 'course';
  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><UsersRound className="text-brand-600" />Find people</h1>
          <p className="mt-1 text-sm text-slate-600">Students from your college chat straight away. Students from other colleges get a chat request they can accept — or chat directly once you follow each other.</p></div>
        <Link href="/messages" className="btn-ghost py-2 text-sm">My chats →</Link>
      </div>

      <div className="relative mt-5"><Search size={16} className="absolute start-3 top-3 text-slate-400" />
        <input className="input ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search @username, course or college — e.g. CSE, IIT Delhi, MBBS" /></div>
      {!q.trim() && <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">{TABS.map(({ k, l, I }) => (
        <button key={k} onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === k ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
          <I size={14} className={k === 'online' ? (tab === k ? 'fill-emerald-300 text-emerald-300' : 'fill-emerald-500 text-emerald-500') : ''} />{l}</button>))}</div>}

      {(needCollege || needCourse) ? (
        <div className="card mt-6 p-6 text-center text-sm text-slate-600"><School className="mx-auto mb-2 text-brand-600" />
          Add your {needCourse ? 'course' : 'college'} to your profile to see {needCourse ? 'students on the same course' : tab === 'college' ? 'students of your college' : 'students near you'}.
          <div><Link href="/dashboard?tab=profile" className="btn-primary mt-3">Complete my profile</Link></div></div>
      ) : rows === null ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      : rows.length === 0 ? <div className="card mt-6 p-8 text-center text-sm text-slate-500">{q ? 'Nobody matches that search yet.' : tab === 'online' ? 'Nobody you can chat with is online right now — try Suggested.' : 'No students here yet — invite your friends to Collegeolo!'}</div>
      : <>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => { const seen = ago(p.last_seen); const href = p.username ? `/u/${p.username}` : null; return (
            <div key={p.id} className="card flex flex-col p-4">
              <div className="flex items-start gap-3">
                <span className="relative shrink-0">
                  <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-lg font-bold text-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p.name[0] || '?').toUpperCase()}</span>
                  {seen === 'online' && <span className="absolute bottom-0 end-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" title="Online" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-bold text-slate-900">{href ? <Link href={href} className="truncate hover:underline">{p.name}</Link> : <span className="truncate">{p.name}</span>}<Verified on={p.verified} size={14} /></p>
                  {p.username && <p className="truncate text-xs text-slate-500">@{p.username}</p>}
                  <p className="mt-0.5 truncate text-xs text-slate-600">{p.college_slug ? <Link href={`/colleges/${p.college_slug}`} className="hover:underline">{p.college_name}</Link> : p.college_name || 'College not added'}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                {p.same_college && <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold capitalize text-brand-700">{p.relation === 'student' ? 'Your college' : p.relation}</span>}
                {p.course && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{p.course}{p.batch_year ? ` · ${p.batch_year}` : ''}</span>}
                {p.follows_me && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Follows you</span>}
                {seen && seen !== 'online' && <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-500">Active {seen}</span>}
                {seen === 'online' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Online</span>}
              </div>
              <p className="mt-2 text-xs text-slate-500">{p.followers} followers{p.shots ? ` · ${p.shots} shots` : ''}</p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                <MessageButton userId={p.id} mode={p.mode} chatId={p.has_chat} size="sm" />
                <FollowButton userId={p.id} initial={p.i_follow} onChange={(f, n) => setRows((r) => (r || []).map((x) => (x.id === p.id ? { ...x, i_follow: f, followers: n } : x)))} />
              </div>
            </div>); })}
        </div>
        {more && <div className="mt-6 text-center"><button onClick={() => load(rows.length)} disabled={busy} className="btn-ghost">{busy ? <Loader2 size={15} className="animate-spin" /> : null}Show more</button></div>}
      </>}

      <p className="mt-8 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-600" />
        Safe by design: students of other colleges can only send a request, girls are shown to other colleges only if they follow you, and you can block or report anyone from a chat.
        Don’t want to be found by other colleges? <Link href="/dashboard?tab=profile" className="font-semibold text-brand-700">Change it in your profile</Link>.</p>
    </div>
  );
}
