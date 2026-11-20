'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Loader2, Phone, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

const STATUSES = ['pending', 'shortlisted', 'hired', 'rejected'];
const CHIP: Record<string, string> = { pending: 'chip-amber', shortlisted: 'chip-brand', hired: 'chip-green', rejected: 'chip-red' };

function Applications() {
  const params = useSearchParams();
  const jobId = params.get('job_id') || '';
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '25' });
    if (status) p.set('status', status);
    if (jobId) p.set('job_id', jobId);
    const r = await api(`/api/admin/applications?${p}`).catch(() => ({ data: [], count: 0 }));
    setRows(r.data); setCount(r.count); setLoading(false);
  }, [status, page, jobId]);
  useEffect(() => { load(); }, [load]);

  const update = async (id: string, body: any) => {
    try { await api(`/api/admin/applications/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); load(); } catch (e: any) { alert(e.message); }
  };
  const resume = async (id: string) => {
    try { const { url } = await api(`/api/admin/applications/${id}/resume`); window.open(url, '_blank'); } catch (e: any) { alert(e.message); }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Job applications <span className="text-sm font-normal text-slate-400">({count})</span>{jobId && <span className="chip ml-2">filtered by job</span>}</h1>
        <div className="flex gap-1">
          {['', ...STATUSES].map((s) => <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1); }} className={`${status === s ? 'btn-primary' : 'btn-ghost'} py-1.5 capitalize`}>{s || 'All'}</button>)}
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Applicant</th><th className="px-4 py-3">Job</th><th className="px-4 py-3">Message</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Resume</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="py-10 text-center text-slate-400">No applications.</td></tr>
              : rows.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{a.full_name}</p>
                    <a href={`tel:${a.phone}`} className="flex items-center gap-1 text-xs text-slate-600"><Phone size={12} />{a.phone}</a>
                    {a.email && <a href={`mailto:${a.email}`} className="flex items-center gap-1 text-xs text-brand-700"><Mail size={12} />{a.email}</a>}
                    <p className="mt-1 text-xs text-slate-400">{timeAgo(a.created_at)}</p>
                  </td>
                  <td className="px-4 py-3"><p className="font-medium">{a.jobs?.title}</p><p className="text-xs text-slate-500">{a.jobs?.company} · {a.jobs?.city}</p></td>
                  <td className="max-w-xs px-4 py-3 text-slate-600"><p className="line-clamp-4 whitespace-pre-line">{a.cover_letter || '—'}</p></td>
                  <td className="px-4 py-3">
                    <select value={a.status} onChange={(e) => update(a.id, { status: e.target.value })} className={`${CHIP[a.status]} cursor-pointer border-0 capitalize`}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">{a.resume_path ? <button onClick={() => resume(a.id)} className="btn-ghost px-2 py-1.5"><Download size={14} />CV</button> : <span className="text-slate-400">—</span>}{a.resume_snapshot && <a href={`/resume/view?app=${a.id}`} target="_blank" className="btn-ghost ms-1 px-2 py-1.5 text-xs">Resume</a>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {count > 25 && (
        <div className="mt-4 flex justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost">Prev</button>
          <button disabled={page >= Math.ceil(count / 25)} onClick={() => setPage(page + 1)} className="btn-ghost">Next</button>
        </div>
      )}
    </div>
  );
}

export default function AdminApplications() {
  return <Suspense fallback={null}><Applications /></Suspense>;
}
