'use client';
import { useCallback, useEffect, useState } from 'react';
import { Cpu, Loader2, CheckCircle2, XCircle, ExternalLink, List, Clock, KeyRound, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

type P = { id: string; name: string; configured: boolean; model: string | null; key_env: string; signup: string; ok: number; fail: number; last_error: string | null; last_ok: string | null; cooling_down_until: string | null; saved_in_panel?: string | null };

export default function AiProviders() {
  const [rows, setRows] = useState<P[]>([]); const [order, setOrder] = useState<string[]>([]);
  const [test, setTest] = useState<Record<string, any>>({}); const [models, setModels] = useState<Record<string, string[] | string>>({});
  const load = useCallback(() => api('/api/admin/ai/providers').then((r) => { setRows(r.data); setOrder(r.order); }).catch(() => undefined), []);
  useEffect(() => { load(); }, [load]);
  const run = async (id: string) => { setTest((t) => ({ ...t, [id]: 'busy' })); const r = await api(`/api/admin/ai/providers/${id}/test`, { method: 'POST', body: '{}' }).catch((e) => ({ ok: false, error: e.message })); setTest((t) => ({ ...t, [id]: r })); load(); };
  const list = async (id: string) => { setModels((m) => ({ ...m, [id]: 'busy' })); const r = await api(`/api/admin/ai/providers/${id}/models`).catch((e) => ({ data: e.message })); setModels((m) => ({ ...m, [id]: r.data })); };
  const [edit, setEdit] = useState<string | null>(null); const [key, setKey] = useState(''); const [saving, setSaving] = useState(false); const [note, setNote] = useState('');
  const save = async (id: string) => {
    setSaving(true); setNote('');
    try {
      const r = await api(`/api/admin/ai/providers/${id}/key`, { method: 'POST', body: JSON.stringify({ key }) });
      setTest((t) => ({ ...t, [id]: r.test }));
      setNote(r.test?.ok ? `Saved and working.${r.autopilot ? ' Mock-test Autopilot is on and writing the first questions now.' : ''}` : `Saved, but the test failed: ${r.test?.error || 'unknown error'}. Check that you copied the whole key.`);
      setEdit(null); setKey(''); load();
    } catch (e: any) { setNote(e.message); }
    setSaving(false);
  };
  const remove = async (id: string) => { if (!confirm('Remove this key?')) return; await api(`/api/admin/ai/providers/${id}/key`, { method: 'DELETE' }).catch((e) => setNote(e.message)); load(); };
  const keyForm = (id: string) => (
    <form onSubmit={(e) => { e.preventDefault(); save(id); }} className="mt-2 flex flex-wrap gap-2">
      <input type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} className="input min-w-0 flex-1 py-1.5" placeholder="Paste the API key" autoFocus />
      <button className="btn-primary py-1.5" disabled={saving || key.trim().length < 16}>{saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}Save &amp; test</button>
      <button type="button" className="btn-ghost py-1.5" onClick={() => { setEdit(null); setKey(''); }}>Cancel</button>
    </form>
  );
  const on = rows.filter((r) => r.configured);
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold text-slate-900"><Cpu size={17} className="text-brand-600" />AI providers <span className="text-sm font-normal text-slate-500">— {on.length} connected</span></p>
        {order.length > 0 && <p className="text-xs text-slate-500">Order: {order.join(' → ')} · the double-check uses a different provider from the writer</p>}
      </div>
      <p className="mt-1 text-xs text-slate-500">Paste a key with <b>Add key</b> (super admin only — saved on your server, never shown again), or put it in <code>server/.env</code>. Add every free service you sign up for: when one hits its limit, the next takes over automatically.</p>
      {on.length === 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p><b>No AI connected — mock tests can’t be written yet.</b> Get a free Google Gemini key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline">aistudio.google.com/apikey</a> (starts with <code>AIza</code>) and paste it here:</p>
          {edit === 'gemini' ? keyForm('gemini') : <button className="btn-primary mt-2 py-1.5" onClick={() => { setEdit('gemini'); setKey(''); }}><KeyRound size={14} />Add Gemini key</button>}
        </div>
      )}
      {note && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">{note}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 pe-3">Provider</th><th className="pe-3">Model</th><th className="pe-3">Calls</th><th className="pe-3">Status</th><th /></tr></thead>
          <tbody>{rows.map((p) => {
            const t = test[p.id]; const m = models[p.id];
            return (
              <tr key={p.id} className="border-t border-slate-100 align-top">
                <td className="py-2 pe-3"><p className="font-medium">{p.name}{p.saved_in_panel ? <span className="ms-1 text-[10px] font-normal text-slate-400">(key saved in panel)</span> : null}</p><p className="text-xs text-slate-400"><code>{p.key_env}</code>{p.signup && <> · <a href={p.signup} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 text-brand-700 underline">get key<ExternalLink size={10} /></a></>}</p></td>
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
                <td className="py-2 text-right">{!['ollama', 'custom'].includes(p.id) && <div className="mb-1 flex justify-end gap-1">
                  <button onClick={() => { setEdit(edit === p.id ? null : p.id); setKey(''); }} className="btn-ghost px-2 py-1 text-xs"><KeyRound size={13} />{p.configured ? 'Change key' : 'Add key'}</button>
                  {p.saved_in_panel && <button onClick={() => remove(p.id)} className="btn-ghost px-2 py-1 text-xs" title="Remove key"><Trash2 size={13} /></button>}</div>}
                  {edit === p.id && keyForm(p.id)}
                  {p.configured && <div className="flex justify-end gap-1">
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
