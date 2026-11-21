'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

type R = { id: string; exam_slug: string; year: number; session: string; category: string; marks: number | null; percentile: number | null; rank: number; status: string; flag: string | null; created_at: string };

export default function AdminRankReports() {
  const sb = supabaseBrowser();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rows, setRows] = useState<R[] | null>(null); const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await sb.from('rank_reports').select('*').eq('status', status).order('created_at', { ascending: false }).limit(200);
    if (error) setMsg(error.message); setRows((data || []) as R[]);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const decide = async (ids: string[], s: 'approved' | 'rejected') => {
    const { error } = await sb.from('rank_reports').update({ status: s }).in('id', ids);
    if (error) setMsg(error.message); else load();
  };
  const clean = (rows || []).filter((r) => !r.flag).map((r) => r.id);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rank results from students</h1>
        <p className="text-sm text-slate-500">Students share marks/percentile and the rank on their scorecard. Approved results show on the rank predictor and give a "students with similar marks got…" estimate. Unusual numbers are flagged automatically — reject anything that doesn't add up. Official marks-vs-rank figures go in <Link href="/admin/rank-bands" className="text-brand-700 underline">Rank bands</Link>.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={status === s ? 'btn-primary' : 'btn-ghost'}>{s[0].toUpperCase() + s.slice(1)}</button>
        ))}
        {status === 'pending' && clean.length > 0 && <button onClick={() => decide(clean, 'approved')} className="btn-ghost ms-auto"><Check size={16} />Approve all {clean.length} unflagged</button>}
      </div>
      {msg && <p className="text-sm text-rose-600">{msg}</p>}
      <div className="card overflow-x-auto">
        {!rows ? <Loader2 className="m-5 animate-spin text-slate-300" /> : !rows.length ? <p className="p-5 text-sm text-slate-500">Nothing here.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="p-3">Exam</th><th>Year</th><th>Category</th><th>Marks</th><th>Percentile</th><th>Rank</th><th>Check</th><th>Sent</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className={r.flag ? 'bg-amber-50/60' : ''}>
                  <td className="p-3 font-semibold">{r.exam_slug}</td><td>{r.year}{r.session !== 'All' ? ` · ${r.session}` : ''}</td><td>{r.category}</td>
                  <td>{r.marks ?? '—'}</td><td>{r.percentile ?? '—'}</td><td className="font-semibold">{r.rank.toLocaleString('en-IN')}</td>
                  <td>{r.flag ? <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle size={14} />{r.flag}</span> : <span className="text-emerald-700">looks fine</span>}</td>
                  <td className="text-slate-500">{timeAgo(r.created_at)}</td>
                  <td className="whitespace-nowrap pe-3 text-right">
                    {r.status !== 'approved' && <button onClick={() => decide([r.id], 'approved')} className="btn-ghost px-2 py-1" aria-label="Approve"><Check size={14} /></button>}
                    {r.status !== 'rejected' && <button onClick={() => decide([r.id], 'rejected')} className="btn-ghost ms-1 px-2 py-1" aria-label="Reject"><X size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
