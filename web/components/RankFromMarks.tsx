'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Calculator, Loader2, ArrowRight, Users } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function RankFromMarks({ exam, examName, maxMarks, categories = [] }: { exam: string; examName: string; maxMarks?: number | null; categories?: string[] }) {
  const supabase = supabaseBrowser();
  const [marks, setMarks] = useState('');
  const [category, setCategory] = useState('All');
  const [res, setRes] = useState<{ year: number; rank_low: number; rank_high: number; rank_estimate: number; source: string | null } | null | 'none'>(null);
  const [busy, setBusy] = useState(false);
  const [peers, setPeers] = useState<{ year: number; reports: number; rank_low: number; rank_median: number; rank_high: number; marks_low: number; marks_high: number } | null>(null);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = Number(marks);
    if (!Number.isFinite(m)) return;
    setBusy(true);
    const win = maxMarks ? Math.max(1, Math.round(maxMarks * 0.02)) : 5;
    const [{ data }, { data: rep }] = await Promise.all([
      supabase.rpc('predict_rank', { p_exam: exam, p_marks: m, p_category: category }),
      supabase.rpc('rank_from_reports', { p_exam: exam, p_marks: m, p_window: win, p_category: category === 'All' ? 'General' : category }),
    ]);
    setBusy(false);
    setRes(data?.[0] || 'none');
    setPeers(rep?.[0] || null);
  };
  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-bold text-slate-900"><Calculator size={18} className="text-brand-600" />{examName} marks → rank</p>
      <form onSubmit={run} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm"><span className="label">Your marks{maxMarks ? ` (out of ${maxMarks})` : ''}</span>
          <input className="input w-32" inputMode="decimal" value={marks} onChange={(e) => setMarks(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 180" /></label>
        {categories.length > 1 && <label className="text-sm"><span className="label">Category</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{['All', ...categories.filter((c) => c !== 'All')].map((c) => <option key={c}>{c}</option>)}</select></label>}
        <button className="btn-primary" disabled={busy || !marks}>{busy ? <Loader2 size={16} className="animate-spin" /> : null}Estimate rank</button>
      </form>
      {res === 'none' && !peers && <p className="mt-3 text-sm text-slate-500">No marks-vs-rank data for that score yet. Got your result? Share it below to help next year's students.</p>}
      {res && res !== 'none' && (
        <div className="mt-3 rounded-xl bg-brand-50 p-3">
          <p className="text-sm text-slate-600">Expected rank (based on {res.year} data)</p>
          <p className="text-2xl font-extrabold text-brand-800">≈ {res.rank_estimate.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Likely range {res.rank_low.toLocaleString()} – {res.rank_high.toLocaleString()}{res.source ? ` · Source: ${res.source}` : ''}. Actual ranks depend on this year’s paper and number of candidates.</p>
          <Link href={`/predictor/${exam}?rank=${res.rank_estimate}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Colleges you can get at this rank <ArrowRight size={14} /></Link>
        </div>
      )}
      {peers && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Users size={15} className="text-brand-600" />Real results shared by {peers.reports} students ({peers.year})</p>
          <p className="mt-1 text-sm text-slate-600">With {peers.marks_low}–{peers.marks_high} marks they got ranks <b>{peers.rank_low.toLocaleString()} – {peers.rank_high.toLocaleString()}</b> (middle: {peers.rank_median.toLocaleString()}).</p>
          {res === 'none' && <Link href={`/predictor/${exam}?rank=${peers.rank_median}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Colleges at rank {peers.rank_median.toLocaleString()} <ArrowRight size={14} /></Link>}
        </div>
      )}
    </div>
  );
}
