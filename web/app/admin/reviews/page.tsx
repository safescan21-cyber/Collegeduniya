'use client';
import { useCallback, useEffect, useState } from 'react';
import { Ban, CheckCircle2, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Stars } from '@/components/Cards';
import { timeAgo } from '@/lib/format';

const FILTERS = ['', 'approved', 'pending', 'blocked'];

export default function AdminReviews() {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) p.set('status', status);
    const r = await api(`/api/admin/reviews?${p}`).catch(() => ({ data: [], count: 0 }));
    setRows(r.data); setCount(r.count); setLoading(false);
  }, [status, page]);
  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, body: any) => {
    try { await api(`/api/admin/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); load(); } catch (e: any) { alert(e.message); }
  };
  const del = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return;
    await api(`/api/admin/reviews/${id}`, { method: 'DELETE' }).catch((e) => alert(e.message));
    load();
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Reviews <span className="text-sm font-normal text-slate-400">({count})</span></h1>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button key={f || 'all'} onClick={() => { setStatus(f); setPage(1); }} className={`${status === f ? 'btn-primary' : 'btn-ghost'} py-1.5 capitalize`}>{f || 'All'}</button>
          ))}
        </div>
      </div>

      {loading ? <div className="card grid h-40 place-items-center"><Loader2 className="animate-spin text-slate-400" /></div> : (
        <div className="space-y-3">
          {rows.length === 0 && <div className="card p-10 text-center text-slate-400">No reviews.</div>}
          {rows.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500"><span className="font-semibold text-slate-800">{r.profiles?.full_name || 'User'}</span> ({r.profiles?.email}) on <a href={`/colleges/${r.colleges?.slug}`} target="_blank" className="text-brand-700 hover:underline">{r.colleges?.name}</a> · {timeAgo(r.created_at)}</p>
                  <div className="mt-1 flex items-center gap-2"><Stars value={r.rating} />
                    <span className={r.status === 'approved' ? 'chip-green' : r.status === 'blocked' ? 'chip-red' : 'chip-amber'}>{r.status}</span>
                    {r.edited_by_admin && <span className="chip">edited</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {r.status !== 'approved' && <button onClick={() => patch(r.id, { status: 'approved' })} className="btn-ghost px-2 py-1.5 text-emerald-700" title="Approve"><CheckCircle2 size={14} />Approve</button>}
                  {r.status !== 'blocked' && <button onClick={() => patch(r.id, { status: 'blocked' })} className="btn-ghost px-2 py-1.5 text-rose-600" title="Block"><Ban size={14} />Block</button>}
                  <button onClick={() => setEdit({ ...r })} className="btn-ghost px-2 py-1.5" title="Edit"><Pencil size={14} /></button>
                  <button onClick={() => del(r.id)} className="btn-ghost px-2 py-1.5 text-rose-600" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="mt-3 font-semibold text-slate-900">{r.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      {count > 20 && (
        <div className="mt-4 flex justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost">Prev</button>
          <span className="self-center">Page {page} / {Math.ceil(count / 20)}</span>
          <button disabled={page >= Math.ceil(count / 20)} onClick={() => setPage(page + 1)} className="btn-ghost">Next</button>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={() => setEdit(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => { e.preventDefault(); await patch(edit.id, { title: edit.title, body: edit.body, rating: edit.rating }); setEdit(null); }}
            className="card w-full max-w-lg space-y-4 p-6">
            <div className="flex justify-between"><h3 className="font-bold">Edit review</h3><button type="button" onClick={() => setEdit(null)}><X /></button></div>
            <div><label className="label">Rating</label>
              <select className="input" value={edit.rating} onChange={(e) => setEdit({ ...edit, rating: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n}>{n}</option>)}</select></div>
            <div><label className="label">Title</label><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
            <div><label className="label">Review</label><textarea rows={6} className="input" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></div>
            <p className="text-xs text-slate-500">The review will show “Edited by moderator”.</p>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEdit(null)} className="btn-ghost">Cancel</button><button className="btn-primary">Save</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
