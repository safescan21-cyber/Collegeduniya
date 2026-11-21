'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { short, lpa } from '@/lib/format';

export type TopRow = { id: string; slug: string; name: string; city: string; state: string | null; logo_url: string | null; rank_source: string | null; rank_value: number;
  rank_year: number | null; fee_low: number | null; currency: string | null; placement_avg: number | null; placement_highest: number | null;
  avg_rating: number | null; review_count: number; cutoff_exam: string | null; cutoff_rank: number | null };

const STREAMS = ['All', 'Engineering', 'Management', 'Medical', 'Law', 'Pharmacy', 'Architecture', 'Commerce', 'Science', 'Arts'];

// Ranked colleges by stream, with the facts students compare first. Ranks come from the published ranking (NIRF for India).
export default function TopCollegesTable({ initial, examNames, fixedStream }: { initial: TopRow[]; examNames: Record<string, string>; fixedStream?: string }) {
  const [stream, setStream] = useState(fixedStream || 'All');
  const [rows, setRows] = useState<TopRow[]>(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (fixedStream || stream === 'All') { setRows(initial); return; }
    setBusy(true);
    supabaseBrowser().rpc('top_colleges_table', { p_stream: stream, p_country: 'India', p_lim: 10 })
      .then(({ data }: { data: TopRow[] | null }) => { setRows(data || []); setBusy(false); });
  }, [stream, initial, fixedStream]);
  return (
    <div className="card overflow-hidden">
      {!fixedStream && <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2" role="tablist">{STREAMS.map((s) => (
        <button key={s} role="tab" aria-selected={stream === s} onClick={() => setStream(s)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${stream === s ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{s}</button>))}</div>}
      <div className={`overflow-x-auto transition-opacity ${busy ? 'opacity-50' : ''}`}>
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No ranked {stream.toLowerCase()} colleges yet. <Link href={`/colleges?stream=${stream}`} className="font-semibold text-brand-700">See all {stream.toLowerCase()} colleges</Link></p> : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="px-4 py-2.5">Rank</th><th className="px-4 py-2.5">College</th><th className="px-4 py-2.5">Fees / year</th><th className="px-4 py-2.5">Placement</th><th className="px-4 py-2.5">Reviews</th><th className="px-4 py-2.5">Cutoff</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3"><b className="text-lg text-slate-900">#{r.rank_value}</b><span className="block text-[10px] text-slate-400">{r.rank_source ? `${r.rank_source} ${r.rank_year || ''}` : 'rank'}</span></td>
                <td className="px-4 py-3"><div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.logo_url ? <img src={r.logo_url} alt="" className="h-full w-full object-contain" loading="lazy" /> : <b className="text-brand-700">{r.name[0]}</b>}</span>
                  <div><Link href={`/colleges/${r.slug}`} className="font-semibold text-slate-900 hover:text-brand-700">{r.name}</Link><p className="text-xs text-slate-500">{[r.city, r.state].filter(Boolean).join(', ')}</p></div></div></td>
                <td className="px-4 py-3">{r.fee_low ? <b>{short(r.fee_low, r.currency || 'INR')}<span className="font-normal text-slate-400">+</span></b> : <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-3">{r.placement_avg ? <><b>{lpa(r.placement_avg, r.currency || 'INR')}</b> <span className="text-xs text-slate-500">avg</span></> : r.placement_highest ? <>{lpa(r.placement_highest)} <span className="text-xs text-slate-500">highest</span></> : <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-3">{r.review_count ? <span className="flex items-center gap-1"><Star size={13} className="fill-amber-400 text-amber-400" /><b>{Number(r.avg_rating).toFixed(1)}</b><span className="text-xs text-slate-500">({r.review_count})</span></span> : <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-3">{r.cutoff_rank ? <span className="text-xs"><b className="text-sm">{r.cutoff_rank.toLocaleString('en-IN')}</b><br />{examNames[r.cutoff_exam!] || r.cutoff_exam} closing rank</span> : <span className="text-slate-400">—</span>}</td>
              </tr>))}</tbody>
          </table>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Ranks from the latest published ranking (NIRF for India). Fees and placements from each college’s official figures.</span>
        <Link href={`/colleges${stream === 'All' ? '' : `?stream=${stream}`}`} className="font-semibold text-brand-700 hover:underline">All {stream === 'All' ? '' : `${stream.toLowerCase()} `}colleges →</Link>
      </div>
    </div>
  );
}
