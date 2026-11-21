'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Percent, ArrowRight } from 'lucide-react';

export type ExamStat = { year: number; session: string; total_candidates: number; source: string };

// Percentile → approximate rank. NTA/IIM percentiles are "% of candidates who scored at or below you", so
// candidates ahead of you ≈ (100 − percentile) × N / 100. Category ranks aren't computable from this.
export default function PercentileRank({ examName, stats, examSlug }: { examName: string; stats: ExamStat[]; examSlug?: string }) {
  const latestYear = Math.max(...stats.map((s) => s.year));
  const opts = stats.filter((s) => s.year === latestYear);
  const [sel, setSel] = useState(opts.find((s) => s.session === 'All') ? 'All' : opts[0].session);
  const [p, setP] = useState('');
  const st = opts.find((s) => s.session === sel) || opts[0];
  const v = Number(p);
  const ok = p !== '' && Number.isFinite(v) && v >= 0 && v <= 100;
  const rank = ok ? Math.max(1, Math.round(((100 - v) * st.total_candidates) / 100) + 1) : null;
  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-bold text-slate-900"><Percent size={18} className="text-brand-600" />{examName} percentile → rank</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm"><span className="label">Your percentile</span>
          <input className="input w-36" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value.replace(/[^\d.]/g, '').slice(0, 10))} placeholder="e.g. 98.75" /></label>
        {opts.length > 1 && <label className="text-sm"><span className="label">Session</span>
          <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>{opts.map((o) => <option key={o.session}>{o.session}</option>)}</select></label>}
      </div>
      {p !== '' && !ok && <p className="mt-2 text-sm text-rose-600">Percentile must be between 0 and 100.</p>}
      {rank && (
        <div className="mt-3 rounded-xl bg-brand-50 p-3">
          <p className="text-sm text-slate-600">Approximate overall rank</p>
          <p className="text-2xl font-extrabold text-brand-800">≈ {rank.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Based on {st.total_candidates.toLocaleString()} candidates ({st.year}{st.session !== 'All' ? `, ${st.session}` : ''}) · Source: {st.source}. Official ranks also depend on ties and normalisation; category ranks are lower.</p>
          {examSlug && <Link href={`/predictor/${examSlug}?rank=${rank}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Colleges you can get at this rank <ArrowRight size={14} /></Link>}
        </div>
      )}
    </div>
  );
}
