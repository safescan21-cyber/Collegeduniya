import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabasePublic } from '@/lib/supabase/server';
import { mediaUrl } from '@/lib/mediaUrl';
import { SITE_URL } from '@/lib/format';
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
  const description = (p.body || '').replace(/\s+/g, ' ').slice(0, 160) || 'Post on Collegeolo campus community';
  const img = p.media.find((m) => m.type === 'image');
  // short posts are fine for the feed but too thin for search: index blogs, results with discussion, and posts with real text
  const substantial = p.kind === 'blog' || (p.body || '').length >= 280 || p.comments >= 3;
  return { title, description, alternates: { canonical: `/community/post/${p.id}` },
    robots: substantial ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title, description, type: 'article', ...(img ? { images: [mediaUrl(img.path)] } : {}) } };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await getPost((await params).id);
  if (!p) notFound();
  const ld = {
    '@context': 'https://schema.org', '@type': p.kind === 'blog' ? 'BlogPosting' : 'DiscussionForumPosting',
    ...(p.kind === 'blog' ? { headline: p.title } : { headline: p.title || (p.body || '').slice(0, 110) }),
    text: p.body || undefined, url: `${SITE_URL}/community/post/${p.id}`, datePublished: p.created_at, ...(p.edited_at ? { dateModified: p.edited_at } : {}),
    author: { '@type': 'Person', name: p.author_name, ...(p.author_username ? { url: `${SITE_URL}/u/${p.author_username}` } : {}) },
    ...(p.media.find((m) => m.type === 'image') ? { image: p.media.filter((m) => m.type === 'image').map((m) => mediaUrl(m.path)) } : {}),
    interactionStatistic: [
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: p.likes },
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: p.comments },
    ],
  };
  return (
    <div className="container-x max-w-2xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <Link href="/community" className="text-sm text-slate-500 hover:underline">← Campus community</Link>
      <div className="mt-3"><PostView post={p} /></div>
    </div>
  );
}
