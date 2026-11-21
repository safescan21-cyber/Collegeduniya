'use client';
import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw, BellRing } from 'lucide-react';
import { api } from '@/lib/api';
import EmailSetup from '@/components/admin/EmailSetup';
import { timeAgo } from '@/lib/format';

type Check = { name: string; group: string; warn: boolean; ok: boolean; detail: string; ms: number; checkedAt: string; since: string; fails: number };
type Status = { lastRun: string | null; overall: 'ok' | 'warning' | 'down' | 'unknown'; every_min: number; email_alerts: boolean; alert_emails: string; checks: Check[] };

const LOOK = {
  ok: { text: 'All systems working', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  warning: { text: 'Working, with warnings', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertTriangle },
  down: { text: 'Something is not working', cls: 'bg-rose-50 text-rose-800 border-rose-200', Icon: XCircle },
  unknown: { text: 'Checking…', cls: 'bg-slate-50 text-slate-700 border-slate-200', Icon: Activity },
};

export default function HealthPage() {
  const [s, setS] = useState<Status | null>(null); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(async (fresh = false) => {
    if (fresh) setBusy('run');
    try { setS(await api<Status>(`/api/admin/health${fresh ? '?fresh=1' : ''}`)); setMsg(''); }
    catch (e: any) { setMsg(`The API server is not answering: ${e.message}`); setS((p) => p && { ...p, overall: 'down' }); }
    setBusy('');
  }, []);
  useEffect(() => { load(); const t = setInterval(() => load(), 30000); return () => clearInterval(t); }, [load]);
  const test = async () => {
    setBusy('test');
    try { const r = await api<any>('/api/admin/health/test-alert', { method: 'POST' }); setMsg(r.email ? 'Test alert sent — check your email and the bell icon.' : 'Test alert added to the bell icon. Email is not set up yet, so no email was sent.'); }
    catch (e: any) { setMsg(e.message); }
    setBusy('');
  };
  const look = LOOK[s?.overall || 'unknown'];
  const groups = Array.from(new Set((s?.checks || []).map((c) => c.group)));
  return (
    <div className="space-y-5">
      <EmailSetup />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System health</h1>
          <p className="text-sm text-slate-500">Checked automatically every {s?.every_min ?? 5} minutes. If something fails twice in a row, admins get an email{s && !s.email_alerts ? ' (once email is set up)' : ''} and a bell notification, and another when it is fixed.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)} disabled={!!busy} className="btn-primary">{busy === 'run' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}Check now</button>
          <button onClick={test} disabled={!!busy} className="btn-ghost">{busy === 'test' ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}Send test alert</button>
        </div>
      </div>

      <div className={`flex items-center gap-3 rounded-2xl border p-4 ${look.cls}`}>
        <look.Icon size={22} /><div><p className="font-bold">{look.text}</p>
          <p className="text-xs opacity-80">{s?.lastRun ? `Last checked ${timeAgo(s.lastRun)}` : 'Running first check…'} · Alerts go to {s?.alert_emails || 'all admins'}</p></div>
      </div>
      {msg && <p className="text-sm text-slate-700">{msg}</p>}

      {!s ? <Loader2 className="animate-spin text-slate-300" /> : groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {s.checks.filter((c) => c.group === g).map((c) => {
              const tone = c.ok ? 'bg-emerald-500' : c.warn ? 'bg-amber-400' : 'bg-rose-500';
              return (
                <div key={c.name} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-semibold text-slate-900"><span className={`h-2.5 w-2.5 rounded-full ${tone}`} />{c.name}</p>
                    <span className="text-xs text-slate-400">{c.ms} ms</span>
                  </div>
                  <p className={`mt-1 text-sm ${c.ok ? 'text-slate-600' : c.warn ? 'text-amber-700' : 'text-rose-700'}`}>{c.detail}</p>
                  <p className="mt-1 text-xs text-slate-400">{c.ok ? 'Working' : c.warn ? 'Warning' : 'Failing'} since {timeAgo(c.since)}</p>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
