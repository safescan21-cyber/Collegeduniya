'use client';
import { useState } from 'react';
import { Upload, Loader2, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

type Preview = { token: string; filename: string; headers: string[]; rowCount: number; sample: Record<string, string>[]; mapping: Record<string, string>; targets: Record<string, string> };

// Upload any college list (AISHE "All Colleges" xlsx, state lists, your own CSV), map columns, import.
export default function SheetImport({ onStarted }: { onStarted?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [p, setP] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [country, setCountry] = useState('IN');
  const [source, setSource] = useState('aishe');
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState<'' | 'upload' | 'import'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const upload = async () => {
    if (!file) return;
    setBusy('upload'); setMsg(null); setP(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await api<Preview>('/api/admin/import/sheet/preview', { method: 'POST', body: fd });
      setP(r); setMapping(r.mapping);
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy('');
  };

  const commit = async () => {
    if (!p) return;
    if (!mapping.name) return setMsg({ ok: false, text: 'Choose which column has the college name.' });
    setBusy('import'); setMsg(null);
    try {
      const r = await api('/api/admin/import/sheet/commit', { method: 'POST', body: JSON.stringify({ token: p.token, mapping, country, source, publish }) });
      setMsg({ ok: true, text: r.message }); setP(null); setFile(null); onStarted?.();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy('');
  };

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-bold text-slate-900"><FileSpreadsheet size={18} className="text-emerald-600" />Import a college list (Excel / CSV)</h2>
      <p className="mt-1 text-sm text-slate-500">
        For India, download the official <strong>“All Colleges as per AISHE Dashboard”</strong> list (about 48,000 colleges) from the AISHE portal or the government’s AIKosh data catalogue, then upload it here.
        Any other list works too — state lists, a university’s affiliated colleges, your own sheet.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="btn-ghost cursor-pointer"><Upload size={16} />{file ? file.name : 'Choose .xlsx or .csv'}
          <input type="file" accept=".xlsx,.csv,.tsv,.txt" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setP(null); }} /></label>
        <button onClick={upload} disabled={!file || !!busy} className="btn-primary">{busy === 'upload' ? <Loader2 size={16} className="animate-spin" /> : null}Read file</button>
      </div>

      {p && (
        <div className="mt-5 space-y-4">
          <p className="text-sm"><CheckCircle2 size={16} className="me-1 inline text-emerald-600" /><strong>{p.rowCount.toLocaleString()}</strong> rows found in {p.filename}. Check the column matches:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(p.targets).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className={key === 'name' ? 'font-semibold' : ''}>{label}</span>
                <select className="input w-44 py-1 text-xs" value={mapping[key] || ''} onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}>
                  <option value="">— not in file —</option>
                  {p.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50"><tr>{p.headers.slice(0, 8).map((h) => <th key={h} className="px-2 py-1.5">{h}</th>)}</tr></thead>
              <tbody>{p.sample.slice(0, 4).map((r, i) => <tr key={i} className="border-t border-slate-100">{p.headers.slice(0, 8).map((h) => <td key={h} className="max-w-48 truncate px-2 py-1.5">{r[h]}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label">Country of this list</label><input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="IN or India" /></div>
            <div><label className="label">Source label</label><input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="aishe" />
              <p className="mt-1 text-[11px] text-slate-400">Re-uploading with the same label updates instead of duplicating.</p></div>
            <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="accent-brand-600" />Show on site right away</label>
          </div>
          <button onClick={commit} disabled={!!busy} className="btn-primary">{busy === 'import' ? <Loader2 size={16} className="animate-spin" /> : null}Import {p.rowCount.toLocaleString()} colleges</button>
        </div>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.text}</p>}
      <p className="mt-4 text-xs text-slate-400">Colleges your team added by hand are never overwritten. Imported colleges have no fees or courses until you add them; you can hide any part per college.</p>
    </div>
  );
}
