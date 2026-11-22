'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Newspaper } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import PostCard from './PostCard';
import type { FeedPost } from './types';

// Posts and blogs by this college's students — public: anyone can read them, no login needed
const TABS = [['', 'All'], ['post', 'Posts'], ['blog', 'Blogs']] as const;
const PAGE = 5;

export default function CollegePosts({ collegeId, collegeName }: { collegeId: string; collegeName: string }) {
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState<FeedPost[] | null>(null); const [more, setMore] = useState(false); const [busy, setBusy] = useState(false);
  const load = useCallback(async (offset = 0) => {
    setBusy(true);
    const { data } = await supabaseBrowser().rpc('feed', { p_kind: kind || null, p_college: collegeId, p_sort: 'new', p_offset: offset, p_lim: PAGE });
    const list = ((data || []) as FeedPost[]).filter((p) => p.kind !== 'result' || kind === '');
    setRows((r) => (offset ? [...(r || []), ...list] : list)); setMore((data || []).length === PAGE); setBusy(false);
  }, [kind, collegeId]);
  useEffect(() => { load(0); }, [load]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold text-slate-900"><Newspaper size={18} className="text-brand-600" />Posts & blogs from {collegeName} students</p>
        <div className="flex gap-1">{TABS.map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={`${kind === k ? 'btn-primary' : 'btn-ghost'} py-1 text-sm`}>{l}</button>)}</div>
      </div>
      {rows === null ? <div className="card h-32 animate-pulse" />
        : rows.length === 0 ? <div className="card p-6 text-center text-sm text-slate-500">No posts from this college yet. Students of {collegeName} can share news, photos and blogs from the <Link href="/community" className="font-semibold text-brand-700 underline">Community</Link> page.</div>
        : rows.map((p) => <PostCard key={p.id} post={p} onDeleted={() => setRows((r) => (r || []).filter((x) => x.id !== p.id))} />)}
      {more && <button onClick={() => load(rows?.length || 0)} disabled={busy} className="btn-ghost w-full">{busy && <Loader2 size={15} className="animate-spin" />}More posts</button>}
    </div>
  );
}
