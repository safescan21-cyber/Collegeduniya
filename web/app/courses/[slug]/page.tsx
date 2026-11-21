import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GraduationCap, MapPin } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { short, lpa } from '@/lib/format';
import { breadcrumbs } from '@/lib/seo';

export const revalidate = 3600;

async function load(slug: string) {
  if (!hasSupabase || !/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  const sb = supabasePublic();
  const { data: k } = await sb.from('course_catalog').select('*').eq('slug', slug).maybeSingle();
  if (!k) return null;
  const [{ data: st }, { data: top }, { data: ex }] = await Promise.all([
    sb.rpc('course_stats', { p_slug: slug, p_country: 'India' }),
    sb.rpc('course_colleges', { p_slug: slug, p_state: null, p_sort: 'rank', p_offset: 0, p_lim: 15 }),
    k.exam_slugs?.length ? sb.from('exams').select('slug, short_name, full_name').in('slug', k.exam_slugs).eq('is_published', true) : Promise.resolve({ data: [] as any[] }),
  ]);
  return { k, s: (st as any[] | null)?.[0] || {}, top: (top || []) as any[], exams: (ex || []) as any[] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await load((await params).slug);
  if (!d) return { title: 'Course not found', robots: { index: false } };
  const n = Number(d.s.colleges || 0);
  const bits = [d.k.duration, d.k.eligibility && `eligibility: ${d.k.eligibility.toLowerCase()}`, n ? `${n} colleges` : null, d.s.fee_min ? `fees from ${short(d.s.fee_min)} a year` : null].filter(Boolean);
  return {
    title: `${d.k.name} (${d.k.full_name}) — fees, eligibility, exams & colleges`,
    description: `${d.k.full_name}: ${bits.join(', ')}.`.slice(0, 158),
    alternates: { canonical: `/courses/${d.k.slug}` },
    // a course page needs real substance: colleges that offer it, or the team's own write-up
    robots: n >= 3 || d.k.about ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const d = await load((await params).slug);
  if (!d) notFound();
  const { k, s, top, exams } = d;
  const n = Number(s.colleges || 0);
  const states = (s.states || []) as { name: string; n: number }[];
  const rows: [string, React.ReactNode][] = ([
    ['Full name', k.full_name], ['Level', k.level], ['Duration', k.duration], ['Eligibility', k.eligibility],
    ['Entrance exams', exams.length ? <span className="flex flex-wrap gap-1.5">{exams.map((e) => <Link key={e.slug} href={`/exams/${e.slug}`} className="chip-brand hover:underline">{e.short_name}</Link>)}</span> : null],
    ['Colleges on Collegeolo', n ? <Link href={`/colleges?course=${k.slug}`} className="font-semibold text-brand-700 hover:underline">{n.toLocaleString('en-IN')} in India</Link> : null],
    ['Fees per year', s.fee_min ? (Number(s.fee_min) === Number(s.fee_max) ? short(s.fee_min) : `${short(s.fee_min)} – ${short(s.fee_max)} (typical ${short(s.fee_median)})`) : null],
    ['Government / private', n ? `${s.public_colleges} government · ${s.private_colleges} private or deemed` : null],
    ['Median salary (recent placements)', s.placement_median ? lpa(s.placement_median) : null],
  ] as [string, React.ReactNode][]).filter(([, v]) => v);
  return (
    <div className="container-x py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs([['Courses', '/courses'], [k.name, `/courses/${k.slug}`]])) }} />
      <nav className="text-sm text-slate-500"><Link href="/" className="hover:underline">Home</Link> / <Link href="/courses" className="hover:underline">Courses</Link> / {k.name}</nav>
      <h1 className="mt-2 flex items-center gap-2 text-3xl font-extrabold text-slate-900"><GraduationCap className="text-brand-600" />{k.name}</h1>
      <p className="text-slate-500">{k.full_name} · {k.stream}</p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <section className="card overflow-hidden">
            <h2 className="border-b border-slate-100 px-5 py-3 font-bold text-slate-900">{k.name} at a glance</h2>
            <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">{rows.map(([a, b]) => (
              <tr key={a}><th scope="row" className="w-2/5 bg-slate-50/70 px-5 py-2.5 text-left font-medium text-slate-600">{a}</th><td className="px-5 py-2.5 text-slate-900">{b}</td></tr>))}</tbody></table>
            <p className="px-5 py-2 text-xs text-slate-400">Numbers are worked out from the colleges listed on Collegeolo and their official fee and placement figures. Eligibility varies by college — check its admission page.</p>
          </section>
          {k.about && <section><h2 className="text-xl font-bold text-slate-900">About {k.name}</h2><p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{k.about}</p></section>}
          {top.length > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between"><h2 className="text-xl font-bold text-slate-900">Colleges for {k.name}</h2>
                {n > top.length && <Link href={`/colleges?course=${k.slug}`} className="text-sm font-semibold text-brand-700 hover:underline">All {n.toLocaleString('en-IN')} →</Link>}</div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2.5">College</th><th className="px-4 py-2.5">Course</th><th className="px-4 py-2.5">Fees / year</th><th className="px-4 py-2.5">Seats</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{top.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3"><Link href={`/colleges/${c.slug}#courses`} className="font-semibold text-slate-900 hover:text-brand-700">{c.name}</Link>
                        <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={11} />{[c.city, c.state].filter(Boolean).join(', ')}{c.rank_value ? ` · Rank #${c.rank_value}` : ''}</p></td>
                      <td className="px-4 py-3 text-slate-700">{c.course_name}{c.duration ? <span className="block text-xs text-slate-400">{c.duration}</span> : null}</td>
                      <td className="px-4 py-3 font-semibold">{c.fees ? short(c.fees, c.currency || 'INR') : <span className="font-normal text-slate-400">—</span>}</td>
                      <td className="px-4 py-3 text-slate-700">{c.seats || '—'}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            </section>)}
          {k.careers && <section><h2 className="text-xl font-bold text-slate-900">Jobs and careers after {k.name}</h2><p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{k.careers}</p></section>}
        </div>
        <aside className="space-y-4">
          {states.length > 0 && (
            <div className="card p-4"><p className="font-bold text-slate-900">{k.name} colleges by state</p>
              <ul className="mt-2 space-y-1 text-sm">{states.map((x) => (
                <li key={x.name}><Link href={`/colleges?course=${k.slug}&state=${encodeURIComponent(x.name)}`} className="flex justify-between hover:text-brand-700"><span>{x.name}</span><span className="text-slate-400">{x.n}</span></Link></li>))}</ul></div>)}
          <div className="card p-4"><p className="font-bold text-slate-900">Not sure which college?</p><p className="mt-1 text-sm text-slate-600">Enter your rank and see colleges where you have a real chance.</p>
            <Link href="/predictor" className="btn-primary mt-3 w-full">College predictor</Link></div>
        </aside>
      </div>
    </div>
  );
}
