'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { short, lpa, money } from '@/lib/format';

export type WorldRow = { id: string; slug: string; name: string; city: string | null; state: string | null; country: string | null; logo_url: string | null;
  world_rank: number; country_rank: number | null; rank_year: number | null; courses: number; fee_min: number | null; fee_currency: string | null; fee_min_inr: number | null;
  placement: number | null; placement_kind: string | null; placement_currency: string | null; median_earnings: number | null;
  top_courses: { name: string; level: string | null; fees: number | null; currency: string }[] | null };

const cleanCourse = (n: string) => n.replace(/^Bachelor['’]s degree — /, 'Bachelor’s — ').replace(/^Master['’]s degree — /, 'Master’s — ').replace(/^Doctoral degree — /, 'PhD — ');

// The same table as the NIRF "Top colleges" one, for the world ranking: tabs by country instead of stream.
export default function WorldCollegesTable({ initial, countries }: { initial: WorldRow[]; countries: string[] }) {
  const [country, setCountry] = useState('All');
  const [rows, setRows] = useState<WorldRow[]>(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (country === 'All') { setRows(initial); return; }
    setBusy(true);
    supabaseBrowser().rpc('world_top_table', { p_country: country, p_lim: 10 })
      .then(({ data }: { data: WorldRow[] | null }) => { setRows(data || []); setBusy(false); });
  }, [country, initial]);
  const has = { fees: rows.some((r) => r.fee_min), place: rows.some((r) => r.placement || r.median_earnings), courses: rows.some((r) => r.courses) };
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2" role="tablist">{['All', ...countries].map((s) => (
        <button key={s} role="tab" aria-selected={country === s} onClick={() => setCountry(s)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${country === s ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{s}</button>))}</div>
      <div className={`overflow-x-auto transition-opacity ${busy ? 'opacity-50' : ''}`}>
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No world-ranked universities from {country} yet. <Link href={`/colleges?country=${encodeURIComponent(country)}`} className="font-semibold text-brand-700">See all colleges in {country}</Link></p> : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="px-4 py-2.5">Rank</th><th className="px-4 py-2.5">University</th>
              {has.fees && <th className="px-4 py-2.5">Fees / year</th>}{has.place && <th className="px-4 py-2.5">Placement</th>}
              {has.courses && <th className="px-4 py-2.5">Courses</th>}<th className="px-4 py-2.5">Also ranked</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3"><b className="text-lg text-slate-900">#{r.world_rank}</b><span className="block text-[10px] text-slate-400">World {r.rank_year || ''}</span></td>
                <td className="px-4 py-3"><div className="flex items-center gap-3">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
                    <b className="text-brand-700">{r.name[0]}</b>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.logo_url && <img src={r.logo_url} alt="" className="absolute inset-0 h-full w-full bg-white object-contain" loading="lazy" referrerPolicy="no-referrer" />}</span>
                  <div><Link href={`/colleges/${r.slug}`} className="font-semibold text-slate-900 hover:text-brand-700">{r.name}</Link>
                    <p className="text-xs text-slate-500">{[r.city && r.city !== 'Not specified' ? r.city : null, r.state, r.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</p></div></div></td>
                {has.fees && <td className="px-4 py-3">{r.fee_min ? <><b>{r.fee_min_inr ? short(r.fee_min_inr) : money(r.fee_min, r.fee_currency || 'INR')}<span className="font-normal text-slate-400">+</span></b>
                  {r.fee_currency && r.fee_currency !== 'INR' && <span className="block text-xs text-slate-500">{money(r.fee_min, r.fee_currency)}</span>}</>
                  : <Link href={`/colleges/${r.slug}#courses`} className="text-xs text-slate-400 hover:text-brand-700">Ask us</Link>}</td>}
                {has.place && <td className="px-4 py-3">{r.placement ? <><b>{lpa(r.placement, r.placement_currency || 'INR')}</b> <span className="text-xs text-slate-500">{r.placement_kind || 'avg'}</span></>
                  : r.median_earnings ? <><b>{money(r.median_earnings, 'USD')}</b> <span className="block text-xs text-slate-500">earnings after 10 yrs</span></> : <span className="text-slate-400">—</span>}</td>}
                {has.courses && <td className="px-4 py-3 text-xs">{r.courses ? <><Link href={`/colleges/${r.slug}#courses`} className="font-semibold text-brand-700 hover:underline">{r.courses.toLocaleString('en-IN')} courses</Link>
                  {(r.top_courses || []).slice(0, 2).map((k) => <span key={k.name} className="block max-w-[220px] truncate text-slate-500">{cleanCourse(k.name)}</span>)}</> : <span className="text-slate-400">—</span>}</td>}
                <td className="px-4 py-3 text-xs">{r.country_rank ? <span className="me-1 mb-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">#{r.country_rank} in {r.country}</span> : <span className="text-slate-400">—</span>}</td>
              </tr>))}</tbody>
          </table>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Ranks from the CWTS Leiden Ranking (research output). <Link href="/rankings?src=world" className="underline">Full world list</Link>. Fees from official sources, converted to rupees at today’s rate.</span>
        <Link href={country === 'All' ? '/rankings?src=world' : `/colleges?country=${encodeURIComponent(country)}`} className="font-semibold text-brand-700 hover:underline">All {country === 'All' ? 'world-ranked universities' : `colleges in ${country}`} →</Link>
      </div>
    </div>
  );
}
