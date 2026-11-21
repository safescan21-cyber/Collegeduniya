'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import PostCard from '@/components/community/PostCard';
import type { FeedPost } from '@/components/community/types';

export default function UserPosts({ userId }: { userId: string }) {
  const [rows, setRows] = useState<FeedPost[] | null>(null);
  useEffect(() => { supabaseBrowser().rpc('feed', { p_user: userId, p_lim: 20 }).then(({ data }: { data: FeedPost[] | null }) => setRows(data || [])); }, [userId]);
  if (!rows?.length) return null;
  return <section className="mt-6 space-y-4"><h2 className="text-lg font-bold text-slate-900">Posts</h2>{rows.map((p) => <PostCard key={p.id} post={p} />)}</section>;
}
