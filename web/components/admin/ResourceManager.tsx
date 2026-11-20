'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Upload, Loader2 } from 'lucide-react';
import { api, uploadImages, uploadDocs } from '@/lib/api';

export type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'tags' | 'bool' | 'image' | 'images' | 'college' | 'date' | 'file';
  options?: string[];
  required?: boolean;
  full?: boolean;
  placeholder?: string;
  help?: string;
};

export type ColumnDef = { key: string; label: string; render?: (row: any) => React.ReactNode };

type Props = {
  resource: string;            // e.g. 'colleges' → /api/admin/colleges
  title: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  defaults?: Record<string, any>;
  fixed?: Record<string, any>; // always sent & used as list filter (e.g. college_id)
  rowActions?: (row: any, reload: () => void) => React.ReactNode;
  searchable?: boolean;
  quickFilters?: { label: string; params: Record<string, string> }[];
  bulkActions?: { label: string; danger?: boolean; run: (ids: string[]) => Promise<void> }[];
  onEditRow?: (row: any) => void;
  idKey?: string;              // primary key column when it isn't "id" (visa_guides → country_code)
};

function CollegePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<{ id: string; name: string; city: string }[]>([]);
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (value && !label) api(`/api/admin/colleges/${value}`).then((r) => setLabel(`${r.data.name}, ${r.data.city}`)).catch(() => {});
  }, [value, label]);
  useEffect(() => {
    if (q.length < 2) return setOpts([]);
    const t = setTimeout(() => api(`/api/admin/colleges?q=${encodeURIComponent(q)}&limit=8`).then((r) => setOpts(r.data)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative">
      {value ? (
        <div className="input flex items-center justify-between"><span className="truncate">{label || value}</span>
          <button type="button" onClick={() => { onChange(''); setLabel(''); }}><X size={14} /></button></div>
      ) : (
        <input className="input" placeholder="Type to search college (optional)" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {opts.length > 0 && !value && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {opts.map((o) => (
            <li key={o.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => { onChange(o.id); setLabel(`${o.name}, ${o.city}`); setOpts([]); setQ(''); }}>{o.name} <span className="text-slate-400">· {o.city}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FieldInput({ f, value, onChange, folder }: { f: FieldDef; value: any; onChange: (v: any) => void; folder: string }) {
  const [uploading, setUploading] = useState(false);
  const doUpload = async (files: FileList | null, multi: boolean) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await uploadImages(files, folder);
      onChange(multi ? [...(value || []), ...urls] : urls[0]);
    } catch (e: any) { alert(e.message); }
    setUploading(false);
  };

  switch (f.type) {
    case 'textarea':
      return <textarea rows={4} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} required={f.required} />;
    case 'number':
      return <input type="number" step="any" className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} required={f.required} />;
    case 'date':
      return <input type="date" className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={f.required}>
          {!f.required && <option value="">—</option>}
          {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'bool':
      return (
        <label className="flex h-[42px] items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> Yes
        </label>
      );
    case 'tags':
      return <input className="input" value={Array.isArray(value) ? value.join(', ') : value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder || 'Comma separated'} />;
    case 'college':
      return <CollegePicker value={value || ''} onChange={onChange} />;
    case 'file':
      return (
        <div className="flex items-center gap-3">
          <input className="input flex-1" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="https://… or upload a PDF" />
          {value && <a href={value} target="_blank" rel="noopener" className="text-xs text-brand-700 underline">open</a>}
          <label className="btn-ghost cursor-pointer">{uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}PDF
            <input type="file" accept="application/pdf" className="hidden" onChange={async (e) => {
              const fl = e.target.files; if (!fl?.length) return;
              setUploading(true);
              try { onChange((await uploadDocs(fl, folder))[0]); } catch (er: any) { alert(er.message); }
              setUploading(false);
            }} /></label>
        </div>
      );
    case 'image':
      return (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value && <img src={value} alt="" className="h-14 w-20 rounded-lg object-cover" />}
          <input className="input flex-1" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="https://… or upload" />
          <label className="btn-ghost cursor-pointer">{uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => doUpload(e.target.files, false)} /></label>
        </div>
      );
    case 'images':
      return (
        <div>
          <div className="flex flex-wrap gap-2">
            {(value || []).map((u: string, i: number) => (
              <div key={u + i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-20 w-28 rounded-lg object-cover" />
                <button type="button" onClick={() => onChange((value || []).filter((_: string, k: number) => k !== i))}
                  className="absolute -right-2 -top-2 rounded-full bg-rose-600 p-1 text-white"><X size={12} /></button>
              </div>
            ))}
            <label className="grid h-20 w-28 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-brand-400">
              {uploading ? <Loader2 className="animate-spin" /> : <Plus />}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => doUpload(e.target.files, true)} />
            </label>
          </div>
        </div>
      );
    default:
      return <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} required={f.required} />;
  }
}

export default function ResourceManager({ resource, title, fields, columns, defaults = {}, fixed = {}, rowActions, searchable = true, quickFilters, bulkActions, onEditRow, idKey = 'id' }: Props) {
  const [qf, setQf] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fixedKey = JSON.stringify(fixed);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...JSON.parse(fixedKey), ...(quickFilters?.[qf]?.params || {}) });
    if (search) params.set('q', search);
    try {
      const r = await api(`/api/admin/${resource}?${params}`);
      setRows(r.data); setCount(r.count);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, page, search, fixedKey, qf]);

  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr('');
    const body: Record<string, any> = { ...fixed };
    for (const f of fields) if (editing[f.name] !== undefined) body[f.name] = editing[f.name];
    try {
      if (editing.__key) await api(`/api/admin/${resource}/${encodeURIComponent(editing.__key)}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api(`/api/admin/${resource}`, { method: 'POST', body: JSON.stringify(body) });
      setEditing(null);
      load();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const remove = async (row: any) => {
    if (!confirm(`Delete "${row.name || row.title}"? This cannot be undone.`)) return;
    try { await api(`/api/admin/${resource}/${encodeURIComponent(row[idKey])}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  };

  const pages = Math.max(1, Math.ceil(count / LIMIT));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{title} <span className="text-sm font-normal text-slate-400">({count})</span></h2>
        <div className="flex gap-2">
          {searchable && (
            <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }} className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input w-56 pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          )}
          <button onClick={() => { setErr(''); setEditing({ ...defaults }); }} className="btn-primary"><Plus size={16} />Add</button>
        </div>
      </div>

      {quickFilters && (
        <div className="mb-4 flex flex-wrap gap-1">
          {quickFilters.map((f, i) => (
            <button key={f.label} onClick={() => { setQf(i); setPage(1); }} className={`${qf === i ? 'btn-primary' : 'btn-ghost'} py-1.5`}>{f.label}</button>
          ))}
        </div>
      )}

      {bulkActions && sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm">
          <span className="font-semibold text-brand-800">{sel.size} selected</span>
          {bulkActions.map((a) => (
            <button key={a.label} className={`${a.danger ? 'btn-danger' : 'btn-ghost'} py-1.5`}
              onClick={async () => { if (a.danger && !confirm(`${a.label} ${sel.size} item(s)?`)) return; try { await a.run(Array.from(sel)); setSel(new Set()); load(); } catch (e: any) { alert(e.message); } }}>{a.label}</button>
          ))}
          <button onClick={() => setSel(new Set())} className="text-xs text-slate-500 hover:underline">Clear</button>
        </div>
      )}

      {err && !editing && <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {bulkActions && <th className="w-8 px-3 py-3"><input type="checkbox" className="accent-brand-600" checked={rows.length > 0 && rows.every((r) => sel.has(r.id))}
                onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Select all" /></th>}
              {columns.map((c) => <th key={c.key} className="px-4 py-3">{c.label}</th>)}<th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={columns.length + 2} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length + 2} className="px-4 py-10 text-center text-slate-400">Nothing here yet.</td></tr>
            ) : rows.map((r) => (
              <tr key={r[idKey]} className={`hover:bg-slate-50 ${sel.has(r.id) ? 'bg-brand-50/50' : ''}`}>
                {bulkActions && <td className="px-3 py-3"><input type="checkbox" className="accent-brand-600" checked={sel.has(r.id)}
                  onChange={(e) => setSel((p) => { const n = new Set(p); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} aria-label="Select" /></td>}
                {columns.map((c) => <td key={c.key} className="px-4 py-3">{c.render ? c.render(r) : String(r[c.key] ?? '—')}</td>)}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {rowActions?.(r, load)}
                    <button onClick={() => { if (onEditRow) return onEditRow(r); setErr(''); setEditing({ ...r, __key: r[idKey] }); }} className="btn-ghost px-2 py-1.5" aria-label="Edit"><Pencil size={14} /></button>
                    <button onClick={() => remove(r)} className="btn-ghost px-2 py-1.5 text-rose-600" aria-label="Delete"><Trash2 size={14} /></button>
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

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold">{editing.__key ? 'Edit' : 'Add'} {title.replace(/s$/, '').toLowerCase()}</h3>
              <button type="button" onClick={() => setEditing(null)}><X /></button>
            </div>
            <div className="grid flex-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.name} className={f.full || ['textarea', 'images', 'image', 'college', 'file'].includes(f.type) ? 'sm:col-span-2' : ''}>
                  <label className="label">{f.label}{f.required && ' *'}</label>
                  <FieldInput f={f} value={editing[f.name]} folder={resource} onChange={(v) => setEditing((p: any) => ({ ...p, [f.name]: v }))} />
                  {f.help && <p className="mt-1 text-xs text-slate-400">{f.help}</p>}
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 px-6 py-4">
              {err && <p className="mb-3 text-sm text-rose-600">{err}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
                <button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
