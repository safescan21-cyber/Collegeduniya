'use client';
import { useState } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Official European data: UK Discover Uni (HESA, CC BY 4.0) and ETER (European Tertiary Education Register)
export default function EuropeImport({ onStarted }: { onStarted?: () => void }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [countries, setCountries] = useState('');

  const call = async (path: string, body?: BodyInit, json = false) => {
    const { data } = await supabaseBrowser().auth.getSession();
    const r = await fetch(`${API}/api/admin/import/${path}`, {
      method: 'POST', body,
      headers: { Authorization: `Bearer ${data.session?.access_token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (r.status === 413) throw new Error('The file is bigger than the web server allows. The new limit (300 MB) goes live with the next deploy — try again in a few minutes.');
    const b = await r.json().catch(() => ({ error: `The server answered ${r.status} — try again in a minute` }));
    if (!r.ok) throw new Error(b.error || 'Import failed');
    return b.message as string;
  };
  const run = async (kind: string, fn: () => Promise<string>) => {
    setBusy(kind); setMsg('');
    try { setMsg(await fn()); onStarted?.(); } catch (e: any) { setMsg(e.message); }
    setBusy('');
  };

  return (
    <div className="card p-5">
      <h2 className="font-bold text-slate-900">🇬🇧🇪🇺 UK & Europe — official data</h2>

      <h3 className="mt-3 font-semibold text-slate-900">United Kingdom — Discover Uni (HESA)</h3>
      <p className="mt-1 text-sm text-slate-500">Every UK university and college with its undergraduate courses (links to the course page), graduate median salary and % in work or further study per course, and National Student Survey satisfaction. HESA's website blocks automatic downloads, so download the zip in your browser (free, no login) and upload it below. Licence CC BY 4.0 — credited as “Contains HESA data” on each college page. Existing colleges are matched by website or name; only empty fields are filled.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <button className="btn-primary" disabled={!!busy} onClick={() => run('uk', () => call('uk'))}>
          {busy === 'uk' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Try automatic download</button>
        <a href="https://www.hesa.ac.uk/data-and-analysis/discover-uni-dataset" target="_blank" rel="noopener" className="text-xs text-brand-700 underline">Get the zip from hesa.ac.uk</a>
        <input type="file" accept=".zip,application/zip,application/x-zip-compressed" className="input w-64 py-1.5" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button className="btn-primary" disabled={!file || !!busy} onClick={() => run('ukzip', () => { const fd = new FormData(); fd.append('file', file!); return call('uk', fd); })}>
          {busy === 'ukzip' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{busy === 'ukzip' ? 'Uploading…' : file ? `Import ${file.name} (${Math.round(file.size / 1048576)} MB)` : 'Import zip'}</button>
      </div>

      <h3 className="mt-6 font-semibold text-slate-900">Europe — ETER (European Tertiary Education Register)</h3>
      <p className="mt-1 text-sm text-slate-500">About 3,000 higher-education institutions in 36 European countries: legal status (public/private), founding year, city and map location, website and student numbers. Credited as “Data source: ETER project” on each college page.</p>
      <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">ETER’s terms don’t clearly say whether commercial use is allowed. Email the ETER team (info@eter-project.com) to confirm before relying on it publicly.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-slate-500">Countries (blank = all)</span>
          <input value={countries} onChange={(e) => setCountries(e.target.value.toUpperCase())} className="input w-48" placeholder="DE FR IT" /></label>
        <button className="btn-primary" disabled={!!busy} onClick={() => run('eter', () => call('eter', JSON.stringify({ countries: countries.split(/[\s,]+/).filter(Boolean) }), true))}>
          {busy === 'eter' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Import Europe</button>
      </div>
      {msg && <p className="mt-3 text-sm text-slate-700">{msg}</p>}
    </div>
  );
}
