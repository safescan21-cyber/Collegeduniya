'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import FollowButton from '@/components/community/FollowButton';
import Verified from '@/components/campus/Verified';

type Stats = { followers: number; following: number; i_follow: boolean; follows_me: boolean; is_me: boolean };
type Person = { id: string; name: string; username: string | null; avatar: string | null; verified: boolean; college_name: string | null; i_follow: boolean };

export default function FollowBar({ userId, posts }: { userId: string; posts: number }) {
  const { user } = useAuth();
  const [s, setS] = useState<Stats | null>(null);
  const [list, setList] = useState<{ which: 'followers' | 'following'; rows: Person[] | null } | null>(null);
  const loggedIn = !!user && !(user as any).is_anonymous;
  const load = useCallback(() => { supabaseBrowser().rpc('follow_stats', { p_user: userId }).then(({ data }: { data: Stats[] | null }) => setS(data?.[0] || null)); }, [userId]);
  useEffect(() => { load(); }, [load, user?.id]);
  const open = async (which: 'followers' | 'following') => {
    if (!loggedIn) return location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
    setList({ which, rows: null });
    const { data } = await supabaseBrowser().rpc('follow_list', { p_user: userId, p_which: which });
    setList({ which, rows: (data || []) as Person[] });
  };
  const Stat = ({ n, l, onClick }: { n: number; l: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick} disabled={!onClick} className="text-center"><b className="block text-lg text-slate-900">{n}</b><span className="text-xs text-slate-500">{l}</span></button>);
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-slate-100 pt-4">
        <Stat n={posts} l="Posts" />
        <Stat n={s?.followers ?? 0} l="Followers" onClick={() => open('followers')} />
        <Stat n={s?.following ?? 0} l="Following" onClick={() => open('following')} />
        {s && !s.is_me && <div className="ms-auto flex items-center gap-2">
          {s.follows_me && <span className="text-xs text-slate-500">Follows you</span>}
          <FollowButton userId={userId} initial={loggedIn ? s.i_follow : undefined} variant="solid" onChange={(f, n) => setS({ ...s, i_follow: f, followers: n })} />
        </div>}
      </div>
      {list && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setList(null)}>
          <div className="max-h-[75vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><p className="font-bold capitalize">{list.which}</p><button onClick={() => setList(null)} aria-label="Close"><X size={18} /></button></div>
            {list.rows === null ? <Loader2 className="mx-auto my-6 animate-spin text-slate-400" /> : list.rows.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Nobody yet.</p>
              : <ul className="divide-y divide-slate-100">{list.rows.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.avatar ? <img src={p.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{p.name[0]?.toUpperCase()}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-semibold">{p.username ? <Link href={`/u/${p.username}`} className="hover:underline">{p.name}</Link> : p.name}<Verified on={p.verified} size={12} /></p>
                    {p.college_name && <p className="truncate text-xs text-slate-500">{p.college_name}</p>}
                  </div>
                  <FollowButton userId={p.id} initial={p.i_follow} />
                </li>))}</ul>}
          </div>
        </div>)}
    </>
  );
}
