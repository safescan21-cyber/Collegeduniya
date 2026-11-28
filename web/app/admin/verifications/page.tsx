'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

export default function AdminVerifications() {
  const [status, setStatus] = useState('review');
  const [rows, setRows] = useState<any[] | null>(null); const [busy, setBusy] = useState('');
  const load = useCallback(() => api<{ data: any[] }>(`/api/admin/verifications?status=${status}`).then((r) => setRows(r.data)).catch(() => setRows([])), [status]);
  useEffect(() => { load(); }, [load]);
  const decide = async (id: string, approve: boolean) => {
    const note = approve ? null : prompt('Reason shown to the student (optional)');
    if (!approve && note === null) return;
    setBusy(id); try { await api(`/api/admin/verifications/${id}/decide`, { method: 'POST', body: JSON.stringify({ approve, note }) }); load(); } catch (e: any) { alert(e.message); } finally { setBusy(''); }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><h1 className="text-xl font-bold">Selfie verifications</h1>
        <select className="input ms-auto w-auto py-1.5" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="review">Needs a look</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="pending">Pending</option></select></div>
      <p className="text-sm text-slate-500">The AI approves or rejects most checks by itself. It sends you only the ones it is unsure about. Selfies are deleted as soon as you decide.</p>
      {rows === null ? <div className="card h-40 animate-pulse" /> : rows.length === 0 ? <div className="card p-8 text-center text-slate-500">Nothing here.</div> : rows.map((r) => (
        <div key={r.id} className="card p-4 text-sm">
          <p><b>{r.profiles?.full_name}</b> {r.profiles?.username && <span className="text-slate-500">@{r.profiles.username}</span>} · {r.profiles?.email} · says <b>{r.profiles?.gender || '—'}</b> · {r.profiles?.colleges?.name || 'no college'}</p>
          <p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString('en-IN')} ({timeAgo(r.created_at)}) · action asked: “{r.challenge}”</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {[['Profile photo', r.profiles?.avatar_url], ['Selfie', r.selfies?.[0]], ['Doing the action', r.selfies?.[1]]].map(([l, u]) => (
              <figure key={l as string} className="w-40"><figcaption className="mb-1 text-xs text-slate-500">{l}</figcaption>
                {u ? <img src={u as string} alt="" className="h-48 w-40 rounded-lg bg-slate-100 object-cover" /> : <div className="flex h-48 w-40 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">deleted</div>}</figure>))}
          </div>
          {r.ai && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs">AI ({r.ai.model}): live {String(r.ai.real_live_person)} · spoof {String(r.ai.spoof_signs)} · action {String(r.ai.challenge_done)} · same person {String(r.ai.same_person_in_selfies)} · matches photo {String(r.ai.matches_profile_photo)} · presents as {r.ai.presents_as} · confidence {r.ai.confidence} — {r.ai.reason}</p>}
          {r.reason && status !== 'review' && <p className="mt-1 text-xs text-slate-600">Result: {r.reason} ({r.decided_by})</p>}
          {status === 'review' && <div className="mt-3 flex gap-2">
            <button onClick={() => decide(r.id, true)} disabled={!!busy} className="btn-primary py-1.5">{busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}Approve</button>
            <button onClick={() => decide(r.id, false)} disabled={!!busy} className="btn-ghost py-1.5 text-rose-600"><X size={15} />Reject</button></div>}
        </div>))}
    </div>
  );
}
