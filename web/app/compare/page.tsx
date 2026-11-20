import type { Metadata } from 'next';
import Link from 'next/link';
import { Scale, Star, CheckCircle2, XCircle } from 'lucide-react';
import CompareClient from './CompareClient';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { FALLBACK_IMG, money, range } from '@/lib/format';
import type { College, Course, Placement } from '@/lib/types';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const slugs = ((await searchParams).c || '').split(',').filter(Boolean);
  return { title: slugs.length > 1 ? `Compare ${slugs.join(' vs ').replace(/-/g, ' ')}` : 'Compare colleges side by side' };
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<SP> }) {
  const slugs = ((await searchParams).c || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  let colleges: College[] = [];
  const courses: Record<string, Course[]> = {};
  const placements: Record<string, Placement | undefined> = {};
  const ratings: Record<string, { avg_rating: number; review_count: number }> = {};

  if (hasSupabase && slugs.length) {
    const sb = supabasePublic();
    const { data } = await sb.from('colleges_public').select('*').in('slug', slugs).eq('is_published', true);
    colleges = slugs.map((s) => (data || []).find((c: College) => c.slug === s)).filter(Boolean) as College[];
    const ids = colleges.map((c) => c.id);
    if (ids.length) {
      const [co, pl, ra] = await Promise.all([
        sb.from('courses').select('*').in('college_id', ids),
        sb.from('college_placements').select('*').in('college_id', ids).order('year', { ascending: false }),
        sb.from('college_ratings').select('*').in('college_id', ids),
      ]);
      (co.data || []).forEach((x: Course) => { (courses[x.college_id] ||= []).push(x); });
      (pl.data || []).forEach((x: Placement) => { if (!placements[x.college_id]) placements[x.college_id] = x; });
      (ra.data || []).forEach((x: any) => { ratings[x.college_id] = { avg_rating: Number(x.avg_rating), review_count: x.review_count }; });
    }
  }

  const rows: { label: string; render: (c: College) => React.ReactNode }[] = [
    { label: 'Location', render: (c) => [c.city, c.state, c.country].filter(Boolean).join(', ') },
    { label: 'Ownership', render: (c) => c.type || '—' },
    { label: 'Established', render: (c) => c.established || '—' },
    { label: 'Ranking', render: (c) => (c.ranking ? `#${c.ranking}` : '—') },
    { label: 'Accreditation', render: (c) => c.accreditation || '—' },
    { label: 'Fees / year', render: (c) => <strong>{range(c.fees_min, c.fees_max, c.currency)}</strong> },
    { label: 'Student rating', render: (c) => ratings[c.id] ? <span className="flex items-center gap-1"><Star size={14} className="fill-accent-400 text-accent-400" />{ratings[c.id].avg_rating} <span className="text-slate-400">({ratings[c.id].review_count})</span></span> : 'No reviews' },
    { label: 'Average package', render: (c) => placements[c.id]?.avg_package ? money(placements[c.id]!.avg_package, placements[c.id]!.currency || 'INR') : '—' },
    { label: 'Highest package', render: (c) => placements[c.id]?.highest_package ? money(placements[c.id]!.highest_package, placements[c.id]!.currency || 'INR') : '—' },
    { label: 'Placement rate', render: (c) => (placements[c.id]?.placement_rate ? `${placements[c.id]!.placement_rate}%` : '—') },
    { label: 'Top recruiters', render: (c) => placements[c.id]?.top_recruiters?.slice(0, 4).join(', ') || '—' },
    { label: 'Courses offered', render: (c) => (courses[c.id]?.length ? `${courses[c.id].length} (${Array.from(new Set(courses[c.id].map((x) => x.level))).join(', ')})` : '—') },
    { label: 'Popular courses', render: (c) => (courses[c.id] || []).slice(0, 4).map((x) => <p key={x.id} className="text-xs">{x.name} · {money(x.fees, x.currency || c.currency || 'INR')}</p>) },
    { label: 'Streams', render: (c) => c.streams?.join(', ') || '—' },
    { label: 'Hostel on campus', render: (c) => (c.facilities || []).some((f) => /hostel|residence/i.test(f)) ? <CheckCircle2 size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-slate-300" /> },
    { label: 'Facilities', render: (c) => c.facilities?.join(', ') || '—' },
    { label: 'Accepts StudyEarnstay application', render: (c) => c.accepts_applications ? <CheckCircle2 size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-slate-300" /> },
  ];

  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Scale className="text-brand-600" />Compare colleges</h1>
      <p className="mt-1 text-slate-500">Pick up to 4 colleges. Use the <Scale size={14} className="inline" /> button on any college card to add it.</p>

      <div className="mt-6"><CompareClient selected={colleges.map((c) => ({ id: c.id, slug: c.slug, name: c.name, city: c.city }))} /></div>

      {colleges.length >= 2 ? (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr>
                <th className="w-48 bg-slate-50 p-4" />
                {colleges.map((c) => (
                  <th key={c.id} className="p-4 align-top">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.cover_url || FALLBACK_IMG} alt="" className="mb-3 aspect-[16/9] w-full rounded-xl object-cover" />
                    <Link href={`/colleges/${c.slug}`} className="font-bold text-slate-900 hover:text-brand-700">{c.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.label} className="align-top">
                  <th className="bg-slate-50 p-4 text-xs font-semibold uppercase text-slate-500">{r.label}</th>
                  {colleges.map((c) => <td key={c.id} className="p-4 text-slate-700">{r.render(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card mt-6 p-10 text-center text-slate-500">Add at least 2 colleges to compare. <Link href="/colleges" className="font-semibold text-brand-700">Browse colleges →</Link></div>
      )}
    </div>
  );
}
