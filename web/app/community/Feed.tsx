'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import Composer from '@/components/community/Composer';
import PostCard from '@/components/community/PostCard';
import type { FeedPost } from '@/components/community/types';

const TABS = [['', 'All'], ['post', 'Posts'], ['blog', 'Blogs'], ['result', 'Mock results']] as const;
const PAGE = 15;

export default function Feed() {
  const { user, profile } = useAuth();
  const [kind, setKind] = useState(''); const [sort, setSort] = useState('new'); const [mine, setMine] = useState(false);
  const [rows, setRows] = useState<FeedPost[] | null>(null); const [more, setMore] = useState(false); const [busy, setBusy] = useState(false);
  const load = useCallback(async (offset = 0) => {
    setBusy(true);
    const { data } = await supabaseBrowser().rpc('feed', { p_kind: kind || null, p_college: mine && profile?.college_id ? profile.college_id : null,
      p_sort: kind === 'result' && sort === 'new' ? 'new' : sort, p_offset: offset, p_lim: PAGE });
    const list = (data || []) as FeedPost[];
    setRows((r) => (offset ? [...(r || []), ...list] : list)); setMore(list.length === PAGE); setBusy(false);
  }, [kind, sort, mine, profile?.college_id]);
  useEffect(() => { load(0); }, [load, user?.id]);
  useEffect(() => { if (kind === 'result') setSort('score'); else if (sort === 'score') setSort('new'); }, [kind]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-2xl font-extrabold text-slate-900">Campus community</h1><p className="text-sm text-slate-500">News, photos, blogs and results from students</p></div>
        {user && <Link href="/messages?tab=people" className="btn-ghost py-1.5 text-sm"><Users size={15} />People from my college</Link>}
      </div>
      <Composer onPosted={() => load(0)} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto">{TABS.map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={`${kind === k ? 'btn-primary' : 'btn-ghost'} whitespace-nowrap py-1.5 text-sm`}>{l}</button>)}</div>
        <select className="input ms-auto w-auto py-1.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="new">Latest</option><option value="top">Most liked</option>{kind === 'result' && <option value="score">Highest score</option>}
        </select>
        {profile?.college_id && <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={mine} onChange={(e) => setMine(e.target.checked)} />My college</label>}
      </div>
      {rows === null ? <div className="card h-64 animate-pulse" /> : rows.length === 0 ? <div className="card p-10 text-center text-slate-500">Nothing here yet — be the first to post!</div>
        : rows.map((p) => <PostCard key={p.id} post={p} onDeleted={() => setRows((r) => (r || []).filter((x) => x.id !== p.id))} />)}
      {more && <button onClick={() => load(rows?.length || 0)} disabled={busy} className="btn-ghost w-full">{busy && <Loader2 size={15} className="animate-spin" />}Load more</button>}
    </div>
  );
}
