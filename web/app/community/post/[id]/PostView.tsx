'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import PostCard from '@/components/community/PostCard';
import type { FeedPost } from '@/components/community/types';

// server renders the public post; once logged in, reload it so "my reaction" and delete show correctly
export default function PostView({ post }: { post: FeedPost }) {
  const { user } = useAuth(); const router = useRouter();
  const [p, setP] = useState(post);
  useEffect(() => { if (user) supabaseBrowser().rpc('feed', { p_post: post.id, p_lim: 1 }).then(({ data }: { data: FeedPost[] | null }) => data?.[0] && setP(data[0])); }, [user, post.id]);
  return <PostCard key={`${p.id}-${p.my_reaction}-${p.is_mine}`} post={p} full onDeleted={() => router.push('/community')} />;
}
