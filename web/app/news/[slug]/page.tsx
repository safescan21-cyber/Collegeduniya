import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShareButtons } from '@/components/ActionButtons';
import EnquiryForm from '@/components/EnquiryForm';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { renderMarkdown } from '@/lib/markdown';
import { SITE_URL } from '@/lib/format';
import type { Article } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getArticle(slug: string) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().from('articles').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  return data as Article | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  if (!a) return { title: 'Article not found' };
  return { title: a.title, description: a.excerpt || undefined, openGraph: { type: 'article', images: a.cover_url ? [a.cover_url] : [] }, alternates: { canonical: `/news/${a.slug}` } };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArticle((await params).slug);
  if (!a) notFound();
  const { data: more } = await supabasePublic().from('articles').select('slug, title, published_at').eq('is_published', true).eq('category', a.category).neq('id', a.id).order('published_at', { ascending: false }).limit(5);
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'NewsArticle', headline: a.title, description: a.excerpt,
    datePublished: a.published_at, dateModified: a.updated_at, image: a.cover_url ? [a.cover_url] : undefined,
    author: a.author_name && !/team$/i.test(a.author_name) ? { '@type': 'Person', name: a.author_name } : { '@type': 'Organization', name: 'StudyEarnstay', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'StudyEarnstay', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon.png` } },
    mainEntityOfPage: `${SITE_URL}/news/${a.slug}`,
  };
  return (
    <div className="container-x grid gap-10 py-10 lg:grid-cols-[1fr_320px]">
      <article className="min-w-0">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Link href={`/news?category=${a.category}`} className="chip-brand capitalize">{a.category}</Link>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">{a.title}</h1>
        <p className="mt-2 text-sm text-slate-500">By <span className="font-medium text-slate-700">{a.author_name || 'StudyEarnstay Team'}</span> · {new Date(a.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          {a.updated_at && new Date(a.updated_at).getTime() - new Date(a.published_at).getTime() > 86400e3 ? <> · Updated {new Date(a.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</> : null}
          {' · '}<Link href="/editorial-policy" className="underline">How we write</Link></p>
        {a.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.cover_url} alt="" className="mt-6 aspect-[16/8] w-full rounded-2xl object-cover" />
        )}
        <div className="prose-ses mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(a.body || '') }} />
        {a.tags?.length ? <div className="mt-6 flex flex-wrap gap-2">{a.tags.map((t) => <span key={t} className="chip">#{t}</span>)}</div> : null}
        <div className="mt-6"><ShareButtons title={a.title} path={`/news/${a.slug}`} /></div>
      </article>
      <aside className="space-y-6">
        {(more || []).length > 0 && (
          <div className="card p-5">
            <p className="mb-2 font-semibold text-slate-900">More in {a.category}</p>
            <ul className="space-y-2 text-sm">{(more || []).map((m: any) => <li key={m.slug}><Link href={`/news/${m.slug}`} className="text-brand-700 hover:underline">{m.title}</Link></li>)}</ul>
          </div>
        )}
        <div className="lg:sticky lg:top-24"><EnquiryForm compact /></div>
      </aside>
    </div>
  );
}
