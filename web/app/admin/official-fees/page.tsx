'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { api } from '@/lib/api';

type F = { id: string; course: string; level: string; fee: number; currency: string; period: string; fee_per_year: number | null; duration: string | null;
  quote: string; source_url: string; review_status: string; found_at: string; college: { id: string; name: string; slug: string; city: string | null; country: string } };
const money = (n: number, c: string) => { try { return new Intl.NumberFormat(c === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n); } catch { return `${c} ${n}`; } };

// Fees read automatically from colleges' own websites (server/src/services/officialFees.js). They are live already;
// admins check them here: ✓ keeps it, ✗ removes the course from the site and stops it coming back.
export default function OfficialFees() {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rows, setRows] = useState<F[] | null>(null); const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const [progress, setProgress] = useState<{ list: string; colleges: number; with_website: number; read: number; with_fees: number }[]>([]);
  const load = useCallback(async () => { setRows(null); const r = await api(`/api/admin/official-fees?status=${tab}`); setRows(r.data || []); setCount(r.count || 0); setProgress(r.progress || []); }, [tab]);
  useEffect(() => { load(); }, [load]);
  const review = async (f: F, status: 'approved' | 'rejected') => {
    setBusy(f.id); await api(`/api/admin/official-fees/${f.id}/review`, { method: 'POST', body: JSON.stringify({ status }) }).catch((e) => alert(e.message));
    setBusy(''); setRows((l) => (l || []).filter((x) => x.id !== f.id)); setCount((c) => c - 1);
  };
  const runNow = async () => {
    setBusy('run'); setMsg('');
    try { const r = await api('/api/admin/official-fees/run?limit=3', { method: 'POST' }); setMsg(r.skipped ? `Skipped: ${r.skipped}` : `Read ${r.checked} college website(s), found ${r.added} new fee(s)${r.blocked ? `, ${r.blocked} site(s) don’t allow robots` : ''}.`); load(); }
    catch (e: any) { setMsg(e.message); }
    setBusy('');
  };
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h1 className="text-xl font-bold text-slate-900">Official fees</h1>
        <p className="mt-1 text-sm text-slate-600">The server reads each college’s <b>own website</b> (fee structure pages and PDF notices) every hour, 12 colleges at a time — <b>NIRF-ranked colleges first</b> (best rank first), then <b>world-ranked universities</b>, then the rest.
          A fee is kept only when the sentence with that amount is on the official page; it shows on the site straight away. Check the ones below: ✓ keep, ✗ remove for good.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['pending', 'approved', 'rejected'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`${tab === t ? 'btn-primary' : 'btn-ghost'} py-1.5 text-sm`}>{t === 'pending' ? 'Needs review' : t === 'approved' ? 'Approved' : 'Rejected'}</button>)}
          <button onClick={runNow} disabled={!!busy} className="btn-ghost ms-auto py-1.5 text-sm">{busy === 'run' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Read 3 colleges now</button>
        </div>
        {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
        {progress.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{progress.map((p) => {
          const pct = p.with_website ? Math.min(100, Math.round((100 * p.read) / p.with_website)) : 0;
          return <div key={p.list} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-baseline justify-between"><b className="text-sm text-slate-900">{p.list === 'NIRF ranked' ? '1 · NIRF-ranked colleges' : '2 · World-ranked universities'}</b><span className="text-xs text-slate-500">{pct}% read</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} /></div>
            <p className="mt-2 text-xs text-slate-600">{p.read.toLocaleString('en-IN')} of {p.with_website.toLocaleString('en-IN')} websites read · <b>{p.with_fees.toLocaleString('en-IN')}</b> colleges with fees
              {p.colleges > p.with_website ? <> · <span className="text-amber-700">{(p.colleges - p.with_website).toLocaleString('en-IN')} have no website on file</span></> : null}</p>
          </div>; })}</div>}
      </div>
      <div className="card overflow-x-auto">
        {rows === null ? <Loader2 className="m-6 animate-spin text-slate-300" /> : rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{tab === 'pending' ? 'Nothing to review right now.' : 'None yet.'}</p> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">College · course</th><th className="p-3">Fee</th><th className="p-3">Found on the official page</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((f) => (
              <tr key={f.id} className="align-top">
                <td className="p-3"><Link href={`/colleges/${f.college.slug}`} target="_blank" className="font-semibold text-slate-900 hover:underline">{f.college.name}</Link>
                  <p className="text-xs text-slate-500">{[f.college.city, f.college.country].filter(Boolean).join(', ')}</p>
                  <p className="mt-1">{f.course} <span className="rounded bg-slate-100 px-1 text-[11px]">{f.level}</span></p></td>
                <td className="whitespace-nowrap p-3"><b>{money(f.fee, f.currency)}</b> / {f.period}{f.duration ? ` · ${f.duration}` : ''}
                  {f.period !== 'year' && f.fee_per_year != null && <p className="text-xs text-slate-500">= {money(f.fee_per_year, f.currency)} / year</p>}
                  {f.period === 'total' && f.fee_per_year == null && <p className="text-xs text-amber-600">per-year not shown (length unknown)</p>}</td>
                <td className="max-w-md p-3"><p className="text-xs italic text-slate-600">“{f.quote}”</p>
                  <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">Open the page<ExternalLink size={11} /></a></td>
                <td className="whitespace-nowrap p-3">{tab !== 'approved' && <button onClick={() => review(f, 'approved')} disabled={busy === f.id} className="btn-ghost px-2 py-1.5 text-emerald-600" title="Correct — keep"><Check size={15} /></button>}
                  {tab !== 'rejected' && <button onClick={() => review(f, 'rejected')} disabled={busy === f.id} className="btn-ghost px-2 py-1.5 text-rose-600" title="Wrong — remove for good"><X size={15} /></button>}</td>
              </tr>))}</tbody>
          </table>)}
        {count > 50 && <p className="p-3 text-xs text-slate-500">Showing 50 of {count}. Review these and the next ones appear.</p>}
      </div>
    </div>
  );
}
