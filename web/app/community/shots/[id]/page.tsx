import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { Heart, MessageCircle, Share2, PlayCircle, Clapperboard } from 'lucide-react';
import { supabasePublic } from '@/lib/supabase/server';
import { mediaUrl } from '@/lib/mediaUrl';
import { SITE_URL, timeAgo } from '@/lib/format';
import { shotPath, shotIdFrom, hashtags, shotSlug } from '@/lib/shotUrl';
import type { FeedPost } from '@/components/community/types';

// One shot = one page that search engines can index: /community/shots/<caption-words>-<id>
// (the full-screen swipe player stays at /community/shots?start=<id>)
type Shot = FeedPost & { media: { type: 'image' | 'video'; path: string; poster?: string }[] };

async function getShot(param: string): Promise<Shot | null> {
  const id = shotIdFrom(param); if (!id) return null;
  const { data } = await supabasePublic().rpc('feed', { p_post: id, p_lim: 1 });
  const p = (data?.[0] as Shot) || null;
  return p && p.kind === 'shot' ? p : null;
}
const captionText = (p: Shot) => (p.body || '').replace(/#[\p{L}\p{N}_]+/gu, ' ').replace(/\s+/g, ' ').trim();
const titleOf = (p: Shot) => {
  const first = captionText(p).split(/(?<=[.!?])\s/)[0].slice(0, 90);
  return first.length >= 8 ? first : `${p.media[0]?.type === 'video' ? 'Campus video' : 'Campus photo'} by ${p.author_name}${p.college_name ? ` · ${p.college_name}` : ''}`;
};
const thumbOf = (p: Shot) => { const m = p.media[0]; return m?.type === 'image' ? mediaUrl(m.path) : m?.poster ? mediaUrl(m.poster) : null; };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getShot((await params).id);
  if (!p) return { title: 'Shot not found', robots: { index: false } };
  const title = `${titleOf(p)}${p.college_name && !titleOf(p).includes(p.college_name) ? ` — ${p.college_name}` : ''}`;
  const description = (captionText(p) || `A ${p.media[0]?.type === 'video' ? 'short video' : 'photo'} by ${p.author_name}${p.college_name ? ` from ${p.college_name}` : ''} on Collegeolo Shots.`).slice(0, 160);
  const thumb = thumbOf(p); const m = p.media[0];
  // thin shots (no caption, no reactions) stay out of search but still pass link value
  const substantial = captionText(p).length >= 20 || (p.likes + p.comments) >= 3;
  return {
    title, description, alternates: { canonical: shotPath(p.id, p.body) },
    robots: substantial ? { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' } as any : { index: false, follow: true },
    openGraph: { title, description, type: m?.type === 'video' ? 'video.other' : 'article', url: shotPath(p.id, p.body),
      ...(thumb ? { images: [thumb] } : {}), ...(m?.type === 'video' ? { videos: [{ url: mediaUrl(m.path) }] } : {}) },
    twitter: { card: thumb ? 'summary_large_image' : 'summary', title, description, ...(thumb ? { images: [thumb] } : {}) },
  };
}

export default async function ShotPage({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const p = await getShot(raw);
  if (!p) notFound();
  if (decodeURIComponent(raw) !== `${shotSlug(p.body)}-${p.id}`) permanentRedirect(shotPath(p.id, p.body));   // one address per shot

  const m = p.media[0]; const thumb = thumbOf(p); const tags = hashtags(p.body); const title = titleOf(p);
  const { data: more } = await supabasePublic().rpc('feed', { p_kind: 'shot', p_college: p.college_id, p_sort: 'trending', p_lim: 9 });
  const others = ((more || []) as Shot[]).filter((x) => x.id !== p.id).slice(0, 8);

  const url = `${SITE_URL}${shotPath(p.id, p.body)}`;
  const author = { '@type': 'Person', name: p.author_name, ...(p.author_username ? { url: `${SITE_URL}/u/${p.author_username}` } : {}) };
  const stats = [
    { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: p.likes },
    { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: p.comments },
    { '@type': 'InteractionCounter', interactionType: 'https://schema.org/ShareAction', userInteractionCount: p.shares },
  ];
  const ld = m?.type === 'video'
    ? { '@context': 'https://schema.org', '@type': 'VideoObject', name: title, description: captionText(p) || title, uploadDate: p.created_at,
        contentUrl: mediaUrl(m.path), embedUrl: url, url, ...(thumb ? { thumbnailUrl: [thumb] } : {}), author, interactionStatistic: stats,
        ...(p.college_name ? { contentLocation: { '@type': 'Place', name: p.college_name } } : {}), ...(tags.length ? { keywords: tags.join(', ') } : {}) }
    : { '@context': 'https://schema.org', '@type': 'ImageObject', name: title, description: captionText(p) || title, uploadDate: p.created_at,
        contentUrl: mediaUrl(m.path), url, author, creator: author, creditText: p.author_name, interactionStatistic: stats };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Community', item: `${SITE_URL}/community` },
    { '@type': 'ListItem', position: 2, name: 'Shots', item: `${SITE_URL}/community/shots` },
    { '@type': 'ListItem', position: 3, name: title, item: url },
  ] };
  const watch = `/community/shots?start=${p.id}`;

  return (
    <div className="container-x max-w-5xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([ld, crumbs]).replace(/</g, '\\u003c') }} />
      <nav className="text-sm text-slate-500"><Link href="/community" className="hover:underline">Community</Link> / <Link href="/community/shots" className="hover:underline">Shots</Link></nav>
      <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,360px)_1fr]">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-2xl bg-black shadow-lg">
          {m?.type === 'video'
            ? <video src={mediaUrl(m.path)} poster={thumb || undefined} controls playsInline preload="metadata" controlsList="nodownload" disablePictureInPicture className="h-full w-full object-contain" aria-label={title} />
            /* eslint-disable-next-line @next/next/no-img-element */
            : <img src={mediaUrl(m.path)} alt={title} className="h-full w-full object-contain" />}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {p.author_username ? <Link href={`/u/${p.author_username}`} className="font-semibold text-slate-900 hover:underline">@{p.author_username}</Link> : <b>{p.author_name}</b>}
            {p.college_name && <> · {p.college_slug ? <Link href={`/colleges/${p.college_slug}`} className="font-semibold text-brand-700 hover:underline">{p.college_name}</Link> : p.college_name}</>}
            {' '}· <time dateTime={p.created_at}>{timeAgo(p.created_at)}</time>
          </p>
          {p.body && <p className="mt-4 whitespace-pre-line text-slate-800">{p.body}</p>}
          {tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">#{t}</span>)}</div>}
          <div className="mt-5 flex gap-5 text-sm text-slate-600">
            <span className="flex items-center gap-1"><Heart size={16} className="text-rose-500" />{p.likes}</span>
            <span className="flex items-center gap-1"><MessageCircle size={16} />{p.comments}</span>
            <span className="flex items-center gap-1"><Share2 size={16} />{p.shares}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={watch} className="btn-primary"><PlayCircle size={16} />Watch, like & comment</Link>
            <Link href="/community/shots?new=1" className="btn-ghost"><Clapperboard size={16} />Post your shot</Link>
          </div>
          {p.college_slug && <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Thinking about <b>{p.college_name}</b>? See its <Link href={`/colleges/${p.college_slug}#courses`} className="font-semibold text-brand-700 hover:underline">courses & fees</Link>, <Link href={`/colleges/${p.college_slug}#placements`} className="font-semibold text-brand-700 hover:underline">placements</Link> and <Link href={`/colleges/${p.college_slug}#reviews`} className="font-semibold text-brand-700 hover:underline">student reviews</Link>.</p>}
        </div>
      </div>

      {others.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-slate-900">{p.college_name ? `More shots from ${p.college_name}` : 'More shots'}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {others.map((o) => { const t = thumbOf(o); return (
              <Link key={o.id} href={shotPath(o.id, o.body)} className="group overflow-hidden rounded-xl border border-slate-100 bg-white">
                <div className="relative aspect-[9/16] bg-gradient-to-br from-slate-800 to-brand-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t ? <img src={t} alt="" loading="lazy" className="h-full w-full object-cover" /> : <PlayCircle size={36} className="absolute inset-0 m-auto text-white/70" />}
                  <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/50 px-1.5 text-xs text-white"><Heart size={11} />{o.likes}</span>
                </div>
                <p className="line-clamp-2 p-2 text-xs text-slate-700 group-hover:text-brand-700">{titleOf(o)}</p>
              </Link>); })}
          </div>
        </section>)}
    </div>
  );
}
