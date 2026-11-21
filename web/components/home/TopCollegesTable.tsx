'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { short, lpa } from '@/lib/format';

export type TopRow = { id: string; slug: string; name: string; city: string; state: string | null; logo_url: string | null; rank_source: string | null; rank_value: number;
  rank_year: number | null; fee_low: number | null; currency: string | null; placement_avg: number | null; placement_highest: number | null;
  avg_rating: number | null; review_count: number; cutoff_exam: string | null; cutoff_rank: number | null; rank_category?: string | null;
  other_ranks?: { category: string; rank: number }[] };

const STREAMS = ['All', 'Engineering', 'Management', 'Medical', 'Law', 'Pharmacy', 'Architecture', 'Commerce', 'Science', 'Arts'];

// Ranked colleges by stream, with the facts students compare first. Ranks come from the published ranking (NIRF for India).
export default function TopCollegesTable({ initial, examNames, fixedStream }: { initial: TopRow[]; examNames: Record<string, string>; fixedStream?: string }) {
  const [stream, setStream] = useState(fixedStream || 'All');
  const [rows, setRows] = useState<TopRow[]>(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (fixedStream || stream === 'All') { setRows(initial); return; }
    setBusy(true);
    supabaseBrowser().rpc('top_colleges_table_v2', { p_stream: stream, p_country: 'India', p_lim: 10 })
      .then(({ data }: { data: TopRow[] | null }) => { setRows(data || []); setBusy(false); });
  }, [stream, initial, fixedStream]);
  // show a column only when at least one college in the list has that information
  const has = { fees: rows.some((r) => r.fee_low), place: rows.some((r) => r.placement_avg || r.placement_highest), reviews: rows.some((r) => r.review_count),
    cutoff: rows.some((r) => r.cutoff_rank), other: rows.some((r) => (r.other_ranks || []).length) };
  return (
    <div className="card overflow-hidden">
      {!fixedStream && <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2" role="tablist">{STREAMS.map((s) => (
        <button key={s} role="tab" aria-selected={stream === s} onClick={() => setStream(s)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${stream === s ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{s}</button>))}</div>}
      <div className={`overflow-x-auto transition-opacity ${busy ? 'opacity-50' : ''}`}>
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No ranked {stream.toLowerCase()} colleges yet. <Link href={`/colleges?stream=${stream}`} className="font-semibold text-brand-700">See all {stream.toLowerCase()} colleges</Link></p> : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="px-4 py-2.5">Rank</th><th className="px-4 py-2.5">College</th>
              {has.fees && <th className="px-4 py-2.5">Fees / year</th>}{has.place && <th className="px-4 py-2.5">Placement</th>}
              {has.reviews && <th className="px-4 py-2.5">Reviews</th>}{has.cutoff && <th className="px-4 py-2.5">Cutoff</th>}
              {has.other && <th className="px-4 py-2.5">Also ranked ({rows[0]?.rank_year})</th>}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3"><b className="text-lg text-slate-900">#{r.rank_value}</b><span className="block text-[10px] text-slate-400">{r.rank_source ? `${r.rank_source} ${r.rank_year || ''}${r.rank_category && r.rank_category !== 'Overall' ? ` · ${r.rank_category}` : ''}` : 'rank'}</span></td>
                <td className="px-4 py-3"><div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.logo_url ? <img src={r.logo_url} alt="" className="h-full w-full object-contain" loading="lazy" /> : <b className="text-brand-700">{r.name[0]}</b>}</span>
                  <div><Link href={`/colleges/${r.slug}`} className="font-semibold text-slate-900 hover:text-brand-700">{r.name}</Link><p className="text-xs text-slate-500">{[r.city, r.state].filter(Boolean).join(', ')}</p></div></div></td>
                {has.fees && <td className="px-4 py-3">{r.fee_low ? <b>{short(r.fee_low, r.currency || 'INR')}<span className="font-normal text-slate-400">+</span></b> : <Link href={`/colleges/${r.slug}#courses`} className="text-xs text-slate-400 hover:text-brand-700">Ask us</Link>}</td>}
                {has.place && <td className="px-4 py-3">{r.placement_avg ? <><b>{lpa(r.placement_avg, r.currency || 'INR')}</b> <span className="text-xs text-slate-500">avg</span></> : r.placement_highest ? <>{lpa(r.placement_highest)} <span className="text-xs text-slate-500">highest</span></> : <span className="text-slate-400">—</span>}</td>}
                {has.reviews && <td className="px-4 py-3">{r.review_count ? <span className="flex items-center gap-1"><Star size={13} className="fill-amber-400 text-amber-400" /><b>{Number(r.avg_rating).toFixed(1)}</b><span className="text-xs text-slate-500">({r.review_count})</span></span> : <Link href={`/colleges/${r.slug}#reviews`} className="text-xs text-slate-400 hover:text-brand-700">Write the first</Link>}</td>}
                {has.cutoff && <td className="px-4 py-3">{r.cutoff_rank ? <span className="text-xs"><b className="text-sm">{r.cutoff_rank.toLocaleString('en-IN')}</b><br />{examNames[r.cutoff_exam!] || r.cutoff_exam} closing rank</span> : <span className="text-slate-400">—</span>}</td>}
                {has.other && <td className="px-4 py-3 text-xs">{(r.other_ranks || []).length ? (r.other_ranks || []).map((o) => <span key={o.category} className="me-1 mb-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">#{o.rank} {o.category}</span>) : <span className="text-slate-400">—</span>}</td>}
              </tr>))}</tbody>
          </table>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Ranks from the latest NIRF India Rankings (Ministry of Education). <Link href="/rankings" className="underline">Full lists</Link>. Fees, placements and cutoffs appear as colleges publish them.</span>
        <Link href={`/colleges${stream === 'All' ? '' : `?stream=${stream}`}`} className="font-semibold text-brand-700 hover:underline">All {stream === 'All' ? '' : `${stream.toLowerCase()} `}colleges →</Link>
      </div>
    </div>
  );
}
