'use client';
import { useState } from 'react';
import { Loader2, Search, Check, ExternalLink, ImageOff, Download } from 'lucide-react';
import { api } from '@/lib/api';

type Photo = { file: string; url: string; page: string; author: string; license: string; license_url: string | null; description: string | null };
type Found = {
  matched: boolean; score?: number; reason?: string; wikidata_id?: string; label?: string; wikidata_url?: string; wikipedia_url?: string | null;
  description?: string | null; description_is_wikipedia?: boolean; website?: string | null; established?: number | null;
  latitude?: number | null; longitude?: number | null; students_count?: number | null; logo?: Photo | null; photos?: Photo[];
};

const FIELDS: [string, string][] = [['description', 'About text'], ['logo', 'Logo'], ['photos', 'Photos'], ['website', 'Website'], ['established', 'Year founded'], ['latitude', 'Map location'], ['students_count', 'Students']];

export default function WikiEnrich({ college, onSaved }: { college: any; onSaved: (c: any) => void }) {
  const [found, setFound] = useState<Found | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [qid, setQid] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [fields, setFields] = useState<string[]>(FIELDS.map(([k]) => k));
  const [overwrite, setOverwrite] = useState(false);

  const lookup = async () => {
    setLoading(true); setErr(null); setMsg(null); setFound(null);
    try {
      const r = await api(`/api/admin/colleges/${college.id}/enrich${qid ? `?wikidata_id=${encodeURIComponent(qid.trim())}` : ''}`);
      setFound(r.data); setPicked((r.data.photos || []).slice(0, 8).map((p: Photo) => p.file));
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  };

  const apply = async () => {
    setSaving(true); setErr(null);
    try {
      const f = fields.includes('latitude') ? [...fields, 'longitude'] : fields;
      const r = await api(`/api/admin/colleges/${college.id}/enrich`, { method: 'POST', body: JSON.stringify({ overwrite, photoFiles: picked, fields: f }) });
      onSaved(r.data); setFound(null);
      setMsg(`Saved ✓ ${r.applied.filter((k: string) => !['enriched_at', 'enrich_status', 'photo_credits'].includes(k)).join(', ') || 'nothing new (fields already filled — tick “Replace existing”)'}`);
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const cur = (k: string) => (k === 'logo' ? college.logo_url : k === 'photos' ? (college.photos || []).length || null : k === 'latitude' ? college.latitude : college[k]);
  const val = (k: string) => {
    if (!found) return null;
    if (k === 'logo') return found.logo ? 'found' : null;
    if (k === 'photos') return found.photos?.length ? `${picked.length} selected` : null;
    if (k === 'latitude') return found.latitude != null ? `${found.latitude.toFixed(4)}, ${found.longitude?.toFixed(4)}` : null;
    if (k === 'description') return found.description ? `${found.description.slice(0, 90)}…` : null;
    return (found as any)[k] ?? null;
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-lg font-bold text-slate-900">Free details &amp; real photos</h2>
        <p className="mt-1 text-sm text-slate-500">Looks the college up on Wikidata, Wikipedia and Wikimedia Commons (free, no key) and shows you what it found. Nothing changes until you press Save. Photos keep their author and licence, and the site shows the credit under each one.</p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Wikidata ID (optional — if the wrong college is found)</span>
            <input value={qid} onChange={(e) => setQid(e.target.value)} placeholder={college.wikidata_id || 'e.g. Q1146426'} className="input w-56" />
          </label>
          <button onClick={lookup} disabled={loading} className="btn-primary">{loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}Find details &amp; photos</button>
          {college.enriched_at && <span className="text-xs text-slate-400">Last checked {new Date(college.enriched_at).toLocaleDateString()} · {college.enrich_status}</span>}
        </div>
        {loading && <p className="mt-3 text-xs text-slate-500">Searching Wikimedia… this takes 5–15 seconds.</p>}
        {err && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
        {msg && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      </div>

      {found && !found.matched && (
        <div className="card flex items-center gap-3 p-5 text-sm text-slate-600"><ImageOff className="text-slate-400" />No confident match on Wikidata. Find the college on wikidata.org, paste its Q-number above and search again, or upload photos in the Details tab.</div>
      )}

      {found?.matched && (
        <div className="card space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">Matched <b>{found.label}</b> <span className="chip">{found.wikidata_id}</span> <span className="text-xs text-slate-400">({found.reason})</span></p>
            <div className="flex gap-3 text-sm">
              <a href={found.wikidata_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-brand-700 underline">Wikidata<ExternalLink size={12} /></a>
              {found.wikipedia_url && <a href={found.wikipedia_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-brand-700 underline">Wikipedia<ExternalLink size={12} /></a>}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="py-2">Use</th><th>Field</th><th>Now</th><th>Found</th></tr></thead>
              <tbody>
                {FIELDS.map(([k, label]) => {
                  const v = val(k);
                  return (
                    <tr key={k} className="border-t border-slate-100 align-top">
                      <td className="py-2"><input type="checkbox" disabled={v == null} checked={v != null && fields.includes(k)} onChange={(e) => setFields((f) => (e.target.checked ? [...f, k] : f.filter((x) => x !== k)))} /></td>
                      <td className="py-2 pe-3 font-medium">{label}</td>
                      <td className="py-2 pe-3 text-slate-500">{cur(k) ? <span className="text-emerald-700">filled</span> : <span className="text-slate-400">empty</span>}</td>
                      <td className="py-2 text-slate-700">{v ?? <span className="text-slate-400">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {found.logo && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={found.logo.url} alt="Logo" className="h-16 w-16 rounded-lg border bg-white object-contain p-1" />
              <p className="text-xs text-slate-500">Logo · {found.logo.author} · {found.logo.license}</p>
            </div>
          )}

          {!!found.photos?.length && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Photos from Wikimedia Commons — tick the ones to use (first ticked = cover photo)</p>
                <button className="text-xs text-brand-700 underline" onClick={() => setPicked(picked.length ? [] : found.photos!.map((p) => p.file))}>{picked.length ? 'Untick all' : 'Tick all'}</button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {found.photos.map((p) => {
                  const on = picked.includes(p.file);
                  const idx = picked.indexOf(p.file);
                  return (
                    <button key={p.file} type="button" onClick={() => setPicked((x) => (on ? x.filter((f) => f !== p.file) : [...x, p.file]))}
                      className={`relative overflow-hidden rounded-xl border-2 text-left ${on ? 'border-brand-600' : 'border-transparent opacity-70'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.description || p.file} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                      {on && <span className="absolute start-2 top-2 flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white"><Check size={12} />{idx === 0 ? 'Cover' : idx + 1}</span>}
                      <span className="block truncate bg-white px-2 py-1 text-[11px] text-slate-500">{p.author} · {p.license}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />Replace existing values (otherwise only empty fields are filled; photos are added)</label>
            <button onClick={apply} disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Save to college</button>
          </div>
          <p className="text-xs text-slate-400">Wikipedia text is CC BY-SA; the college page links back to the article. Each photo&apos;s author and licence are shown on the site.</p>
        </div>
      )}
    </div>
  );
}
