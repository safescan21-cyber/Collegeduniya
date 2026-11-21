import type { Metadata } from 'next';
import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import Pagination from '@/components/Pagination';
import { EmptyState } from '@/components/Cards';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { FALLBACK_IMG, timeAgo } from '@/lib/format';
import type { Article } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Education news, admission alerts & student guides',
  description: 'Latest admission news, exam updates, study abroad guides and tips on PGs and part-time jobs for students.',
};
const CATS = [
  { key: '', label: 'All' }, { key: 'news', label: 'News' }, { key: 'admission', label: 'Admissions' }, { key: 'exam', label: 'Exams' },
  { key: 'abroad', label: 'Study abroad' }, { key: 'guide', label: 'Guides' }, { key: 'hostel', label: 'PG & Hostels' }, { key: 'jobs', label: 'Jobs' },
];
const PER_PAGE = 12;
type SP = Record<string, string | undefined>;

export default async function NewsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  let items: Article[] = []; let total = 0;
  if (hasSupabase) {
    let q = supabasePublic().from('articles').select('id, slug, title, excerpt, category, cover_url, published_at, author_name', { count: 'exact' })
      .eq('is_published', true).lte('published_at', new Date().toISOString()).order('published_at', { ascending: false });
    if (sp.category) q = q.eq('category', sp.category);
    const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    items = (data || []) as Article[]; total = count || 0;
  }
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Newspaper className="text-brand-600" />News & guides</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        {CATS.map((c) => <Link key={c.key} href={c.key ? `/news?category=${c.key}` : '/news'} className={(sp.category || '') === c.key ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>{c.label}</Link>)}
      </div>
      {items.length ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <Link key={a.id} href={`/news/${a.slug}`} className="card group overflow-hidden transition hover:shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.cover_url || FALLBACK_IMG} alt="" className="aspect-[16/8] w-full object-cover" loading="lazy" />
              <div className="p-5">
                <span className="chip-brand capitalize">{a.category}</span>
                <h2 className="mt-2 font-bold text-slate-900 group-hover:text-brand-700">{a.title}</h2>
                {a.excerpt && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.excerpt}</p>}
                <p className="mt-2 text-xs text-slate-400">{a.author_name || 'Collegeolo'} · {timeAgo(a.published_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : <div className="mt-6"><EmptyState title="No articles yet" text="News and guides added from the admin panel appear here." /></div>}
      <Pagination page={page} total={total} perPage={PER_PAGE} basePath="/news" params={sp} />
    </div>
  );
}
