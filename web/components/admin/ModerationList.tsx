'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Trash2, Download } from 'lucide-react';
import { api, API_URL } from '@/lib/api';
import { supabaseBrowser } from '@/lib/supabase/client';

export type ModColumn = { key: string; label: string; render?: (row: any) => React.ReactNode; className?: string };

type Props = {
  resource: string;                         // /api/admin/<resource>
  title: string;
  columns: ModColumn[];
  statusField?: string;                     // e.g. 'status'
  statusOptions?: string[];
  tabs?: { label: string; params: Record<string, string> }[];
  exportName?: string;                      // table name for CSV export
  noteField?: string;                       // inline editable note (e.g. admin_note)
  extraActions?: (row: any, patch: (body: any) => Promise<void>) => React.ReactNode;
  fixed?: Record<string, string>;
  canDelete?: boolean;
};

const CHIP: Record<string, string> = {
  new: 'chip-amber', contacted: 'chip-brand', converted: 'chip-green', closed: 'chip',
  submitted: 'chip-amber', under_review: 'chip-brand', forwarded: 'chip-brand', accepted: 'chip-green', rejected: 'chip-red', withdrawn: 'chip',
  approved: 'chip-green', pending: 'chip-amber', blocked: 'chip-red',
};

export async function downloadCsv(table: string) {
  const { data } = await supabaseBrowser().auth.getSession();
  const res = await fetch(`${API_URL}/api/admin/export/${table}.csv`, { headers: { Authorization: `Bearer ${data.session?.access_token}` } });
  if (!res.ok) return alert('Export failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${table}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ModerationList({ resource, title, columns, statusField, statusOptions, tabs, exportName, noteField, extraActions, fixed = {}, canDelete = true }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const fixedKey = JSON.stringify(fixed);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...JSON.parse(fixedKey), ...(tabs?.[tab]?.params || {}) });
    if (search) p.set('q', search);
    const r = await api(`/api/admin/${resource}?${p}`).catch((e) => { alert(e.message); return { data: [], count: 0 }; });
    setRows(r.data); setCount(r.count); setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, page, tab, search, fixedKey]);
  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, body: any) => {
    try { await api(`/api/admin/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); await load(); } catch (e: any) { alert(e.message); }
  };
  const del = async (id: string) => {
    if (!confirm('Delete permanently?')) return;
    try { await api(`/api/admin/${resource}/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  };
  const pages = Math.max(1, Math.ceil(count / LIMIT));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{title} <span className="text-sm font-normal text-slate-400">({count})</span></h1>
        <div className="flex flex-wrap gap-2">
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }} className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input w-52 pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          {exportName && <button onClick={() => downloadCsv(exportName)} className="btn-ghost"><Download size={16} />CSV</button>}
        </div>
      </div>
      {tabs && (
        <div className="mb-4 flex flex-wrap gap-1">
          {tabs.map((t, i) => <button key={t.label} onClick={() => { setTab(i); setPage(1); }} className={`${tab === i ? 'btn-primary' : 'btn-ghost'} py-1.5`}>{t.label}</button>)}
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {columns.map((c) => <th key={c.key} className="px-4 py-3">{c.label}</th>)}
              {statusField && <th className="px-4 py-3">Status</th>}
              {noteField && <th className="px-4 py-3">Note</th>}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={columns.length + 3} className="py-10 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length + 3} className="py-10 text-center text-slate-400">Nothing here.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-slate-50">
                {columns.map((c) => <td key={c.key} className={`px-4 py-3 ${c.className || ''}`}>{c.render ? c.render(r) : String(r[c.key] ?? '—')}</td>)}
                {statusField && (
                  <td className="px-4 py-3">
                    <select value={r[statusField]} onChange={(e) => patch(r.id, { [statusField]: e.target.value })}
                      className={`${CHIP[r[statusField]] || 'chip'} cursor-pointer border-0 capitalize`}>
                      {statusOptions!.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                )}
                {noteField && (
                  <td className="px-4 py-3">
                    <input defaultValue={r[noteField] || ''} placeholder="Add note…" className="input min-w-40 py-1.5 text-xs"
                      onBlur={(e) => { if ((e.target.value || '') !== (r[noteField] || '')) patch(r.id, { [noteField]: e.target.value }); }} />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {extraActions?.(r, (body) => patch(r.id, body))}
                    {canDelete && <button onClick={() => del(r.id)} className="btn-ghost px-2 py-1.5 text-rose-600" aria-label="Delete"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost">Prev</button>
          <span>Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="btn-ghost">Next</button>
        </div>
      )}
    </div>
  );
}
