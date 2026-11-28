'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, RefreshCw, Check, Trash2, ArrowRightLeft } from 'lucide-react';
import { api } from '@/lib/api';

type R = { id: string; name: string; slug: string; city: string | null; country: string | null; website: string; website_status: string; website_final: string | null; website_note: string | null; website_checked_at: string | null };
const TABS: [string, string, string][] = [
  ['', 'All problems', 'bg-slate-800'], ['bad', 'Parked / spam', 'bg-rose-600'], ['dead', 'Dead', 'bg-rose-500'], ['moved', 'Redirects elsewhere', 'bg-amber-500'],
  ['blocked', 'Couldn’t check', 'bg-slate-500'], ['ok', 'OK', 'bg-emerald-600'],
];
const LABEL: Record<string, string> = { bad: 'Parked / spam — hidden', dead: 'Dead — hidden', moved: 'Redirects elsewhere', blocked: 'Couldn’t check', ok: 'OK' };

// Checks every college's website (server/src/services/websiteCheck.js): dead, parked / for sale, spam, or now going somewhere else.
export default function WebsiteCheck() {
  const [tab, setTab] = useState(''); const [q, setQ] = useState('');
  const [rows, setRows] = useState<R[] | null>(null); const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const r = await api(`/api/admin/website-check?${new URLSearchParams({ ...(tab ? { status: tab } : {}), ...(q ? { q } : {}) })}`);
    setRows(r.data || []); setCounts(r.counts || {});
  }, [tab, q]);
  useEffect(() => { setRows(null); const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  const act = async (r: R, action: 'use_new' | 'remove' | 'fine') => {
    setBusy(r.id); await api(`/api/admin/website-check/${r.id}`, { method: 'POST', body: JSON.stringify({ action }) }).catch((e) => alert(e.message)); setBusy('');
    setRows((l) => (l || []).filter((x) => x.id !== r.id));
  };
  const run = async () => { setBusy('run'); await api('/api/admin/website-check/run', { method: 'POST' }).catch(() => null); setBusy(''); setMsg('Checking the next 150 websites — about 2–4 minutes. Refresh then.'); setTimeout(load, 120_000); };
  const problems = (counts.bad || 0) + (counts.dead || 0) + (counts.moved || 0);

  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm text-slate-600">
        <p>The server opens every college’s website (ranked colleges first, 150 every 30 minutes) and follows where it really goes. <b>Parked / for-sale / spam</b> and <b>dead</b> websites are hidden from the public college page straight away (dead only after failing twice). <b>Redirects elsewhere</b> may be the college’s new address or a takeover — you decide. <b>Couldn’t check</b> means the site refused the server or was slow; it isn’t judged.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span><b className="text-slate-900">{(counts.ok || 0).toLocaleString('en-IN')}</b> OK</span>
          <span><b className="text-rose-700">{problems.toLocaleString('en-IN')}</b> need a look</span>
          <span><b>{(counts.blocked || 0).toLocaleString('en-IN')}</b> couldn’t check</span>
          <span><b>{(counts.unchecked || 0).toLocaleString('en-IN')}</b> not checked yet</span>
          <button onClick={run} disabled={busy === 'run'} className="btn-primary ms-auto py-1.5 text-sm">{busy === 'run' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Check now</button>
        </div>
        {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(([k, l, c]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-sm font-medium ${tab === k ? `${c} text-white` : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{l}{k && counts[k] ? ` · ${counts[k].toLocaleString('en-IN')}` : ''}</button>)}
        <input className="input ms-auto w-56 py-1.5" placeholder="Find a college…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card overflow-x-auto">
        {rows === null ? <p className="p-6 text-sm text-slate-500"><Loader2 size={14} className="me-1 inline animate-spin" />Loading…</p>
        : rows.length === 0 ? <p className="p-6 text-sm text-slate-500">{tab || q ? 'Nothing here.' : 'No problems found so far — the check runs every 30 minutes, or press Check now.'}</p>
        : <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">College</th><th className="px-3 py-2">Website → where it goes</th><th className="px-3 py-2">Found</th><th className="px-3 py-2" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-3 py-2"><Link href={`/admin/colleges/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{r.name}</Link><p className="text-xs text-slate-500">{[r.city, r.country].filter(Boolean).join(', ')}</p></td>
                <td className="px-3 py-2 text-xs">
                  <a href={r.website} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-700 hover:underline">{r.website} <ExternalLink size={10} className="inline" /></a>
                  {r.website_final && <p className="mt-0.5 break-all text-slate-600">→ <a href={r.website_final} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">{r.website_final}</a></p>}
                  {r.website_note && <p className="mt-0.5 text-slate-500">{r.website_note}</p>}
                </td>
                <td className="px-3 py-2 text-xs"><span className={`rounded-full px-2 py-0.5 font-semibold ${r.website_status === 'ok' ? 'bg-emerald-50 text-emerald-700' : r.website_status === 'moved' ? 'bg-amber-50 text-amber-800' : r.website_status === 'blocked' ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700'}`}>{LABEL[r.website_status] || r.website_status}</span>
                  {r.website_checked_at && <p className="mt-1 text-slate-400">{new Date(r.website_checked_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}</td>
                <td className="px-3 py-2"><div className="flex flex-col items-start gap-1 text-xs">
                  {r.website_final && r.website_status === 'moved' && <button onClick={() => act(r, 'use_new')} disabled={busy === r.id} className="flex items-center gap-1 font-semibold text-brand-700 hover:underline"><ArrowRightLeft size={12} />Use new address</button>}
                  {r.website_status !== 'ok' && <button onClick={() => act(r, 'fine')} disabled={busy === r.id} className="flex items-center gap-1 text-emerald-700 hover:underline"><Check size={12} />It’s fine</button>}
                  <button onClick={() => { if (confirm(`Remove the website of ${r.name}?`)) act(r, 'remove'); }} disabled={busy === r.id} className="flex items-center gap-1 text-rose-700 hover:underline"><Trash2 size={12} />Remove website</button>
                </div></td>
              </tr>))}</tbody>
          </table>}
      </div>
    </div>
  );
}
