'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, EyeOff, Eye, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

type N = { id: string; category: string; region: string; title: string; url: string; source: string | null; published_at: string; is_hidden: boolean };
const STUDY_CATS: Record<string, string> = { admissions: 'Admissions', scholarships: 'Scholarships', colleges: 'Universities & colleges', policy: 'Education policy', abroad: 'Study abroad', skills: 'Future skills & jobs' };

// Study news, collected every 4 hours (server/src/services/studyNews.js) from news headlines (GDELT). Hide anything not useful.
export default function AdminStudyNews() {
  const [cat, setCat] = useState('');
  const [rows, setRows] = useState<N[] | null>(null); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const r = await api(`/api/admin/study-news${cat ? `?category=${cat}` : ''}`); setRows(r.data || []); }, [cat]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const hide = async (n: N) => { setBusy(n.id); await api(`/api/admin/study-news/${n.id}/hide`, { method: 'POST', body: JSON.stringify({ hidden: !n.is_hidden }) }); setBusy('');
    setRows((l) => (l || []).map((x) => (x.id === n.id ? { ...x, is_hidden: !x.is_hidden } : x))); };
  const collect = async () => {
    setBusy('run'); await api('/api/admin/study-news/collect', { method: 'POST' }).catch(() => null); setBusy('');
    setMsg('Collecting — about 1–2 minutes. This list refreshes by itself.'); setTimeout(load, 60_000); setTimeout(load, 130_000);
  };
  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm text-slate-600">
        <p>Education headlines collected automatically <b>every 4 hours</b>: admissions, scholarships, universities & colleges, education policy, study abroad and future skills. Crime and tragedy stories are left out. Shown on <Link href="/news" className="text-brand-700 underline">/news</Link> with <Link href="/admin/visa-news" className="text-brand-700 underline">visa news</Link>. Hide anything not useful.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="input w-auto py-1.5" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{Object.entries(STUDY_CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <button onClick={collect} disabled={busy === 'run'} className="btn-primary ms-auto py-1.5 text-sm">{busy === 'run' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Collect now</button>
        </div>
        {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
      </div>
      <div className="card overflow-x-auto">
        {rows === null ? <p className="p-6 text-sm text-slate-500"><Loader2 size={14} className="me-1 inline animate-spin" />Loading…</p>
        : rows.length === 0 ? <p className="p-6 text-sm text-slate-500">Nothing yet — the first collection runs about 10 minutes after the server starts. Press <b>Collect now</b> to run it.</p>
        : <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Category</th><th className="px-3 py-2">Headline</th><th className="px-3 py-2">Date</th><th className="px-3 py-2" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((n) => (
              <tr key={n.id} className={n.is_hidden ? 'opacity-40' : ''}>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{STUDY_CATS[n.category] || n.category}{n.region === 'world' ? ' 🌍' : ''}</td>
                <td className="px-3 py-2"><a href={n.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 hover:text-brand-700">{n.title} <ExternalLink size={11} className="inline" /></a><p className="text-xs text-slate-500">{n.source}</p></td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">{new Date(n.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="px-3 py-2"><button onClick={() => hide(n)} disabled={busy === n.id} className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900">{n.is_hidden ? <><Eye size={13} />Show</> : <><EyeOff size={13} />Hide</>}</button></td>
              </tr>))}</tbody>
          </table>}
      </div>
    </div>
  );
}
