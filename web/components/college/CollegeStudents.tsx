'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Circle, UsersRound, MessagesSquare } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import Verified from '@/components/campus/Verified';
import MessageButton, { type ChatMode } from '@/components/chat/MessageButton';

type P = { id: string; name: string; username: string | null; verified: boolean; avatar_url: string | null; course: string | null; batch_year: number | null;
  relation: string; mode: ChatMode; last_seen: string | null; i_follow: boolean; has_chat: string | null };
const online = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < 3 * 60_000;

// "Students of this college on Collegeolo" — who's online, with Say hi (own college: chat; other colleges: request)
export default function CollegeStudents({ collegeId, collegeName }: { collegeId: string; collegeName: string }) {
  const { user, profile } = useAuth();
  const loggedIn = !!user && !(user as any).is_anonymous;
  const [n, setN] = useState<{ students: number; online: number; group_members: number } | null>(null);
  const [rows, setRows] = useState<P[] | null>(null);
  useEffect(() => {
    const sb = supabaseBrowser();
    sb.rpc('college_people_count', { p_college: collegeId }).then(({ data }: { data: any[] | null }) => setN(data?.[0] || null));
    if (loggedIn) sb.rpc('college_people', { p_college: collegeId, p_lim: 12 }).then(({ data }: { data: P[] | null }) => setRows(data || []));
  }, [collegeId, loggedIn]);
  if (!n || n.students === 0) return null;
  const mine = profile?.college_id === collegeId;
  return (
    <div className="card mb-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold text-slate-900"><UsersRound size={18} className="text-brand-600" />
          {n.students.toLocaleString('en-IN')} student{n.students > 1 ? 's' : ''} of {collegeName} on Collegeolo
          {n.online > 0 && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"><Circle size={8} className="fill-emerald-500 text-emerald-500" />{n.online} online</span>}</p>
        {mine && n.group_members > 0 && <Link href="/messages?tab=groups" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><MessagesSquare size={15} />Your college group · {n.group_members}</Link>}
      </div>
      {!loggedIn ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 p-3 text-sm text-slate-700">
          Ask them about hostels, faculty and placements — they reply in chat.
          <Link href={`/login?mode=register&next=${encodeURIComponent(typeof location !== 'undefined' ? location.pathname + '#community' : '/')}`} className="btn-primary ms-auto py-1.5 text-sm">Sign up to say hi</Link>
        </div>
      ) : rows === null ? <div className="mt-3 flex gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 w-44 animate-pulse rounded-xl bg-slate-100" />)}</div>
      : rows.length === 0 ? <p className="mt-2 text-sm text-slate-500">Students of {collegeName} chat with their own college or with people they follow — follow them from their posts and shots.</p>
      : <div className="-mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {rows.map((p) => (
            <div key={p.id} className="w-48 shrink-0 snap-start rounded-xl border border-slate-100 p-3">
              <div className="flex items-center gap-2">
                <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 font-bold text-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p.name[0] || '?').toUpperCase()}
                  {online(p.last_seen) && <span className="absolute bottom-0 end-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />}
                </span>
                <div className="min-w-0"><p className="flex items-center gap-1 truncate text-sm font-semibold text-slate-900">{p.username ? <Link href={`/u/${p.username}`} className="truncate hover:underline">{p.name}</Link> : p.name}<Verified on={p.verified} size={12} /></p>
                  <p className="truncate text-xs capitalize text-slate-500">{p.relation === 'student' ? (online(p.last_seen) ? 'Online now' : 'Student') : p.relation}</p></div>
              </div>
              <p className="mt-1.5 truncate text-xs text-slate-600">{p.course || 'Course not added'}{p.batch_year ? ` · ${p.batch_year}` : ''}</p>
              <div className="mt-2"><MessageButton userId={p.id} mode={p.mode} chatId={p.has_chat} size="sm" /></div>
            </div>))}
          <Link href={`/people?q=${encodeURIComponent(collegeName)}`} className="grid w-32 shrink-0 place-items-center rounded-xl border border-dashed border-slate-200 text-center text-sm font-semibold text-brand-700 hover:bg-brand-50">See everyone →</Link>
        </div>}
    </div>
  );
}
