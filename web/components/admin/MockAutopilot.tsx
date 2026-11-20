'use client';
import { useCallback, useEffect, useState } from 'react';
import { Bot, Play, Loader2, CheckCircle2, XCircle, ShieldCheck, AlertTriangle, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

type S = { autopilot: boolean; auto_publish: boolean; target_per_topic: number; daily_budget: number; min_ready_ratio: number };
const LETTERS = 'ABCDEF';
const ICON: Record<string, string> = { generated: '✍️', published: '🚀', pattern_drafted: '🧩', repaired: '🔧', report_fixed: '🔧', report_dismissed: '✅', rejected: '🗑️', budget_reached: '⏸️', error: '⚠️', settings: '⚙️' };

export default function MockAutopilot({ onPickExam }: { onPickExam: (slug: string) => void }) {
  const [s, setS] = useState<S | null>(null);
  const [st, setSt] = useState<{ running: string | null; banks: any[]; log: any[] } | null>(null);
  const [spot, setSpot] = useState<any[]>([]);
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      api('/api/admin/mock/settings').catch(() => ({ data: null })),
      api('/api/admin/mock/autopilot/status').catch(() => null),
      api('/api/admin/mock_questions?status=approved&auto_approved=true&checked_by_admin=false&limit=8').catch(() => ({ data: [] })),
    ]);
    setS(a.data); setSt(b); setSpot(c.data || []);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const save = async (patch: Partial<S>) => {
    setSaving(true); setMsg('');
    try { const r = await api('/api/admin/mock/settings', { method: 'PATCH', body: JSON.stringify({ ...s, ...patch }) }); setS(r.data); setMsg('Saved ✓'); }
    catch (e: any) { setMsg(e.message); }
    setSaving(false);
  };
  const run = async () => { await api('/api/admin/mock/autopilot/run', { method: 'POST', body: '{}' }).catch((e) => setMsg(e.message)); setTimeout(load, 1500); };
  const verdict = async (ids: string[], v: 'ok' | 'bad') => { await api('/api/admin/mock/spot-check', { method: 'POST', body: JSON.stringify({ ids, verdict: v }) }); load(); };

  if (!s || !st) return <div className="card h-64 animate-pulse" />;
  const banks = st.banks || [];
  const live = banks.filter((b) => b.is_published).length;
  const toConfirm = banks.filter((b) => b.has_pattern && !b.pattern_checked);
  const unchecked = banks.reduce((n, b) => n + Number(b.unchecked_auto || 0), 0);

  return (
    <div className="space-y-5">
      <section className={`card p-5 ${s.autopilot ? 'ring-2 ring-emerald-500' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`grid h-12 w-12 place-items-center rounded-2xl ${s.autopilot ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Bot /></span>
            <div>
              <p className="text-lg font-bold text-slate-900">Autopilot is {s.autopilot ? 'ON' : 'OFF'}</p>
              <p className="text-sm text-slate-500">{s.autopilot ? 'The AI writes, checks, fixes and publishes tests every hour. You only spot-check.' : 'Turn on to let the AI build and maintain mock tests for every exam.'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={run} disabled={!!st.running} className="btn-ghost">{st.running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}{st.running ? `Running since ${timeAgo(st.running)}` : 'Run now'}</button>
            <button onClick={() => save({ autopilot: !s.autopilot })} disabled={saving} className={s.autopilot ? 'btn-ghost text-rose-600' : 'btn-primary bg-emerald-600'}>{s.autopilot ? 'Turn off' : 'Turn on autopilot'}</button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <label className="text-sm"><span className="label">Questions per topic</span><input type="number" className="input" value={s.target_per_topic} onChange={(e) => setS({ ...s, target_per_topic: Number(e.target.value) })} onBlur={() => save({})} /></label>
          <label className="text-sm"><span className="label">Daily AI budget (questions)</span><input type="number" className="input" value={s.daily_budget} onChange={(e) => setS({ ...s, daily_budget: Number(e.target.value) })} onBlur={() => save({})} /></label>
          <label className="text-sm"><span className="label">Bank size before going live (× one paper)</span><input type="number" step="0.5" className="input" value={s.min_ready_ratio} onChange={(e) => setS({ ...s, min_ready_ratio: Number(e.target.value) })} onBlur={() => save({})} /></label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={s.auto_publish} onChange={(e) => save({ auto_publish: e.target.checked })} />Publish tests automatically</label>
        </div>
        {msg && <p className="mt-2 text-sm text-slate-500">{msg}</p>}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs text-slate-500">Live tests</p><p className="text-2xl font-extrabold">{live} <span className="text-sm font-medium text-slate-400">/ {banks.length} exams</span></p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Patterns to confirm</p><p className="text-2xl font-extrabold text-amber-600">{toConfirm.length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">AI-approved, not yet spot-checked</p><p className="text-2xl font-extrabold">{unchecked}</p></div>
      </div>

      {spot.length > 0 && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck size={17} className="text-brand-600" />Spot-check (a few minutes a day is enough)</p>
            <button onClick={() => verdict(spot.map((q) => q.id), 'ok')} className="btn-ghost py-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} />All {spot.length} look good</button>
          </div>
          <div className="mt-3 space-y-3">{spot.map((q) => (
            <div key={q.id} className="rounded-xl border border-slate-100 p-3">
              <p className="text-xs text-slate-400">{q.exam_slug} · {q.section}{q.topic ? ` · ${q.topic}` : ''} · {q.ai_review}</p>
              <p className="mt-1 text-sm text-slate-900">{q.stem}</p>
              <p className="mt-1 text-xs text-slate-600">{q.options.map((o: string, i: number) => <span key={i} className={i === q.answer ? 'font-bold text-emerald-700' : ''}>{LETTERS[i]}. {o}{i < q.options.length - 1 ? '   ' : ''}</span>)}</p>
              {q.explanation && <p className="mt-1 text-xs text-slate-500">{q.explanation}</p>}
              <div className="mt-2 flex gap-2"><button onClick={() => verdict([q.id], 'ok')} className="btn-ghost py-1 text-xs text-emerald-700"><CheckCircle2 size={13} />Correct</button>
                <button onClick={() => verdict([q.id], 'bad')} className="btn-ghost py-1 text-xs text-rose-600"><XCircle size={13} />Wrong — remove</button></div>
            </div>))}</div>
        </section>
      )}

      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Exam</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Bank</th><th className="px-4 py-2">Reports</th><th className="px-4 py-2">Tests taken</th><th className="px-4 py-2">Last run</th></tr></thead>
          <tbody>{banks.map((b) => {
            const target = Math.max(Number(b.needed), Number(b.topics) * s.target_per_topic);
            const pct = target ? Math.min(100, Math.round((100 * Number(b.approved)) / target)) : 0;
            return (
              <tr key={b.exam_slug} className="border-t border-slate-100">
                <td className="px-4 py-2"><button onClick={() => onPickExam(b.exam_slug)} className="font-medium text-brand-700 hover:underline">{b.short_name}</button></td>
                <td className="px-4 py-2">{!b.has_pattern ? <span className="chip">No pattern yet</span> : b.is_published ? <span className="chip-green">Live</span> : <span className="chip-amber">Building</span>}
                  {b.has_pattern && !b.pattern_checked && <span className="chip-amber ms-1" title="AI-drafted pattern — confirm it against the official notice"><AlertTriangle size={11} />confirm pattern</span>}
                  {b.has_pattern && !b.autopilot && <span className="chip ms-1">manual</span>}</td>
                <td className="px-4 py-2"><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div><span className="text-xs text-slate-500">{Number(b.approved)} / {target || '—'}</span></div></td>
                <td className="px-4 py-2">{Number(b.open_reports) ? <span className="chip-red">{Number(b.open_reports)}</span> : '—'}</td>
                <td className="px-4 py-2">{Number(b.attempts) || '—'}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{b.last_autopilot_at ? timeAgo(b.last_autopilot_at) : '—'}</td>
              </tr>);
          })}</tbody>
        </table>
      </section>

      <section className="card p-5">
        <p className="flex items-center gap-2 font-bold text-slate-900"><Activity size={17} className="text-brand-600" />What the AI did</p>
        <ul className="mt-3 max-h-96 space-y-1.5 overflow-y-auto text-sm">{(st.log || []).map((l) => (
          <li key={l.id} className="flex gap-2"><span>{ICON[l.action] || '•'}</span><span className="min-w-0 flex-1"><b>{l.exam_slug || 'All'}</b> · {l.detail}</span><span className="shrink-0 text-xs text-slate-400">{timeAgo(l.created_at)}</span></li>))}
          {!st.log?.length && <li className="text-slate-400">Nothing yet — turn on autopilot or press “Run now”.</li>}</ul>
      </section>
    </div>
  );
}
