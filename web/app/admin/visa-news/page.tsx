'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, EyeOff, Eye, Loader2, RefreshCw, AlertTriangle, Check, Landmark } from 'lucide-react';
import { api } from '@/lib/api';

type N = { id: string; country_code: string; title: string; url: string; source: string | null; official: boolean; topic: string; published_at: string; is_hidden: boolean };
type G = { country_code: string; title: string; updated_at: string; needs_review_since: string | null; review_reason: string | null };
const COUNTRIES = ['GB', 'US', 'CA', 'AU', 'IE', 'NZ', 'DE', 'FR', 'NL', 'SG', 'AE', 'JP'];
const flag = (cc: string) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
const TOPIC: Record<string, string> = { rules: 'Rule change', fees: 'Fees / money', work: 'Work rights', processing: 'Processing', family: 'Family', news: 'News' };

// Student visa news, collected every 6 hours (server/src/services/visaNews.js): governments' own feeds + news headlines.
// Hide anything wrong. Guides flagged "needs review" when a government announces a change — editing the guide clears it.
export default function AdminVisaNews() {
  const [country, setCountry] = useState(''); const [official, setOfficial] = useState(false);
  const [rows, setRows] = useState<N[] | null>(null); const [guides, setGuides] = useState<G[]>([]);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const r = await api(`/api/admin/visa-news?${new URLSearchParams({ ...(country ? { country } : {}), ...(official ? { official: '1' } : {}) })}`);
    setRows(r.data || []); setGuides(r.guides || []);
  }, [country, official]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const hide = async (n: N) => { setBusy(n.id); await api(`/api/admin/visa-news/${n.id}/hide`, { method: 'POST', body: JSON.stringify({ hidden: !n.is_hidden }) }); setBusy('');
    setRows((l) => (l || []).map((x) => (x.id === n.id ? { ...x, is_hidden: !x.is_hidden } : x))); };
  const collect = async () => {
    setBusy('run'); setMsg('');
    const r = await api(`/api/admin/visa-news/collect${country ? `?country=${country}` : ''}`, { method: 'POST' }).catch((e) => ({ error: e.message }));
    setBusy('');
    if (r.error) return setMsg(r.error);
    if (r.started) { setMsg('Collecting all countries — about 2 minutes. This list refreshes by itself.'); setTimeout(load, 70_000); setTimeout(load, 150_000); return; }
    setMsg(`${r.saved} new item(s) saved (${r.official} official) from ${r.found} found${r.errors ? ` · ${r.errors} source(s) did not answer` : ''}.`); load();
  };
  const reviewed = async (cc: string) => { await api(`/api/admin/visa-guides/${cc}/reviewed`, { method: 'POST' }); setGuides((g) => g.map((x) => (x.country_code === cc ? { ...x, needs_review_since: null } : x))); };
  const flagged = guides.filter((g) => g.needs_review_since);

  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm text-slate-600">
        <p>Collected automatically <b>every 6 hours</b> for {COUNTRIES.length} countries: <b>official</b> news from UK Visas and Immigration, USCIS, Canada IRCC and Irish Immigration, plus news headlines (GDELT) that mention student visas for that country. Only the headline, source and link are kept. Hide anything that is not useful.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="input w-auto py-1.5" value={country} onChange={(e) => setCountry(e.target.value)}><option value="">All countries</option>{COUNTRIES.map((c) => <option key={c} value={c}>{flag(c)} {c}</option>)}</select>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} />Official only</label>
          <button onClick={collect} disabled={busy === 'run'} className="btn-primary ms-auto py-1.5 text-sm">{busy === 'run' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Collect now{country ? ` (${country})` : ''}</button>
        </div>
        {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
      </div>

      {flagged.length > 0 && <div className="card border-amber-200 bg-amber-50 p-4">
        <p className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle size={16} />{flagged.length} visa guide(s) may be out of date</p>
        <ul className="mt-2 space-y-2 text-sm">{flagged.map((g) => (
          <li key={g.country_code} className="flex flex-wrap items-center gap-2"><b>{flag(g.country_code)} {g.title}</b><span className="text-amber-800">— the government announced: “{g.review_reason}”</span>
            <Link href="/admin/visa-guides" className="font-semibold text-brand-700 underline">Update the guide</Link>
            <button onClick={() => reviewed(g.country_code)} className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"><Check size={13} />No change needed</button></li>))}</ul>
      </div>}

      <div className="card overflow-x-auto">
        {rows === null ? <p className="p-6 text-sm text-slate-500"><Loader2 size={14} className="me-1 inline animate-spin" />Loading…</p>
        : rows.length === 0 ? <p className="p-6 text-sm text-slate-500">Nothing yet — the first collection runs a few minutes after the server starts. Press <b>Collect now</b> to run it.</p>
        : <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Country</th><th className="px-3 py-2">Headline</th><th className="px-3 py-2">Topic</th><th className="px-3 py-2">Date</th><th className="px-3 py-2" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((n) => (
              <tr key={n.id} className={n.is_hidden ? 'opacity-40' : ''}>
                <td className="px-3 py-2 whitespace-nowrap">{flag(n.country_code)} {n.country_code}</td>
                <td className="px-3 py-2"><a href={n.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 hover:text-brand-700">{n.title} <ExternalLink size={11} className="inline" /></a>
                  <p className="flex items-center gap-1 text-xs text-slate-500">{n.official && <span className="flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 font-semibold text-emerald-700"><Landmark size={10} />Official</span>}{n.source}</p></td>
                <td className="px-3 py-2 text-xs">{TOPIC[n.topic] || n.topic}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">{new Date(n.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="px-3 py-2"><button onClick={() => hide(n)} disabled={busy === n.id} className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900">{n.is_hidden ? <><Eye size={13} />Show</> : <><EyeOff size={13} />Hide</>}</button></td>
              </tr>))}</tbody>
          </table>}
      </div>
    </div>
  );
}
