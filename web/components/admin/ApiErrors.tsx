'use client';
import { useCallback, useEffect, useState } from 'react';
import { Bug, Wrench, Loader2, CheckCheck, Gauge } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

type ErrRow = { key: string; route: string; status: number | null; kind: string; cause: string; fix: string; message: string; count: number; first_at: string; last_at: string; resolved: boolean };
type Fix = { action: string; reason: string; ok: boolean; detail: string; created_at: string };
type Load = { cpus: number; load: number; per_cpu: number; limit: number; busy: boolean; paused_until: string | null; paused_why: string | null; skipped: Record<string, number> };
type Report = { errors: ErrRow[]; fixes: Fix[]; actions: { id: string; label: string }[]; load: Load; auto_fix: boolean };

const KIND: Record<string, string> = {
  database_down: 'Database not reachable', database_slow: 'Database too busy', schema_out_of_date: 'Database update missing',
  permission: 'Access rule', login_service: 'Login service', ai_limit: 'AI limit', email: 'Email', memory: 'Out of memory',
  bad_input: 'Bad input', code_error: 'Code error', slow: 'Slow request',
};

// Admin → System health: every failing or slow API call, what it means, how it gets fixed, and the automatic repairs
export default function ApiErrors() {
  const [r, setR] = useState<Report | null>(null); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const [showOld, setShowOld] = useState(false);
  const load = useCallback(async () => { try { setR(await api<Report>('/api/admin/errors')); } catch (e: any) { setMsg(e.message); } }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const fix = async (id: string, label: string) => {
    if (!confirm(`${label}?`)) return;
    setBusy(id);
    try { const x = await api<any>(`/api/admin/fix/${id}`, { method: 'POST' }); setMsg(`${x.label}: ${x.ok ? 'done' : 'failed'}${x.detail ? ` — ${x.detail}` : ''}`); }
    catch (e: any) { setMsg(e.message); }
    setBusy(''); load();
  };
  const resolve = async (key: string | null) => { setBusy(key || 'all'); try { await api('/api/admin/errors/resolve', { method: 'POST', body: JSON.stringify({ key }) }); } catch (e: any) { setMsg(e.message); } setBusy(''); load(); };

  if (!r) return <section className="card p-4"><Loader2 className="animate-spin text-slate-300" /></section>;
  const open = r.errors.filter((e) => !e.resolved); const list = showOld ? r.errors : open;
  const L = r.load;
  return (
    <section className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><Gauge size={18} />Server load</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${L.busy ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{L.busy ? 'Busy — background jobs waiting' : 'Normal'}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">Load {L.load} on {L.cpus} CPUs ({L.per_cpu} per CPU; background jobs pause above {L.limit}).
          {L.paused_until && <> Paused until {new Date(L.paused_until).toLocaleTimeString('en-IN')} — {L.paused_why}.</>}
          {Object.keys(L.skipped).length > 0 && <> Postponed so far: {Object.entries(L.skipped).map(([k, v]) => `${k} ×${v}`).join(', ')}.</>}</p>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><Bug size={18} />API errors <span className="text-sm font-normal text-slate-500">({open.length} open)</span></h2>
          <div className="flex gap-2">
            <button onClick={() => setShowOld((v) => !v)} className="btn-ghost text-xs">{showOld ? 'Only open' : 'Show fixed too'}</button>
            {open.length > 0 && <button onClick={() => resolve(null)} disabled={!!busy} className="btn-ghost text-xs"><CheckCheck size={14} />Mark all fixed</button>}
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">Every failed or very slow API call is counted here with its likely cause and the fix. When the same problem repeats 20× in 5 minutes, the matching repair runs by itself{r.auto_fix ? '' : ' (automatic repairs are OFF: AUTO_FIX=off)'}.</p>
        {list.length === 0 ? <p className="mt-3 text-sm text-emerald-700">No API errors. 🎉</p> : (
          <div className="mt-3 space-y-2">
            {list.map((e) => (
              <details key={e.key} className={`rounded-xl border p-3 ${e.resolved ? 'border-slate-100 opacity-60' : 'border-rose-100 bg-rose-50/40'}`}>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">{KIND[e.kind] || e.kind}</span>
                  <code className="text-xs text-slate-700">{e.route}</code>
                  <span className="text-xs text-slate-500">×{e.count} · last {timeAgo(e.last_at)}{e.status ? ` · HTTP ${e.status}` : ''}</span>
                </summary>
                <div className="mt-2 space-y-1 text-sm">
                  {e.message && <p className="break-words font-mono text-xs text-rose-700">{e.message}</p>}
                  <p><b>Why:</b> {e.cause}</p>
                  <p><b>Fix:</b> {e.fix}</p>
                  <p className="text-xs text-slate-400">First seen {timeAgo(e.first_at)}</p>
                  {!e.resolved && <button onClick={() => resolve(e.key)} disabled={!!busy} className="btn-ghost text-xs"><CheckCheck size={14} />Mark fixed</button>}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><Wrench size={18} />Repairs</h2>
        <p className="mt-1 text-xs text-slate-500">Run by hand if something is stuck (super admin). Automatic repairs wait 15 minutes between tries and stop after 6 a day, so they never loop.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {r.actions.map((a) => (
            <button key={a.id} onClick={() => fix(a.id, a.label)} disabled={!!busy} className="btn-ghost text-xs">
              {busy === a.id ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}{a.label}
            </button>
          ))}
        </div>
        {msg && <p className="mt-2 text-sm text-slate-700">{msg}</p>}
        <h3 className="mt-4 text-sm font-semibold text-slate-700">Recent repairs</h3>
        {r.fixes.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
          <ul className="mt-1 space-y-1 text-sm">
            {r.fixes.slice(0, 20).map((f, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className={f.ok ? 'text-emerald-700' : 'text-rose-700'}>{f.ok ? '✓' : '✗'} {r.actions.find((a) => a.id === f.action)?.label || f.action}</span>
                <span className="text-slate-500">— {f.reason}</span>
                <span className="text-xs text-slate-400">{timeAgo(f.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
