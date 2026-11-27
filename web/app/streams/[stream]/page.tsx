import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Target, Calculator, Scale, MessageCircleQuestion, ClipboardCheck, Home, MapPin, Newspaper } from 'lucide-react';
import TopCollegesTable, { type TopRow } from '@/components/home/TopCollegesTable';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { streamBySlug, STREAMS } from '@/lib/streams';
import { short, timeAgo, SITE_URL } from '@/lib/format';
import { newsDate, sourceName } from '@/lib/newsDate';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts
const YEAR = new Date().getFullYear();

async function load(slug: string) {
  const s = streamBySlug(slug);
  if (!s) return null;
  if (!hasSupabase) return { s, top: [], exams: [], courses: [], cities: [], news: [], overview: null as any };
  const sb = supabasePublic();
  const [top, ex, cat, cnt, cities, ov] = await Promise.all([
    sb.rpc('top_colleges_table_v2', { p_stream: s.name, p_country: 'India', p_lim: 10 }),
    sb.from('exams').select('id, slug, short_name, full_name, level, exam_date, conducting_body').eq('is_published', true).eq('stream', s.name).order('short_name').limit(60),
    sb.from('course_catalog').select('slug, name, full_name, level, duration').eq('is_published', true).eq('stream', s.name).order('sort'),
    sb.rpc('course_catalog_counts'),
    sb.rpc('stream_cities', { p_stream: s.name, p_country: 'India', p_lim: 12 }),
    sb.rpc('stream_overview'),
  ]);
  const exams = (ex.data || []) as any[];
  const { data: news } = exams.length ? await sb.from('exam_news').select('id, title, url, source, published_at, official, exams(short_name)')
    .in('exam_id', exams.map((e) => e.id)).eq('is_hidden', false).order('published_at', { ascending: false }).limit(8) : { data: [] as any[] };
  const counts = Object.fromEntries(((cnt.data || []) as any[]).map((r) => [r.slug, { n: Number(r.colleges), fee: r.fee_min }]));
  return {
    s, top: (top.data || []) as TopRow[], exams,
    courses: ((cat.data || []) as any[]).map((k) => ({ ...k, colleges: counts[k.slug]?.n || 0, fee: counts[k.slug]?.fee })),
    cities: (cities.data || []) as { city: string; state: string | null; colleges: number }[],
    news: (news || []) as any[],
    overview: ((ov.data || []) as any[]).find((r) => r.stream === s.name) || null,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ stream: string }> }): Promise<Metadata> {
  const d = await load((await params).stream);
  if (!d) return { title: 'Stream not found', robots: { index: false } };
  const n = d.overview?.colleges || 0;
  return {
    title: `${d.s.label} colleges, courses & exams in India ${YEAR}`,
    description: `${n ? `${n.toLocaleString('en-IN')} ${d.s.name.toLowerCase()} colleges` : `${d.s.label} colleges`} with fees, placements and reviews, ${d.courses.length ? `${d.courses.length} courses, ` : ''}${d.exams.length ? `${d.exams.length} entrance exams, ` : ''}college and rank predictors.`,
    alternates: { canonical: `/streams/${d.s.slug}` },
    robots: n >= 5 || d.exams.length >= 2 ? undefined : { index: false, follow: true },
  };
}

