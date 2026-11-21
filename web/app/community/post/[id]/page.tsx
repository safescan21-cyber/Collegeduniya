import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabasePublic } from '@/lib/supabase/server';
import { mediaUrl } from '@/lib/mediaUrl';
import PostView from './PostView';
import type { FeedPost } from '@/components/community/types';

async function getPost(id: string): Promise<FeedPost | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await supabasePublic().rpc('feed', { p_post: id, p_lim: 1 });
  return (data?.[0] as FeedPost) || null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getPost((await params).id);
  if (!p) return { title: 'Post not found', robots: { index: false } };
  const title = p.title || (p.result ? `${p.author_name} scored ${p.result.score}/${p.result.max} in ${p.result.title}` : `${p.author_name}${p.college_name ? ` · ${p.college_name}` : ''}`);
  const description = (p.body || '').replace(/\s+/g, ' ').slice(0, 160) || 'Post on StudyEarnstay campus community';
  const img = p.media.find((m) => m.type === 'image');
  return { title, description, alternates: { canonical: `/community/post/${p.id}` },
    openGraph: { title, description, type: 'article', ...(img ? { images: [mediaUrl(img.path)] } : {}) } };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await getPost((await params).id);
  if (!p) notFound();
  return (
    <div className="container-x max-w-2xl py-8">
      <Link href="/community" className="text-sm text-slate-500 hover:underline">← Campus community</Link>
      <div className="mt-3"><PostView post={p} /></div>
    </div>
  );
}
