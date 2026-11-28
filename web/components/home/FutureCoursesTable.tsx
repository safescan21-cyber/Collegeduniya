'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket, ArrowRight } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { short, lpa, money } from '@/lib/format';

// Courses for the jobs expected to grow fastest to 2030 — World Economic Forum, Future of Jobs Report 2025
// (fastest-growing roles: big data, FinTech, AI/ML, software, security, renewable-energy & environmental engineers,
// EV/autonomous-vehicle specialists; largest growth in core roles: care, education, farming).
// `term` is matched against course names the same way as the college search ("Course — any country").
type Course = { title: string; term: string; why: string };
const SECTORS: { name: string; courses: Course[] }[] = [
  { name: 'Technology', courses: [
    { title: 'Artificial Intelligence & Machine Learning', term: 'artificial intelligence', why: 'AI & machine-learning specialists — top 3 fastest-growing jobs' },
    { title: 'Data Science & Big Data', term: 'data science', why: 'Big data specialists — the fastest-growing job' },
    { title: 'Cyber Security', term: 'cyber', why: 'Security management specialists — top 5 fastest-growing' },
    { title: 'Software Engineering', term: 'software', why: 'Software & application developers — top 5 fastest-growing' },
  ] },
  { name: 'Business & Finance', courses: [
    { title: 'FinTech', term: 'fintech', why: 'FinTech engineers — 2nd fastest-growing job' },
    { title: 'Business Analytics', term: 'business analytics', why: 'Business intelligence analysts — among the fastest-growing' },
  ] },
  { name: 'Energy & Environment', courses: [
    { title: 'Renewable Energy', term: 'renewable', why: 'Renewable energy engineers — top 15 fastest-growing' },
    { title: 'Environmental Engineering & Science', term: 'environmental', why: 'Environmental engineers — top 15 fastest-growing' },
    { title: 'Electric & Autonomous Vehicles', term: 'electric vehicle', why: 'EV & autonomous-vehicle specialists — top 15 fastest-growing' },
    { title: 'Sustainability', term: 'sustainab', why: 'Sustainability specialists — among the fastest-growing' },
  ] },
  { name: 'Health & Care', courses: [
    { title: 'Nursing', term: 'nursing', why: 'Nursing & care roles — among the largest job growth to 2030' },
    { title: 'Public Health', term: 'public health', why: 'Care and health roles — large growth with ageing populations' },
  ] },
  { name: 'Education', courses: [
    { title: 'Education & Teaching (B.Ed / M.Ed)', term: 'education', why: 'Teachers & educators — among the largest job growth to 2030' },
  ] },
  { name: 'Agriculture', courses: [
    { title: 'Agriculture & Agri-tech', term: 'agricultur', why: 'Farm workers — the largest growth of any job by 2030' },
  ] },
];

type Hit = { id: string; world_rank: number | null; country_rank: number | null; rank_label: string | null; courses: number; course_name: string | null; fee_min_inr: number | null;
  course_list: { name: string; level: string | null; fees: number | null; currency: string }[] | null; total: number };
type Facts = { id: string; slug: string; city: string | null; state: string | null; country: string | null; logo: string | null; photo: string | null;
  placement: number | null; placement_kind: string | null; placement_currency: string | null; median_earnings: number | null };
type College = { id: string; name: string };
type Block = { course: Course; total: number; rows: { hit: Hit; f?: Facts; name: string }[] };

const cache = new Map<string, Block[]>();

