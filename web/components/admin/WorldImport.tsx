'use client';
import { useState } from 'react';
import { Download, Upload, Loader2, Globe2, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Preview = { token: string; filename: string; headers: string[]; rowCount: number; sample: Record<string, string>[]; mapping: Record<string, string>; targets: Record<string, string> };
type Check = { rows: number; colleges: number; courses: number; skipped: number; unmatched_colleges: number; unmatched: string[] };

const TEMPLATE = 'college,country,city,course,level,duration,fees_per_year,currency,eligibility,course_link,language\n'
  + 'Technical University of Munich,Germany,Munich,M.Sc. Informatics,PG,2 years,0,EUR,"Bachelor in CS, IELTS 6.5",https://www.tum.de/,English\n'
  + 'The University of Tokyo,Japan,Tokyo,Bachelor of Global Studies,UG,4 years,535800,JPY,EJU or SAT,,English\n';

// Admin → Import: Australia's official course list with fees, the world research ranking, and courses for any country from a spreadsheet
export default function WorldImport({ onStarted }: { onStarted?: () => void }) {
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const [auFile, setAuFile] = useState<File | null>(null);
  const [pv, setPv] = useState<Preview | null>(null); const [map, setMap] = useState<Record<string, string>>({});
  const [country, setCountry] = useState(''); const [currency, setCurrency] = useState('');
  const [check, setCheck] = useState<Check | null>(null);

  const token = async () => (await supabaseBrowser().auth.getSession()).data.session?.access_token;
  const post = async (path: string, body?: BodyInit, json = false) => {
    const r = await fetch(`${API}/api/admin/import/${path}`, { method: 'POST', body, headers: { Authorization: `Bearer ${await token()}`, ...(json ? { 'Content-Type': 'application/json' } : {}) } });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error || 'Import failed');
    return b;
  };
  const run = async (kind: string, fn: () => Promise<any>, started = true) => {
    setBusy(kind); setMsg('');
    try { const b = await fn(); if (b?.message) setMsg(b.message); if (started) onStarted?.(); } catch (e: any) { setMsg(e.message); }
    setBusy('');
  };
  const upload = (f: File) => run('preview', async () => {
    const fd = new FormData(); fd.append('file', f);
    const b = (await post('courses-sheet/preview', fd)) as Preview;
    setPv(b); setMap(b.mapping || {}); setCheck(null);
    return { message: `${b.rowCount} rows in ${b.filename}. Check the columns below, then press “Check”.` };
  }, false);
  const commit = (dryRun: boolean) => run(dryRun ? 'check' : 'commit', async () => {
    const b = await post('courses-sheet/commit', JSON.stringify({ token: pv!.token, mapping: map, country, currency, dryRun }), true);
    if (dryRun) { setCheck(b); return { message: '' }; }
    setPv(null); setCheck(null); return b;
  }, !dryRun);

  return (
    <div className="card space-y-6 p-5">
      <h2 className="flex items-center gap-2 font-bold text-slate-900"><Globe2 size={18} />World — courses, fees & ranking</h2>

      <section>
        <h3 className="font-semibold text-slate-900">🇦🇺 Australia — every university course with fees (CRICOS)</h3>
        <p className="mt-1 text-sm text-slate-500">The Australian Government's official register of courses for international students: every university and college with its degree courses, duration and tuition fee (converted to per year; the total is kept in the note). Updated monthly — imported automatically once a month. Licence CC BY 2.5 AU, credited on each course.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={!!busy} onClick={() => run('cricos', () => post('cricos'))}>{busy === 'cricos' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Import newest list</button>
          <input type="file" accept=".xlsx" onChange={(e) => setAuFile(e.target.files?.[0] || null)} className="text-xs" />
          {auFile && <button className="btn-ghost" disabled={!!busy} onClick={() => run('cricos', () => { const fd = new FormData(); fd.append('file', auFile); return post('cricos', fd); })}><Upload size={16} />Import this file</button>}
          <a href="https://data.gov.au/data/dataset/cricos" target="_blank" rel="noopener" className="text-xs text-brand-700 underline">data.gov.au/dataset/cricos</a>
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-slate-900">🌍 World ranking — research (CWTS Leiden Ranking Open Edition)</h3>
        <p className="mt-1 text-sm text-slate-500">About 2,800 universities worldwide ordered by scientific publications. Open data (CC0) — shown on <a href="/rankings?src=world" className="underline">/rankings → World</a> and on each matched college page, labelled as a research ranking (it does not measure teaching or fees). QS and Times Higher Education are paid, licensed products and are not imported. The file is ~590 MB: it is read in a separate low-priority process (30–90 minutes) so the site stays fast. It ran once automatically.</p>
        <button className="btn-primary mt-2" disabled={!!busy} onClick={() => run('leiden', () => post('leiden', JSON.stringify({ year: 2025 }), true))}>{busy === 'leiden' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Import / refresh world ranking</button>
      </section>

      <section>
        <h3 className="flex items-center gap-2 font-semibold text-slate-900"><FileSpreadsheet size={16} />Any country — courses & fees from a spreadsheet</h3>
        <p className="mt-1 text-sm text-slate-500">One row per course (CSV or Excel), filled from the universities' own websites. Colleges are matched by name + country (add the city when two have the same name, or paste the college page link). Uploading again updates the same courses instead of duplicating them.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a className="btn-ghost text-sm" download="collegeolo-courses-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}><Download size={16} />Template</a>
          <input type="file" accept=".xlsx,.csv" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="text-xs" />
          {busy === 'preview' && <Loader2 size={16} className="animate-spin text-slate-400" />}
        </div>
        {pv && (
          <div className="mt-3 space-y-3 rounded-xl border border-slate-200 p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(pv.targets).map(([k, label]) => (
                <label key={k} className="text-xs text-slate-600">{label}
                  <select className="input mt-0.5 py-1.5 text-sm" value={map[k] || ''} onChange={(e) => setMap((m) => ({ ...m, [k]: e.target.value }))}>
                    <option value="">— not in file —</option>
                    {pv.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
              <label className="text-xs text-slate-600">Country for all rows (if no column)<input className="input mt-0.5 py-1.5 text-sm" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Japan" /></label>
              <label className="text-xs text-slate-600">Currency for all rows (if no column)<input className="input mt-0.5 py-1.5 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} placeholder="e.g. JPY" /></label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" disabled={!!busy || !map.name} onClick={() => commit(true)}>{busy === 'check' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}Check</button>
              <button className="btn-primary" disabled={!!busy || !check} onClick={() => commit(false)}>{busy === 'commit' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}Import {check ? `${check.courses} courses` : ''}</button>
            </div>
            {check && (
              <div className="text-sm text-slate-700">
                <p><b>{check.courses}</b> courses for <b>{check.colleges}</b> colleges will be saved{check.skipped ? ` · ${check.skipped} rows without a course name skipped` : ''}.</p>
                {check.unmatched_colleges > 0 && <p className="mt-1 text-amber-700">{check.unmatched_colleges} college name(s) not found — add the city or the college page link, or create the college first: {check.unmatched.join(', ')}</p>}
              </div>
            )}
          </div>
        )}
      </section>
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
    </div>
  );
}
