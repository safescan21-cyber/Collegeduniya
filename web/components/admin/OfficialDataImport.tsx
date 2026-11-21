'use client';
import { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Upload official counselling cutoffs (JoSAA / MCC / state) or NIRF ranking tables
export default function OfficialDataImport() {
  const [kind, setKind] = useState<'cutoffs' | 'rankings'>('cutoffs');
  const [f, setF] = useState({ exam: 'josaa', year: String(new Date().getFullYear()), round: 'Final', category: 'Overall', source_url: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState('');

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setErr('Choose the file');
    setBusy(true); setErr(''); setRes(null);
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(kind === 'cutoffs' ? { exam: f.exam, year: f.year, round: f.round } : { year: f.year, category: f.category, source_url: f.source_url }).forEach(([k, v]) => fd.append(k, v));
    const { data } = await supabaseBrowser().auth.getSession();
    try {
      const r = await fetch(`${API}/api/admin/import/${kind}`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${data.session?.access_token}` } });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Import failed');
      setRes(body.data);
    } catch (e2: any) { setErr(e2.message); }
    setBusy(false);
  };
  return (
    <div className="card p-5">
      <h2 className="font-bold text-slate-900">🎯 Official cutoffs & rankings</h2>
      <p className="mt-1 text-sm text-slate-500">Upload the opening/closing rank table from JoSAA, MCC or your state counselling site, or the NIRF ranking table (save as .xlsx or .csv). Institutes are matched to your colleges by name; unmatched names are listed so you can fix them.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setKind('cutoffs')} className={kind === 'cutoffs' ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>Cutoffs</button>
        <button type="button" onClick={() => setKind('rankings')} className={kind === 'rankings' ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>NIRF rankings</button>
      </div>
      <form onSubmit={go} className="mt-3 grid gap-2 sm:grid-cols-4">
        {kind === 'cutoffs' ? <>
          <label className="text-sm"><span className="label">Exam</span><input className="input" list="exam-slugs" value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value })} />
            <datalist id="exam-slugs">{['josaa', 'jee-main', 'jee-advanced', 'neet-ug', 'neet-pg', 'mht-cet', 'kcet', 'wbjee', 'ap-eapcet', 'ts-eapcet', 'cuet-ug', 'cat', 'clat', 'gate', 'bitsat'].map((x) => <option key={x} value={x} />)}</datalist>
            <span className="mt-1 block text-[11px] text-slate-400">JoSAA file → “josaa” (IITs = JEE Advanced, rest = JEE Main)</span></label>
          <label className="text-sm"><span className="label">Year</span><input className="input" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></label>
          <label className="text-sm"><span className="label">Round</span><input className="input" value={f.round} onChange={(e) => setF({ ...f, round: e.target.value })} /></label>
        </> : <>
          <label className="text-sm"><span className="label">Year</span><input className="input" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></label>
          <label className="text-sm"><span className="label">Category</span><input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Overall, Engineering…" /></label>
          <label className="text-sm"><span className="label">Official page</span><input className="input" value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} /></label>
        </>}
        <label className="text-sm"><span className="label">File</span><input type="file" accept=".xlsx,.xls,.csv" className="input py-1.5" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        <button className="btn-primary sm:col-span-4" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}Import</button>
      </form>
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {res && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-emerald-700">Saved {res.saved} rows{res.colleges != null ? ` for ${res.colleges} colleges` : ''}.</p>
          {res.unmatched?.length > 0 && <details className="mt-2"><summary className="cursor-pointer text-amber-700">{res.unmatched.length} names not matched</summary>
            <ul className="mt-1 max-h-48 list-disc overflow-y-auto ps-5 text-xs">{res.unmatched.map((u: any, i: number) => <li key={i}>{typeof u === 'string' ? u : `${u.name} (${u.rows})`}</li>)}</ul></details>}
        </div>
      )}
    </div>
  );
}
