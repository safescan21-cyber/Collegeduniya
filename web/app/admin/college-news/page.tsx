'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, EyeOff, Eye, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

type N = { id: string; title: string; url: string; source: string | null; published_at: string; is_hidden: boolean; college: { id: string; name: string; slug: string } | null };

// News that names a college (server/src/services/collegeNews.js): NIRF-ranked → world top 300 → most viewed, every 3 hours.
export default function AdminCollegeNews() {
  const [rows, setRows] = useState<N[] | null>(null); const [covered, setCovered] = useState(0);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const r = await api('/api/admin/college-news'); setRows(r.data || []); setCovered(r.covered || 0); }, []);
  useEffect(() => { load(); }, [load]);
  const hide = async (n: N) => { setBusy(n.id); await api(`/api/admin/college-news/${n.id}/hide`, { method: 'POST', body: JSON.stringify({ hidden: !n.is_hidden }) }); setBusy('');
    setRows((l) => (l || []).map((x) => (x.id === n.id ? { ...x, is_hidden: !x.is_hidden } : x))); };
  const collect = async () => {
    setBusy('run'); await api('/api/admin/college-news/collect', { method: 'POST' }).catch(() => null); setBusy('');
    setMsg('Searching news for the next 40 colleges — about 1–2 minutes. This list refreshes by itself.'); setTimeout(load, 70_000); setTimeout(load, 140_000);
  };
  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm text-slate-600">
        <p>Every 3 hours the server searches the news for the next 40 colleges — <b>NIRF-ranked first</b>, then the world top 300, then the colleges students view most — and keeps headlines that name the college (also short forms like “IIT Bombay”, “NIT Trichy”). Crime and tragedy stories are left out. They show on each college page under <b>In the news</b> and on <Link href="/news?live=colleges" className="text-brand-700 underline">/news</Link>.</p>
        <p className="mt-1">A college is known by another name in the news? Add it under <b>News names</b> when editing the college (e.g. “DU”, “Jamia”).</p>
        <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500">{covered.toLocaleString('en-IN')} colleges searched so far</span>
          <button onClick={collect} disabled={busy === 'run'} className="btn-primary ms-auto py-1.5 text-sm">{busy === 'run' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Collect now</button></div>
        {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
      </div>
      <div className="card overflow-x-auto">
        {rows === null ? <p className="p-6 text-sm text-slate-500"><Loader2 size={14} className="me-1 inline animate-spin" />Loading…</p>
        : rows.length === 0 ? <p className="p-6 text-sm text-slate-500">Nothing yet — the first search runs about 12 minutes after the server starts. Press <b>Collect now</b> to run it.</p>
        : <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">College</th><th className="px-3 py-2">Headline</th><th className="px-3 py-2">Date</th><th className="px-3 py-2" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((n) => (
              <tr key={n.id} className={n.is_hidden ? 'opacity-40' : ''}>
                <td className="px-3 py-2 text-xs">{n.college ? <Link href={`/colleges/${n.college.slug}`} className="font-semibold text-brand-700 hover:underline">{n.college.name}</Link> : '—'}</td>
                <td className="px-3 py-2"><a href={n.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 hover:text-brand-700">{n.title} <ExternalLink size={11} className="inline" /></a><p className="text-xs text-slate-500">{n.source}</p></td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">{new Date(n.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="px-3 py-2"><button onClick={() => hide(n)} disabled={busy === n.id} className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900">{n.is_hidden ? <><Eye size={13} />Show</> : <><EyeOff size={13} />Hide</>}</button></td>
              </tr>))}</tbody>
          </table>}
      </div>
    </div>
  );
}
