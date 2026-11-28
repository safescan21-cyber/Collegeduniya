'use client';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

type Job = { label: string; hint: string; param: string | null; heavy: boolean; running?: boolean; started_at?: string; finished_at?: string; result?: any; error?: string; log?: string[] };

const ago = (t?: string) => { if (!t) return ''; const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
const summary = (r: any) => {
  if (r == null) return 'Done';
  if (typeof r !== 'object') return String(r);
  if (r.skipped) return `Skipped: ${r.skipped}`;
  return Object.entries(r).filter(([, v]) => typeof v === 'number' || typeof v === 'string').slice(0, 6).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ') || 'Done';
};

// One click per collector. Jobs run on the server in the background — you can leave this page and come back.
export default function FetchData() {
  const [data, setData] = useState<{ jobs: Record<string, Job>; totals: any } | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string>('');
  const load = useCallback(async () => { const r = await api('/api/admin/fetch/status').catch(() => null); if (r) setData(r); }, []);
  useEffect(() => { load(); }, [load]);
  const anyRunning = data && Object.values(data.jobs).some((j) => j.running);
  useEffect(() => { if (!anyRunning) return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [anyRunning, load]);
  const start = async (key: string) => {
    setMsg('');
    try { await api(`/api/admin/fetch/${key}`, { method: 'POST', body: JSON.stringify({ param: params[key] || '' }) }); }
    catch (e: any) { setMsg(e.message); }
    load();
  };
  const t = data?.totals;
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Fetch data</h1>
      <p className="mt-1 text-sm text-slate-500">Click to fetch college details now. These jobs also run by themselves every few hours when the server is quiet. Only official sources are used; nothing is made up.</p>
      {t && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Colleges', t.colleges], ['With photo', t.withPhoto], ['Courses', t.courses], ['Courses from official sites', t.official]].map(([l, v]) => (
          <div key={l} className="card p-3"><p className="text-xl font-bold text-slate-900">{Number(v).toLocaleString('en-IN')}</p><p className="text-xs text-slate-500">{l}</p></div>))}
      </div>}
      {msg && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{msg}</p>}
      {!data ? <Loader2 className="mt-6 animate-spin" /> : (
        <div className="mt-4 space-y-3">
          {Object.entries(data.jobs).map(([key, j]) => (
            <div key={key} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{j.label}{j.heavy && <span className="ms-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">big — run at night</span>}</p>
                <p className="text-xs text-slate-500">{j.hint}</p>
                <p className="mt-1 text-xs">
                  {j.running ? <span className="flex items-center gap-1 text-brand-700"><Loader2 size={12} className="animate-spin" />Running since {ago(j.started_at)}{j.log?.length ? ` — ${j.log[j.log.length - 1]}` : ''}</span>
                    : j.error ? <span className="flex items-center gap-1 text-rose-700"><XCircle size={12} />{j.error} ({ago(j.finished_at)})</span>
                    : j.finished_at ? <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} />{summary(j.result)} ({ago(j.finished_at)})</span> : null}
                </p>
              </div>
              {j.param && <input className="input w-44 py-1.5 text-sm" placeholder={j.param} value={params[key] || ''} onChange={(e) => setParams({ ...params, [key]: e.target.value })} />}
              <button onClick={() => start(key)} disabled={!!j.running || (key === 'country' && !params.country)} className="btn-primary py-1.5 text-sm">
                {j.running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}Run
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
