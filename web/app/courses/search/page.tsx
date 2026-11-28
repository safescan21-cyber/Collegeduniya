import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Globe2, Search, Trophy } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { collegeCountries, cleanTerm } from '@/lib/data';

type SP = { q?: string; country?: string; level?: string; max?: string; sort?: string; page?: string };
type Row = { id: string; name: string; level: string | null; duration: string | null; fees: number | null; currency: string; fees_inr: number | null;
  url: string | null; study_mode: string | null; college_id: string; college_name: string; college_slug: string; city: string | null; country: string;
  country_code: string | null; world_rank: number | null; nirf_rank: number | null; total: number };

const PER = 20;
const POPULAR = ['Computer Science', 'Data Science', 'Artificial Intelligence', 'MBA', 'Medicine', 'Mechanical Engineering', 'Nursing', 'Law', 'Psychology', 'Finance', 'Architecture', 'Biotechnology'];
const BUDGETS = [['', 'Any budget'], ['500000', 'Up to ₹5 L / year'], ['1000000', 'Up to ₹10 L / year'], ['2000000', 'Up to ₹20 L / year'], ['3500000', 'Up to ₹35 L / year']] as const;
const inr = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const money = (n: number, cur: string) => { try { return new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); } catch { return `${cur} ${Math.round(n).toLocaleString('en')}`; } };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const what = sp.q ? `${sp.q} courses` : 'Courses';
  return {
    title: `${what}${sp.country ? ` in ${sp.country}` : ' worldwide'} — best universities & fees`,
    description: `Compare ${what.toLowerCase()} at universities${sp.country ? ` in ${sp.country}` : ' around the world'}: world ranking, yearly fees in rupees, duration and the official course page.`,
    alternates: { canonical: '/courses/search' },
    robots: sp.q || sp.country || sp.level ? { index: false, follow: true } : undefined,
  };
}