export default function FutureCoursesTable() {
  const [sector, setSector] = useState(SECTORS[0].name);
  const [scope, setScope] = useState<'country' | 'world'>('country');
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  useEffect(() => {
    const key = `${sector}|${scope}`; let live = true;
    if (cache.has(key)) { setBlocks(cache.get(key)!); return; }
    setBlocks(null);
    const sb = supabaseBrowser();
    const list = SECTORS.find((s) => s.name === sector)!.courses;
    Promise.all(list.map((course) => sb.rpc('course_rank_lists', { p_course: course.term, p_scope: scope, p_country: 'India', p_state: null, p_offset: 0, p_lim: 5 })
      .then(({ data }: { data: Hit[] | null }) => ({ course, hits: (data || []) as Hit[] }))))
      .then(async (res: { course: Course; hits: Hit[] }[]) => {
        const ids = [...new Set(res.flatMap((r) => r.hits.map((h) => h.id)))];
        const [{ data: facts }, { data: names }] = ids.length ? await Promise.all([
          sb.rpc('rank_card_facts', { p_ids: ids }), sb.from('colleges_public').select('id, name').in('id', ids),
        ]) : [{ data: [] }, { data: [] }];
        const fm = new Map(((facts || []) as Facts[]).map((f) => [f.id, f]));
        const nm = new Map(((names || []) as College[]).map((c) => [c.id, c.name]));
        const out = res.map(({ course, hits }) => ({ course, total: hits[0]?.total || 0,
          rows: hits.filter((h) => nm.has(h.id)).map((hit) => ({ hit, f: fm.get(hit.id), name: nm.get(hit.id)! })) }))
          .filter((b) => b.rows.length);
        cache.set(key, out); if (live) setBlocks(out);
      });
    return () => { live = false; };
  }, [sector, scope]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-2">
        <div className="flex gap-1 overflow-x-auto" role="tablist">{SECTORS.map((s) => (
          <button key={s.name} role="tab" aria-selected={sector === s.name} onClick={() => setSector(s.name)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${sector === s.name ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{s.name}</button>))}</div>
        <div className="ms-auto flex rounded-lg bg-slate-100 p-0.5 text-sm">{(['country', 'world'] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)} className={`rounded-md px-3 py-1 font-medium ${scope === s ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'}`}>{s === 'country' ? '🇮🇳 India' : '🌍 World'}</button>))}</div>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {blocks === null ? [0, 1].map((i) => <div key={i} className="h-72 animate-pulse rounded-xl bg-slate-100" />)
          : blocks.length === 0 ? <p className="p-6 text-sm text-slate-500 lg:col-span-2">No colleges with these courses {scope === 'country' ? 'in India' : 'in the world ranking'} on Collegeolo yet — try {scope === 'country' ? '🌍 World' : '🇮🇳 India'}.</p>
          : blocks.map(({ course, total, rows }) => {
            const all = `/colleges?cq=${encodeURIComponent(course.term)}${scope === 'world' ? '&scope=world' : '&country=India'}`;
            return (
              <div key={course.term} className="overflow-hidden rounded-xl border border-slate-100">
                <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-brand-50 to-indigo-50 px-4 py-3">
                  <div><b className="flex items-center gap-1.5 text-slate-900"><Rocket size={15} className="text-brand-600" />{course.title}</b>
                    <p className="text-xs text-slate-500">{course.why}</p></div>
                  <Link href={all} className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-brand-700 shadow-sm hover:underline">{total.toLocaleString('en-IN')} colleges →</Link>
                </div>
                <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-2">Rank</th><th className="px-3 py-2">College</th><th className="px-3 py-2">Fees / year</th><th className="px-3 py-2">Placement</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{rows.map(({ hit, f, name }) => {
                    const k = hit.course_list?.[0];
                    const rank = scope === 'world' ? (hit.world_rank ? `#${hit.world_rank}` : null) : (hit.country_rank ? `#${hit.country_rank}` : null);
                    const rankNote = scope === 'world' ? 'World' : hit.rank_label === 'NIRF' ? 'NIRF' : 'India';
                    return (
                      <tr key={hit.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2.5 align-top">{rank ? <><b className="text-slate-900">{rank}</b><span className="block text-[10px] text-slate-400">{rankNote}</span></> : <span className="text-xs text-slate-400">—</span>}</td>
                        <td className="px-3 py-2.5"><div className="flex items-center gap-2.5">
                          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white"><b className="text-xs text-brand-700">{name[0]}</b>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {f?.logo && <img src={f.logo} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full bg-white object-contain" />}</span>
                          <div className="min-w-0"><Link href={f ? `/colleges/${f.slug}` : `/colleges?q=${encodeURIComponent(name)}`} className="line-clamp-1 font-semibold text-slate-900 hover:text-brand-700">{name}</Link>
                            <p className="line-clamp-1 text-xs text-slate-500">{k?.name || hit.course_name}{hit.courses > 1 ? ` +${hit.courses - 1} more` : ''}</p>
                            <p className="line-clamp-1 text-[11px] text-slate-400">{[f?.city && f.city !== 'Not specified' ? f.city : null, scope === 'world' ? f?.country : f?.state].filter(Boolean).join(', ')}</p></div></div></td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{k?.fees ? <><b>{k.currency === 'INR' ? short(k.fees) : hit.fee_min_inr ? short(hit.fee_min_inr) : money(k.fees, k.currency)}</b>{k.currency !== 'INR' && <span className="block text-[11px] text-slate-500">{money(k.fees, k.currency)}</span>}</>
                          : hit.fee_min_inr ? <b>{short(hit.fee_min_inr)}</b> : <Link href={f ? `/colleges/${f.slug}#courses` : all} className="text-xs text-slate-400 hover:text-brand-700">Ask us</Link>}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{f?.placement ? <><b>{lpa(f.placement, f.placement_currency || 'INR')}</b> <span className="text-[11px] text-slate-500">{f.placement_kind}</span></>
                          : f?.median_earnings ? <><b>{money(f.median_earnings, 'USD')}</b><span className="block text-[11px] text-slate-500">earnings, 10 yrs</span></> : <span className="text-slate-400">—</span>}</td>
                      </tr>); })}</tbody>
                </table></div>
                <Link href={all} className="flex items-center justify-end gap-1 border-t border-slate-100 px-4 py-2 text-xs font-semibold text-brand-700 hover:underline">All {course.title} colleges — {scope === 'world' ? 'world, then by country' : 'India, world and your state'} <ArrowRight size={13} /></Link>
              </div>); })}
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Which courses: the fastest-growing jobs to 2030 in the <a href="https://www.weforum.org/publications/the-future-of-jobs-report-2025/" target="_blank" rel="noopener noreferrer" className="underline">World Economic Forum Future of Jobs Report 2025</a> (survey of 1,000+ employers). Colleges ranked by NIRF in India and by the world research ranking; fees and placements from official sources.</p>
    </div>
  );
}