export default async function StreamPage({ params }: { params: Promise<{ stream: string }> }) {
  const d = await load((await params).stream);
  if (!d) notFound();
  const { s, top, exams, courses, cities, news, overview } = d;
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: 'Streams', item: `${SITE_URL}/streams` },
    { '@type': 'ListItem', position: 3, name: s.label, item: `${SITE_URL}/streams/${s.slug}` }] };
  const tools = [
    { href: `/predictor${exams[0] ? `?exam=${exams[0].slug}` : ''}`, icon: Target, t: 'College predictor', d: 'Colleges for your rank' },
    { href: '/rank-predictor', icon: Calculator, t: 'Rank predictor', d: 'Marks or percentile → rank' },
    { href: '/compare', icon: Scale, t: 'Compare colleges', d: 'Fees, placements side by side' },
    { href: '/hostels', icon: Home, t: 'PG & hostels', d: 'Rooms near your college' },
    { href: '/mock-tests', icon: ClipboardCheck, t: 'Mock tests', d: 'Timed papers with ranks' },
    { href: '/questions', icon: MessageCircleQuestion, t: 'Ask students', d: 'Questions answered by students' },
  ];
  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <section className="bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 py-12 text-white">
        <div className="container-x">
          <nav className="text-sm text-white/70"><Link href="/streams" className="hover:underline">Streams</Link> / {s.label}</nav>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{s.label} in India</h1>
          <p className="mt-2 max-w-2xl text-white/80">{s.blurb}</p>
          <div className="mt-5 flex flex-wrap gap-6 text-sm">
            {[['Colleges', overview?.colleges], ['Courses', courses.length], ['Entrance exams', exams.length]].map(([k, v]) => (
              <div key={k as string}><p className="text-2xl font-extrabold">{Number(v || 0).toLocaleString('en-IN')}</p><p className="text-white/70">{k}</p></div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {['Colleges', 'Courses', 'Exams', 'Cities', 'News'].map((x) => <a key={x} href={`#${x.toLowerCase()}`} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20">{x}</a>)}
          </div>
        </div>
      </section>

      <div className="container-x space-y-14 py-10">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {tools.map((x) => (
            <Link key={x.t} href={x.href} className="card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <x.icon size={20} className="text-brand-600" /><p className="mt-2 font-semibold text-slate-900">{x.t}</p><p className="text-xs text-slate-500">{x.d}</p>
            </Link>
          ))}
        </section>

        <section id="colleges" className="scroll-mt-24">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="section-title">Top {s.name.toLowerCase()} colleges</h2>
            <Link href={`/colleges?stream=${encodeURIComponent(s.name)}`} className="text-sm font-semibold text-brand-700 hover:underline">All {s.name.toLowerCase()} colleges</Link>
          </div>
          <TopCollegesTable initial={top} examNames={Object.fromEntries(exams.map((e) => [e.slug, e.short_name]))} fixedStream={s.name} />
        </section>

        {courses.length > 0 && (
          <section id="courses" className="scroll-mt-24">
            <h2 className="section-title">{s.name} courses</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((k) => (
                <Link key={k.slug} href={`/courses/${k.slug}`} className="card flex items-center justify-between p-4 hover:shadow-md">
                  <div><p className="font-semibold text-slate-900">{k.name}</p>
                    <p className="text-xs text-slate-500">{k.level}{k.duration ? ` · ${k.duration}` : ''}{k.colleges ? ` · ${k.colleges.toLocaleString('en-IN')} college${k.colleges === 1 ? '' : 's'}` : ''}{k.fee ? ` · from ${short(Number(k.fee))}` : ''}</p></div>
                  <ArrowRight size={16} className="text-slate-400" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {exams.length > 0 && (
          <section id="exams" className="scroll-mt-24">
            <h2 className="section-title">{s.name} entrance exams</h2>
            <div className="mt-4 card divide-y divide-slate-100">
              {exams.map((e) => (
                <div key={e.slug} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link href={`/exams/${e.slug}`} className="font-semibold text-slate-900 hover:text-brand-700">{e.short_name}</Link>
                    <p className="truncate text-xs text-slate-500">{[e.full_name, e.conducting_body, e.exam_date].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Link href={`/predictor/${e.slug}`} className="chip hover:bg-slate-200">College predictor</Link>
                    <Link href={`/rank-predictor/${e.slug}`} className="chip hover:bg-slate-200">Rank predictor</Link>
                    <Link href={`/mock-tests/${e.slug}`} className="chip hover:bg-slate-200">Mock test</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {cities.length > 0 && (
            <section id="cities" className="scroll-mt-24">
              <h2 className="section-title">Where to study {s.name.toLowerCase()}</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {cities.map((c) => (
                  <Link key={c.city} href={`/colleges?stream=${encodeURIComponent(s.name)}&city=${encodeURIComponent(c.city)}`} className="card flex items-center justify-between p-3 text-sm hover:shadow-md">
                    <span className="flex items-center gap-1.5 font-medium text-slate-800"><MapPin size={14} className="text-brand-600" />{c.city}</span><span className="text-slate-500">{c.colleges}</span>
                  </Link>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Each city page also lists PGs, hostels and part-time jobs near the colleges.</p>
            </section>
          )}
          <section id="news" className="scroll-mt-24">
            <h2 className="section-title">Latest {s.name.toLowerCase()} exam news</h2>
            {news.length ? (
              <ul className="mt-4 card divide-y divide-slate-100">
                {news.map((n) => (
                  <li key={n.id} className="p-3">
                    <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-slate-900 hover:text-brand-700">{n.title}</a>
                    <p className="text-xs text-slate-500">{n.exams?.short_name}{n.official ? ' · Official' : ''} · Source: <b className="font-medium text-slate-600">{sourceName(n.source)}</b> · <time dateTime={n.published_at}>{newsDate(n.published_at)}</time></p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Newspaper size={16} />No news in the last few days. Follow an exam to get news by email.</p>}
          </section>
        </div>

        <section>
          <h2 className="section-title">Other streams</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {STREAMS.filter((x) => x.slug !== s.slug).map((x) => <Link key={x.slug} href={`/streams/${x.slug}`} className="chip hover:bg-slate-200">{x.label}</Link>)}
          </div>
        </section>
      </div>
    </div>
  );
}
