'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

type Q = {
  totals: { visitors: number; real: number; one_page: number; suspicious: number; page_views: number; pages_per_real_visitor: number };
  by_day: { day: string; real: number; one_page: number; suspicious: number }[];
  by_hour: { hour: number; visitors: number; suspicious: number }[];
  devices: { device: string; visitors: number; suspicious: number; one_page: number }[];
  referrers: { site: string; visitors: number }[];
  top_pages: { path: string; views: number }[];
  samples: { ua: string; views: number; per_min: number }[];
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

// Admin dashboard: how many visitors look like real people vs bots (migration 033, admins' own visits excluded)
export default function VisitQuality() {
  const [days, setDays] = useState(3); const [q, setQ] = useState<Q | null>(null); const [err, setErr] = useState('');
  useEffect(() => {
    setQ(null); setErr('');
    supabaseBrowser().rpc('visit_quality', { p_days: days }).then(({ data, error }: { data: any; error: any }) => (error ? setErr(error.message) : setQ(data as Q)));
  }, [days]);
  const T = q?.totals;
  const max = Math.max(1, ...(q?.by_day || []).map((d) => d.real + d.one_page + d.suspicious));
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck size={18} />Real visitors vs bots</h2>
        <div className="flex gap-1">{[1, 3, 7, 30].map((d) => <button key={d} onClick={() => setDays(d)} className={d === days ? 'chip-brand' : 'chip'}>{d === 1 ? '24 h' : `${d} days`}</button>)}</div>
      </div>
      {err ? <p className="mt-2 text-sm text-rose-700">{err}</p> : !q || !T ? <Loader2 className="mt-3 animate-spin text-slate-300" /> : <>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Real people</p><p className="text-2xl font-bold text-emerald-900">{T.real.toLocaleString('en-IN')}</p><p className="text-xs text-emerald-700">{pct(T.real, T.visitors)}% · {T.pages_per_real_visitor} pages each</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">One page, no source</p><p className="text-2xl font-bold text-slate-800">{T.one_page.toLocaleString('en-IN')}</p><p className="text-xs text-slate-500">{pct(T.one_page, T.visitors)}% · person or bot</p></div>
          <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-rose-800">Suspicious / bots</p><p className="text-2xl font-bold text-rose-900">{T.suspicious.toLocaleString('en-IN')}</p><p className="text-xs text-rose-700">{pct(T.suspicious, T.visitors)}%</p></div>
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100"><p className="text-xs text-slate-600">All visitors</p><p className="text-2xl font-bold text-slate-900">{T.visitors.toLocaleString('en-IN')}</p><p className="text-xs text-slate-500">{T.page_views.toLocaleString('en-IN')} page views</p></div>
        </div>

        <div className="mt-4 space-y-1.5">
          {q.by_day.map((d) => { const n = d.real + d.one_page + d.suspicious; return (
            <div key={d.day} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 text-slate-500">{d.day.slice(5)}</span>
              <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100" style={{ maxWidth: `${(n / max) * 100}%` }}>
                <div className="bg-emerald-500" style={{ width: `${pct(d.real, n)}%` }} /><div className="bg-slate-300" style={{ width: `${pct(d.one_page, n)}%` }} /><div className="bg-rose-400" style={{ width: `${pct(d.suspicious, n)}%` }} />
              </div>
              <span className="w-28 shrink-0 text-right text-slate-600">{d.real} real · {d.suspicious} bot</span>
            </div>); })}
          <p className="text-[11px] text-slate-400"><span className="text-emerald-600">■</span> real <span className="text-slate-400">■</span> one page <span className="text-rose-500">■</span> suspicious</p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
          <div><h3 className="font-semibold text-slate-800">Where they came from</h3><ul className="mt-1 space-y-0.5">{q.referrers.map((r) => <li key={r.site} className="flex justify-between gap-2"><span className="truncate text-slate-600">{r.site}</span><b>{r.visitors}</b></li>)}</ul></div>
          <div><h3 className="font-semibold text-slate-800">Devices</h3><ul className="mt-1 space-y-0.5">{q.devices.map((d) => <li key={d.device} className="flex justify-between gap-2"><span className="truncate text-slate-600">{d.device}</span><span><b>{d.visitors}</b>{d.suspicious ? <span className="text-rose-600"> ({d.suspicious} bot)</span> : null}</span></li>)}</ul>
            <p className="mt-1 text-[11px] text-slate-400">Many “Linux desktop” visitors usually means servers/bots — real students are mostly on Android and Windows.</p></div>
          <div><h3 className="font-semibold text-slate-800">Most viewed pages</h3><ul className="mt-1 space-y-0.5">{q.top_pages.map((p) => <li key={p.path} className="flex justify-between gap-2"><span className="truncate text-slate-600">{p.path}</span><b>{p.views}</b></li>)}</ul></div>
        </div>

        <div className="mt-4 text-sm">
          <h3 className="font-semibold text-slate-800">Visits by hour (India time)</h3>
          <div className="mt-1 flex h-16 items-end gap-0.5">{Array.from({ length: 24 }, (_, h) => { const b = q.by_hour.find((x) => x.hour === h); const m = Math.max(1, ...q.by_hour.map((x) => x.visitors)); return (
            <div key={h} title={`${h}:00 — ${b?.visitors || 0} visitors, ${b?.suspicious || 0} suspicious`} className="flex flex-1 flex-col justify-end"><div className="rounded-t bg-rose-400" style={{ height: `${((b?.suspicious || 0) / m) * 64}px` }} /><div className="bg-brand-500" style={{ height: `${(((b?.visitors || 0) - (b?.suspicious || 0)) / m) * 64}px` }} /></div>); })}</div>
          <p className="text-[11px] text-slate-400">0 h ← → 23 h. Real students visit in the day and evening; big spikes at 2–5 am are usually bots.</p>
        </div>

        {q.samples.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer text-slate-500">Examples of suspicious visitors</summary>
          <ul className="mt-1 space-y-1">{q.samples.map((s, i) => <li key={i} className="break-all font-mono text-slate-600">{s.views} pages{s.per_min > 20 ? ` (${s.per_min}/min)` : ''} — {s.ua || '(no browser name)'}</li>)}</ul></details>}
        <p className="mt-3 text-[11px] text-slate-400">Real = opened 2+ pages, came from another site (Google, WhatsApp…) or is logged in. Suspicious = automation/SEO tool/link-preview browser name, very old Chrome, no browser name, &gt;20 pages a minute or &gt;300 pages. Search engines (Googlebot etc.) are never counted at all. One person on two devices counts twice. Your admins' visits are left out.</p>
      </>}
    </section>
  );
}
