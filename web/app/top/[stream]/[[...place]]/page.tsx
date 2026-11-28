import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Trophy, MapPin } from 'lucide-react';
import { CollegeCard, EmptyState } from '@/components/Cards';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { ratingsFor } from '@/lib/data';
import { SITE_URL } from '@/lib/format';
import { topLabel, topPath } from '@/lib/top';

export const revalidate = 21600;
const YEAR = new Date().getFullYear();
type P = { stream: string; place?: string[] };

async function load(p: P) {
  if (!hasSupabase) return null;
  const place = p.place?.[0];
  if ((p.place?.length || 0) > 1) return null;
  const sb = supabasePublic();
  const { data: r } = await sb.rpc('resolve_top', { p_stream: p.stream, p_place: place ?? null });
  const t = (r as any[])?.[0];
  if (!t) return null;
  let q = sb.from('colleges_public').select('*', { count: 'exact' }).eq('is_published', true).contains('streams', [t.stream]);
  if (t.place_type === 'country') q = q.eq('country_code', t.place_key);
  if (t.place_type === 'state') q = q.eq('state', t.place_key);
  if (t.place_type === 'city') q = q.eq('city_geoname_id', Number(t.place_key));
  const { data, count } = await q.order('ranking', { ascending: true, nullsFirst: false }).order('is_featured', { ascending: false }).order('name').limit(30);
  const colleges = (data || []) as any[];
  const ratings = await ratingsFor(colleges.map((c) => c.id));
  // nearby pages for internal links: other streams here, other places for this stream
  const { data: all } = await sb.rpc('stream_place_counts', { p_min: 3 }).limit(3000);
  const rows = (all || []) as any[];
  const otherStreams = rows.filter((x) => x.place_type === t.place_type && (t.place_type === 'world' || x.place_slug === (place || '').toLowerCase()) && x.stream !== t.stream);
  const worldStreams = Array.from(new Map(rows.map((x) => [x.stream_slug, x.stream])).entries());
  const sameStream = rows.filter((x) => x.stream === t.stream && (t.country_code ? x.country_code === t.country_code : true) && x.place_slug !== (place || '').toLowerCase())
    .sort((a, b) => b.colleges - a.colleges).slice(0, 24);
  return { t, colleges, total: count || colleges.length, ratings, otherStreams: t.place_type === 'world' ? worldStreams.filter(([, n]) => n !== t.stream).map(([s, n]) => ({ stream_slug: s, stream: n })) : otherStreams, sameStream };
}

export async function generateMetadata({ params }: { params: Promise<P> }): Promise<Metadata> {
  const p = await params;
  const d = await load(p);
  if (!d) return { title: 'Not found' };
  const label = topLabel(d.t.stream, d.t.place);
  return {
    title: `${label} ${YEAR}: fees, ranking, placements & reviews`,
    description: `List of ${d.total} ${d.t.stream.toLowerCase()} colleges${d.t.place ? ` in ${d.t.place}` : ''} in order of official rank (NIRF where available), with fees and student reviews where we have them.`,
    alternates: { canonical: topPath(p.stream, p.place?.[0]) },
  };
}

export default async function TopColleges({ params }: { params: Promise<P> }) {
  const p = await params;
  const d = await load(p);
  if (!d) notFound();
  const { t, colleges, ratings } = d;
  const label = topLabel(t.stream, t.place);
  const top3 = colleges.slice(0, 3).map((c) => c.name).join(', ');
  const fees = colleges.map((c) => c.fees_min).filter((x) => x != null) as number[];
  const faq = [
    colleges.length ? { q: `Which are the ${label.toLowerCase()}?`, a: `Based on official ranking where available, the top ones are ${top3}. See the full list of ${d.total} colleges on this page.` } : null,
    { q: `How is this list ranked?`, a: 'Colleges with an official national ranking (such as NIRF) come first, in rank order; the rest follow by featured status and name. We never sell ranks.' },
    fees.length ? { q: `What is the lowest fee for ${t.stream.toLowerCase()} here?`, a: `The lowest listed starting fee is ${Math.min(...fees).toLocaleString('en-IN')} per year — always confirm on the college’s official fee notice.` } : null,
  ].filter(Boolean) as { q: string; a: string }[];
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'ItemList', name: label, numberOfItems: colleges.length,
      itemListElement: colleges.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/colleges/${c.slug}`, name: c.name })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Top colleges', item: `${SITE_URL}/top` },
      { '@type': 'ListItem', position: 2, name: `Top ${t.stream} colleges`, item: `${SITE_URL}${topPath(p.stream)}` },
      ...(t.place ? [{ '@type': 'ListItem', position: 3, name: label, item: `${SITE_URL}${topPath(p.stream, p.place?.[0])}` }] : []),
    ] },
  ];

  return (
    <div className="container-x py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="text-sm text-slate-500"><Link href="/top" className="hover:text-slate-800">Top colleges</Link>
        {t.place && <> / <Link href={topPath(p.stream)} className="hover:text-slate-800">{t.stream}</Link></>}</nav>
      <h1 className="mt-2 flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><Trophy className="text-amber-500" />{label} {YEAR}</h1>
      <p className="mt-1 text-slate-500">{d.total} colleges · ranked by official ranking first · fees, placements and reviews on each college page</p>

      {colleges.length ? (
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {colleges.map((c, i) => (
            <li key={c.id} className="relative">
              <span className="absolute -left-2 -top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white shadow">#{i + 1}</span>
              <CollegeCard c={c} rating={ratings[c.id]} />
            </li>
          ))}
        </ol>
      ) : <EmptyState title="No colleges listed here yet" />}

      {d.total > colleges.length && (
        <p className="mt-6 text-center"><Link className="btn-ghost" href={`/colleges?stream=${encodeURIComponent(t.stream)}${t.place_type === 'city' ? `&city=${encodeURIComponent(t.place)}` : t.place_type === 'state' ? `&q=${encodeURIComponent(t.place)}` : ''}`}>See all {d.total} colleges</Link></p>
      )}

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        {d.otherStreams.length > 0 && <section>
          <h2 className="text-lg font-bold text-slate-900">Other streams{t.place ? ` in ${t.place}` : ''}</h2>
          <div className="mt-3 flex flex-wrap gap-2">{d.otherStreams.slice(0, 30).map((x: any) => (
            <Link key={x.stream_slug} href={topPath(x.stream_slug, t.place ? p.place?.[0] : undefined)} className="chip hover:bg-brand-50">{x.stream}{x.colleges ? ` (${x.colleges})` : ''}</Link>))}</div>
        </section>}
        {d.sameStream.length > 0 && <section>
          <h2 className="text-lg font-bold text-slate-900">Top {t.stream} colleges in other places</h2>
          <div className="mt-3 flex flex-wrap gap-2">{d.sameStream.map((x: any) => (
            <Link key={x.place_type + x.place_slug} href={topPath(x.stream_slug, x.place_slug)} className="chip hover:bg-brand-50"><MapPin size={11} />{x.place} ({x.colleges})</Link>))}</div>
        </section>}
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="text-xl font-bold text-slate-900">Frequently asked</h2>
        <div className="mt-3 space-y-3">{faq.map((f) => <details key={f.q} className="card p-4"><summary className="cursor-pointer font-semibold">{f.q}</summary><p className="mt-2 text-sm text-slate-600">{f.a}</p></details>)}</div>
      </section>
    </div>
  );
}
