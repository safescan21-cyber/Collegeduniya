'use client';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Download, RefreshCw, Search } from 'lucide-react';
import { api } from '@/lib/api';
import AutofillCard from '@/components/admin/AutofillCard';
import SheetImport from '@/components/admin/SheetImport';
import OfficialDataImport from '@/components/admin/OfficialDataImport';
import EuropeImport from '@/components/admin/EuropeImport';
import NirfDataImport from '@/components/admin/NirfDataImport';
import { timeAgo } from '@/lib/format';

type Run = { id: string; kind: string; params: any; status: string; inserted: number; updated: number; skipped: number; message: string | null; created_at: string; finished_at: string | null };

function Status({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-2 py-2">
      {ok ? <CheckCircle2 size={18} className="mt-0.5 text-emerald-600" /> : <XCircle size={18} className="mt-0.5 text-slate-300" />}
      <div><p className="font-medium text-slate-800">{label}</p>{!ok && hint && <p className="text-xs text-slate-500">{hint}</p>}</div>
    </li>
  );
}

export default function AdminImport() {
  const [integ, setInteg] = useState<any>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [country, setCountry] = useState('IN');
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState<'' | 'preview' | 'import'>('');
  const [msg, setMsg] = useState('');
  const [enCountry, setEnCountry] = useState('IN');
  const [enLimit, setEnLimit] = useState(200);

  const loadRuns = useCallback(() => api('/api/admin/import/runs').then((r) => setRuns(r.data)).catch(() => {}), []);
  useEffect(() => {
    api('/api/admin/integrations').then(setInteg).catch(() => {});
    loadRuns();
    const t = setInterval(loadRuns, 8000);
    return () => clearInterval(t);
  }, [loadRuns]);

  const doPreview = async () => {
    setBusy('preview'); setMsg(''); setPreview(null);
    try { const r = await api(`/api/admin/import/preview?country=${encodeURIComponent(country)}`); setPreview(r.data); }
    catch (e: any) { setMsg(e.message); }
    setBusy('');
  };
  const doImport = async () => {
    if (!confirm(`Import colleges for ${country}? Existing admin-edited colleges are kept.`)) return;
    setBusy('import'); setMsg('');
    try { const r = await api('/api/admin/import/universities', { method: 'POST', body: JSON.stringify({ country }) }); setMsg(r.message); loadRuns(); }
    catch (e: any) { setMsg(e.message); }
    setBusy('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">Data import & integrations</h1>

      <AutofillCard />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-bold text-slate-900">Import colleges from public data</h2>
          <p className="mt-1 text-sm text-slate-500">Pulls names and websites from the Hipolabs university list and adds location, founding year, logo, photo and student count from Wikidata. Colleges you created by hand are never overwritten; fees and courses still come from you.</p>
          <div className="mt-4 flex gap-2">
            <input className="input w-40" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="IN or India" />
            <button onClick={doPreview} disabled={!!busy} className="btn-ghost">{busy === 'preview' ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}Preview</button>
            <button onClick={doImport} disabled={!!busy} className="btn-primary">{busy === 'import' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Import</button>
          </div>
          {msg && <p className="mt-3 text-sm text-slate-700">{msg}</p>}
          {preview && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold">{preview.country?.name}: {preview.total} found · {preview.inserted} new · {preview.updated} to refresh · {preview.skipped} kept (admin-edited)</p>
              <ul className="mt-2 list-disc ps-5 text-slate-600">{(preview.sample || []).map((s: any) => <li key={s.external_id}>{s.name} — {s.city}{s.established ? ` · est. ${s.established}` : ''}</li>)}</ul>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">Bulk import for every country: run <code>npm run import:universities -- --all</code> on the server. Cities: <code>npm run import:cities</code>.</p>
        </div>

        <div className="card p-5">
          <h2 className="font-bold text-slate-900">Integrations</h2>
          {!integ ? <Loader2 className="mt-4 animate-spin text-slate-300" /> : (
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              <Status ok label="Cities & places — GeoNames + OpenStreetMap (free)" />
              <Status ok label="Hospitals, PGs, transport near colleges — OpenStreetMap Overpass (free)" />
              <Status ok label="College data — Hipolabs + Wikidata (free)" />
              <Status ok={integ.jobs?.adzuna} label="Local jobs — Adzuna" hint="Set ADZUNA_APP_ID and ADZUNA_APP_KEY in server/.env (free key at developer.adzuna.com)" />
              <Status ok={integ.jobs?.jooble} label="Local jobs — Jooble" hint="Set JOOBLE_API_KEY in server/.env (request a free key at jooble.org/api/about)" />
              <Status ok={!!integ.translate} label={`Translation — ${integ.translate || 'not configured'}`} hint="Set GOOGLE_TRANSLATE_API_KEY (or LIBRETRANSLATE_URL) in server/.env for 30+ languages" />
              <Status ok={integ.scorecard} label="U.S. colleges with tuition — College Scorecard" hint="Set COLLEGE_SCORECARD_API_KEY in server/.env (free at api.data.gov/signup)" />
              <Status ok={integ.ai_chat} label="AI assistant — Anthropic" hint="Set ANTHROPIC_API_KEY in server/.env" />
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SheetImport onStarted={loadRuns} />
        <OfficialDataImport />
        <NirfDataImport />
        <EuropeImport onStarted={loadRuns} />
        <div className="card p-5">
          <h2 className="font-bold text-slate-900">🇮🇳 Every Indian college — AISHE list</h2>
          <p className="mt-1 text-sm text-slate-500">About 70,000 universities, colleges and standalone institutions (nursing, B.Ed, polytechnics …) from the Ministry of Education's AISHE list, with state and district. Each is placed in its district town; fees, courses and photos are filled later (automatically from Wikipedia where possible, or by your team). Colleges already on the site and your own edits are kept.</p>
          <button disabled={!!busy} className="btn-primary mt-4" onClick={async () => {
            if (!confirm('Import about 70,000 Indian institutions now? It takes 5–10 minutes.')) return;
            try { const r = await api('/api/admin/import/aishe-list', { method: 'POST' }); setMsg(r.message); loadRuns(); } catch (e: any) { setMsg(e.message); }
          }}><Download size={16} />Import Indian institutions</button>
        </div>
        <div className="card p-5">
          <h2 className="font-bold text-slate-900">🇺🇸 Every U.S. college with real tuition</h2>
          <p className="mt-1 text-sm text-slate-500">Imports about 6,000 colleges from the U.S. Department of Education College Scorecard: tuition (in-state / out-of-state), size, admission rate, location and website.</p>
          {integ && !integ.scorecard && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Add COLLEGE_SCORECARD_API_KEY to server/.env (free at api.data.gov/signup) and restart the API.</p>}
          <button disabled={!integ?.scorecard || !!busy} className="btn-primary mt-4" onClick={async () => {
            if (!confirm('Import all U.S. colleges now? It takes a few minutes.')) return;
            try { const r = await api('/api/admin/import/scorecard', { method: 'POST' }); setMsg(r.message); loadRuns(); } catch (e: any) { setMsg(e.message); }
          }}><Download size={16} />Import U.S. colleges</button>
          <h3 className="mt-6 font-semibold text-slate-900">Coverage plan</h3>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-600">
            <li>India: AISHE list (button above, ≈70,000) + your own detailed profiles</li>
            <li>United States: College Scorecard (button above)</li>
            <li>UK: Discover Uni (HESA) · Europe: ETER (card above)</li>
            <li>Rest of the world: Hipolabs + Wikidata (country import above, or <code>--all</code>)</li>
          </ul>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-bold text-slate-900">📸 Fill details &amp; real photos (Wikipedia + Wikimedia Commons, free)</h2>
        <p className="mt-1 text-sm text-slate-500">For colleges that have no cover photo yet: finds each one on Wikidata and adds the Wikipedia “About” text, logo, campus photos (with author &amp; licence credit), website, year founded and map location. It only fills empty fields. Big universities usually match; small colleges often have no Wikipedia page, so add those photos by hand. It runs in the background at roughly 5–10 seconds per college.</p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-slate-500">Country code (blank = all)</span>
            <input value={enCountry} onChange={(e) => setEnCountry(e.target.value.toUpperCase().slice(0, 2))} className="input w-28" placeholder="IN" /></label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-slate-500">How many</span>
            <input type="number" min={1} max={5000} value={enLimit} onChange={(e) => setEnLimit(Number(e.target.value))} className="input w-28" /></label>
          <button className="btn-primary" onClick={async () => {
            try { const r = await api('/api/admin/enrich/batch', { method: 'POST', body: JSON.stringify({ country: enCountry || null, limit: enLimit }) }); setMsg(r.message); loadRuns(); } catch (e: any) { setMsg(e.message); }
          }}><Download size={16} />Start</button>
        </div>
        <p className="mt-3 text-xs text-slate-400">To check one college and choose its photos yourself, open it in Colleges → “Wikipedia &amp; photos” tab. From the server: <code>npm run enrich -- IN --limit 500</code></p>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between px-5 py-3"><p className="font-bold text-slate-900">Recent imports</p><button onClick={loadRuns} className="btn-ghost py-1.5"><RefreshCw size={14} /></button></div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Country</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">New</th><th className="px-4 py-2">Refreshed</th><th className="px-4 py-2">Kept</th><th className="px-4 py-2">Notes</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {runs.map((r) => (
              <tr key={r.id}><td className="px-4 py-2 text-xs">{timeAgo(r.created_at)}</td><td className="px-4 py-2">{r.kind === 'sheet' ? `${r.params?.file} (${r.params?.country})` : r.params?.country}</td>
                <td className="px-4 py-2"><span className={r.status === 'done' ? 'chip-green' : r.status === 'failed' ? 'chip-red' : 'chip-amber'}>{r.status}</span></td>
                <td className="px-4 py-2">{r.inserted}</td><td className="px-4 py-2">{r.updated}</td><td className="px-4 py-2">{r.skipped}</td><td className="px-4 py-2 text-xs text-slate-500">{r.message}</td></tr>
            ))}
            {!runs.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No imports yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
