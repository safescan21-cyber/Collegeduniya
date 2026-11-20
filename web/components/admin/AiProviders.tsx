'use client';
import { useCallback, useEffect, useState } from 'react';
import { Cpu, Loader2, CheckCircle2, XCircle, ExternalLink, List, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

type P = { id: string; name: string; configured: boolean; model: string | null; key_env: string; signup: string; ok: number; fail: number; last_error: string | null; last_ok: string | null; cooling_down_until: string | null };

export default function AiProviders() {
  const [rows, setRows] = useState<P[]>([]); const [order, setOrder] = useState<string[]>([]);
  const [test, setTest] = useState<Record<string, any>>({}); const [models, setModels] = useState<Record<string, string[] | string>>({});
  const load = useCallback(() => api('/api/admin/ai/providers').then((r) => { setRows(r.data); setOrder(r.order); }).catch(() => undefined), []);
  useEffect(() => { load(); }, [load]);
  const run = async (id: string) => { setTest((t) => ({ ...t, [id]: 'busy' })); const r = await api(`/api/admin/ai/providers/${id}/test`, { method: 'POST', body: '{}' }).catch((e) => ({ ok: false, error: e.message })); setTest((t) => ({ ...t, [id]: r })); load(); };
  const list = async (id: string) => { setModels((m) => ({ ...m, [id]: 'busy' })); const r = await api(`/api/admin/ai/providers/${id}/models`).catch((e) => ({ data: e.message })); setModels((m) => ({ ...m, [id]: r.data })); };
  const on = rows.filter((r) => r.configured);
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold text-slate-900"><Cpu size={17} className="text-brand-600" />AI providers <span className="text-sm font-normal text-slate-500">— {on.length} connected</span></p>
        {order.length > 0 && <p className="text-xs text-slate-500">Order: {order.join(' → ')} · the double-check uses a different provider from the writer</p>}
      </div>
      <p className="mt-1 text-xs text-slate-500">Add a key in <code>server/.env</code> for every free service you sign up for, then restart the API. When one hits its limit, the next takes over automatically.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 pe-3">Provider</th><th className="pe-3">Model</th><th className="pe-3">Calls</th><th className="pe-3">Status</th><th /></tr></thead>
          <tbody>{rows.map((p) => {
            const t = test[p.id]; const m = models[p.id];
            return (
              <tr key={p.id} className="border-t border-slate-100 align-top">
                <td className="py-2 pe-3"><p className="font-medium">{p.name}</p><p className="text-xs text-slate-400"><code>{p.key_env}</code>{p.signup && <> · <a href={p.signup} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 text-brand-700 underline">get key<ExternalLink size={10} /></a></>}</p></td>
                <td className="py-2 pe-3 text-xs"><code>{p.model || '—'}</code>
                  {Array.isArray(m) && <p className="mt-1 max-h-24 overflow-y-auto text-slate-500">{m.slice(0, 60).join(', ') || 'No models listed'}</p>}
                  {typeof m === 'string' && m !== 'busy' && <p className="mt-1 text-rose-600">{m}</p>}</td>
                <td className="py-2 pe-3 text-xs">{p.ok || p.fail ? <>✓ {p.ok} · ✗ {p.fail}</> : '—'}</td>
                <td className="py-2 pe-3 text-xs">
                  {!p.configured ? <span className="chip">Not set</span> : p.cooling_down_until ? <span className="chip-amber"><Clock size={11} />Resting until {new Date(p.cooling_down_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : <span className="chip-green">Ready</span>}
                  {p.last_error && <p className="mt-1 max-w-xs text-rose-600">{p.last_error}</p>}
                  {p.last_ok && <p className="mt-0.5 text-slate-400">last success {timeAgo(p.last_ok)}</p>}
                  {t && t !== 'busy' && (t.ok ? <p className="mt-1 text-emerald-700"><CheckCircle2 size={12} className="inline" /> Works · {t.ms} ms{t.correct === false ? ' (wrong maths!)' : ''}</p> : <p className="mt-1 text-rose-600"><XCircle size={12} className="inline" /> {t.error}</p>)}
                </td>
                <td className="py-2 text-right">{p.configured && <div className="flex justify-end gap-1">
                  <button onClick={() => run(p.id)} className="btn-ghost px-2 py-1 text-xs">{t === 'busy' ? <Loader2 size={13} className="animate-spin" /> : 'Test'}</button>
                  {p.id !== 'anthropic' && <button onClick={() => list(p.id)} className="btn-ghost px-2 py-1 text-xs" title="Show available models">{m === 'busy' ? <Loader2 size={13} className="animate-spin" /> : <List size={13} />}</button>}</div>}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">If a test fails with “model not found”, click the list icon and set <code>&lt;PROVIDER&gt;_MODEL</code> (e.g. <code>GROQ_MODEL</code>) to one of the names shown.</p>
    </section>
  );
}