export default async function CourseSearch({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const q = cleanTerm(sp.q);
  const searched = !!(q || sp.country || sp.level || sp.max);
  const [countries, res] = await Promise.all([
    collegeCountries(),
    hasSupabase && searched ? supabasePublic().rpc('course_search', {
      p_q: q || null, p_country: sp.country || null, p_level: sp.level || null, p_max_inr: sp.max ? Number(sp.max) || null : null,
      p_sort: sp.sort || 'best', p_offset: (page - 1) * PER, p_lim: PER,
    }) : Promise.resolve({ data: [] as Row[] }),
  ]);
  const rows = ((res as any).data || []) as Row[];
  const total = rows[0]?.total || 0;
  const pages = Math.ceil(Math.min(total, 5000) / PER);
  const link = (patch: Partial<SP>) => { const u = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]); return `/courses/search?${u.toString()}`; };

  return (
    <div className="container-x max-w-5xl py-8">
      <nav className="text-sm text-slate-500"><Link href="/" className="hover:underline">Home</Link> / <Link href="/courses" className="hover:underline">Courses</Link> / Search</nav>
      <h1 className="mt-2 flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Globe2 className="text-brand-600" />Find the best course, worldwide</h1>
      <p className="mt-1 text-slate-600">Search courses at universities in {countries.length || 'many'} countries. Best universities first (world research ranking), with yearly fees shown in rupees.</p>

      <form action="/courses/search" className="card mt-5 grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative"><Search size={16} className="absolute start-3 top-3 text-slate-400" />
          <input name="q" defaultValue={sp.q || ''} className="input ps-9" placeholder="Course — e.g. computer science, MBA, nursing" maxLength={80} /></div>
        <select name="country" defaultValue={sp.country || ''} className="input" aria-label="Country"><option value="">All countries</option>{countries.map((c) => <option key={c}>{c}</option>)}</select>
        <select name="level" defaultValue={sp.level || ''} className="input" aria-label="Level"><option value="">Any level</option><option value="UG">Bachelor’s (UG)</option><option value="PG">Master’s (PG)</option><option value="PhD">PhD</option><option value="Diploma">Diploma</option></select>
        <select name="max" defaultValue={sp.max || ''} className="input" aria-label="Budget">{BUDGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button className="btn-primary"><Search size={16} />Search</button>
      </form>

      {!searched ? (
        <div className="mt-6">
          <p className="text-sm font-semibold text-slate-700">Popular searches</p>
          <div className="mt-2 flex flex-wrap gap-2">{POPULAR.map((p) => <Link key={p} href={`/courses/search?q=${encodeURIComponent(p)}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700">{p}</Link>)}</div>
          <p className="mt-6 text-sm font-semibold text-slate-700">Or browse a country</p>
          <div className="mt-2 flex flex-wrap gap-2">{['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Ireland', 'France', 'Netherlands', 'Japan', 'Singapore', 'New Zealand'].filter((c) => countries.includes(c)).map((c) => (
            <Link key={c} href={`/courses/search?country=${encodeURIComponent(c)}`} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-brand-300">{c}</Link>))}</div>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-slate-600"><b>{total > 5000 ? '5,000+' : total.toLocaleString('en-IN')}</b> course{total === 1 ? '' : 's'}{q ? ` for “${q}”` : ''}{sp.country ? ` in ${sp.country}` : ''}</p>
            <div className="flex gap-1">{([['best', 'Best universities'], ['fees_low', 'Lowest fees'], ['fees_high', 'Highest fees']] as const).map(([k, l]) => (
              <Link key={k} href={link({ sort: k, page: '' })} className={`rounded-full px-3 py-1 ${(sp.sort || 'best') === k ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{l}</Link>))}</div>
          </div>
          {rows.length === 0 ? <div className="card mt-4 p-10 text-center text-slate-500">No courses found. Try a shorter word (e.g. “computer” instead of “computer science engineering”) or another country.</div> : (
            <ul className="mt-4 space-y-3">{rows.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">{r.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                    {r.country_code && <Flag code={r.country_code} country={r.country} className="h-3.5 w-5 rounded-sm" />}
                    <Link href={`/colleges/${r.college_slug}`} className="font-medium text-brand-700 hover:underline">{r.college_name}</Link>
                    <span className="text-slate-400">· {[r.city, r.country].filter(Boolean).join(', ')}</span>
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                    {r.world_rank && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700"><Trophy size={11} />World #{r.world_rank} (research)</span>}
                    {r.nirf_rank && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">NIRF #{r.nirf_rank}</span>}
                    {r.level && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{r.level}</span>}
                    {r.duration && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{r.duration}</span>}
                    {r.study_mode && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{r.study_mode}</span>}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  {r.fees ? <>
                    <p className="text-lg font-extrabold text-slate-900">{r.currency === 'INR' ? inr(Number(r.fees)) : money(Number(r.fees), r.currency)}<span className="text-xs font-normal text-slate-500"> / year</span></p>
                    {r.currency !== 'INR' && r.fees_inr && <p className="text-xs text-slate-500">≈ {inr(Number(r.fees_inr))} / year</p>}
                  </> : <p className="text-sm text-slate-400">Fee not listed</p>}
                  {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">Official course page<ExternalLink size={11} /></a>
                    : <Link href={`/colleges/${r.college_slug}#courses`} className="mt-1 inline-block text-xs text-brand-700 hover:underline">All courses here →</Link>}
                </div>
              </li>))}</ul>)}
          {pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm">
              {page > 1 && <Link href={link({ page: String(page - 1) })} className="btn-ghost py-1.5">← Previous</Link>}
              <span className="text-slate-500">Page {page} of {pages}</span>
              {page < pages && <Link href={link({ page: String(page + 1) })} className="btn-ghost py-1.5">Next →</Link>}
            </div>)}
          <p className="mt-6 text-xs text-slate-500">“Best universities” orders by the CWTS Leiden Ranking (research output), then India’s NIRF rank. Fees are converted to rupees with today’s exchange rate (Exchange Rate API) and are a guide only — always check the official course page.</p>
        </>)}
    </div>
  );
}
