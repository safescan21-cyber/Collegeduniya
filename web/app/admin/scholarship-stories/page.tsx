'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle2, XCircle, BadgeCheck, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

// Check stories from scholarship recipients before they go live. The award-letter photo is deleted once you decide.
export default function AdminScholarshipStories() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await api(`/api/admin/scholarship-stories?status=${status}`).catch(() => ({ data: [] }));
    setRows(r.data || []); setLoading(false);
  }, [status]);
  useEffect(() => { load(); }, [load]);
  const decide = async (id: string, body: any) => { await api(`/api/admin/scholarship-stories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).catch((e) => alert(e.message)); load(); };
  const del = async (id: string) => { await api(`/api/admin/scholarship-stories/${id}`, { method: 'DELETE' }).catch((e) => alert(e.message)); load(); };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Scholarship stories</h1>
      <p className="mt-1 text-sm text-slate-500">Written by students who say they received a scholarship. Approve only real, respectful stories with no phone numbers or links. Tick “Award verified” only if the award letter matches the name and scholarship.</p>
      <div className="mt-4 flex gap-2">{(['pending', 'approved', 'rejected'] as const).map((s) => <button key={s} onClick={() => setStatus(s)} className={status === s ? 'chip-brand' : 'chip'}>{s}</button>)}</div>
      {loading ? <Loader2 className="mt-6 animate-spin" /> : rows.length === 0 ? <p className="mt-6 text-sm text-slate-500">Nothing here.</p> : (
        <div className="mt-4 space-y-4">{rows.map((r) => (
          <div key={r.id} className="card p-4">
            <p className="text-sm text-slate-500"><Link href={`/scholarships/${r.scholarships?.slug}`} className="font-semibold text-brand-700">{r.scholarships?.name}</Link> · by {r.profiles?.full_name || '—'} ({r.profiles?.email || 'no email'})</p>
            <p className="mt-1 font-semibold">{r.display_name} · received {r.year_awarded}{r.course ? ` · ${r.course}` : ''}{r.college ? ` · ${r.college}` : ''} {r.verified && <BadgeCheck size={14} className="inline text-emerald-600" />}</p>
            <p className="mt-2 whitespace-pre-line text-slate-700">{r.story}</p>
            {r.tips && <p className="mt-2 whitespace-pre-line text-sm text-slate-600"><b>Tips:</b> {r.tips}</p>}
            {r.proof_url ? <a href={r.proof_url} target="_blank" rel="noopener noreferrer"><img src={r.proof_url} alt="Award letter" className="mt-3 max-h-80 rounded border" /></a>
              : status === 'pending' && <p className="mt-2 text-xs text-slate-400">No award letter uploaded.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {status !== 'approved' && <button onClick={() => decide(r.id, { status: 'approved', verified: false })} className="btn-ghost py-1.5 text-sm"><CheckCircle2 size={15} />Approve</button>}
              {status !== 'approved' && r.proof_url && <button onClick={() => decide(r.id, { status: 'approved', verified: true })} className="btn-primary py-1.5 text-sm"><BadgeCheck size={15} />Approve + award verified</button>}
              {status !== 'rejected' && <button onClick={() => decide(r.id, { status: 'rejected' })} className="btn-ghost py-1.5 text-sm text-rose-700"><XCircle size={15} />Reject</button>}
              <button onClick={() => del(r.id)} className="btn-ghost py-1.5 text-sm"><Trash2 size={15} />Delete</button>
            </div>
          </div>))}</div>
      )}
    </div>
  );
}
