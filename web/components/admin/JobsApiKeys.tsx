'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

// Paste job-search API keys here instead of editing server/.env. Super admin only; the server tests the key with one
// real search and keeps it only if it works. Keys are stored server-side (app_secrets) and never shown again.
export default function JobsApiKeys() {
  const [st, setSt] = useState<any>(null);
  const [jooble, setJooble] = useState(''); const [adzId, setAdzId] = useState(''); const [adzKey, setAdzKey] = useState('');
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState<Record<string, string>>({});
  const load = () => api('/api/admin/integrations/jobs-keys').then(setSt).catch(() => setSt({ status: {}, saved: {} }));
  useEffect(() => { load(); }, []);

  const save = async (provider: 'jooble' | 'adzuna') => {
    setBusy(provider); setMsg((m) => ({ ...m, [provider]: '' }));
    try {
      const r = await api('/api/admin/integrations/jobs-keys', { method: 'POST', body: JSON.stringify(provider === 'jooble' ? { provider, key: jooble } : { provider, app_id: adzId, key: adzKey }) });
      setMsg((m) => ({ ...m, [provider]: r.ok ? `Working ✓ — test search found ${r.test.sample} job${r.test.sample === 1 ? '' : 's'} in Delhi` : `Not saved — the key didn't work: ${r.test?.error || 'no answer'}` }));
      if (r.ok) { setJooble(''); setAdzId(''); setAdzKey(''); }
    } catch (e: any) { setMsg((m) => ({ ...m, [provider]: e.message })); }
    setBusy(''); load();
  };
  const remove = async (provider: string) => { if (!confirm('Remove this key?')) return; await api(`/api/admin/integrations/jobs-keys/${provider}`, { method: 'DELETE' }); load(); };

  // a plain function (not a component) so typing doesn't remount the inputs and drop focus
  const row = ({ id, name, on, children, onSave, canSave }: { id: string; name: string; on: boolean; children: React.ReactNode; onSave: () => void; canSave: boolean }) => (
    <div className="rounded-xl border border-slate-100 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">{on ? <CheckCircle2 size={15} className="text-emerald-600" /> : <KeyRound size={15} className="text-slate-400" />}{name}
        {on && <span className="text-xs font-normal text-emerald-700">connected</span>}
        {on && <button onClick={() => remove(id)} className="ms-auto text-slate-400 hover:text-rose-600" aria-label={`Remove ${name} key`}><Trash2 size={14} /></button>}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}
        <button onClick={onSave} disabled={!canSave || !!busy} className="btn-primary py-1.5 text-sm">{busy === id ? <Loader2 size={14} className="animate-spin" /> : null}{on ? 'Replace & test' : 'Save & test'}</button></div>
      {msg[id] && <p className={`mt-1.5 text-xs ${msg[id].startsWith('Working') ? 'text-emerald-700' : 'text-rose-600'}`}>{msg[id]}</p>}
    </div>
  );
  const input = 'input flex-1 py-1.5 text-sm min-w-[12rem]';
  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-bold text-slate-900"><KeyRound size={17} className="text-brand-600" />Job search keys</h2>
      <p className="mt-1 text-xs text-slate-500">Local jobs near colleges come from these services. Paste the key — it’s tested with one search and kept only if it works. Saved keys are never shown again.</p>
      {!st ? <Loader2 className="mt-3 animate-spin text-slate-300" /> : (
        <div className="mt-3 space-y-3">
          {row({ id: 'jooble', name: 'Jooble (60+ countries)', on: !!st.status?.jooble, onSave: () => save('jooble'), canSave: jooble.trim().length >= 16,
            children: <input type="password" autoComplete="off" spellCheck={false} value={jooble} onChange={(e) => setJooble(e.target.value)} className={input} placeholder="Jooble API key" aria-label="Jooble API key" /> })}
          {row({ id: 'adzuna', name: 'Adzuna (19 countries incl. India)', on: !!st.status?.adzuna, onSave: () => save('adzuna'), canSave: adzId.trim().length >= 6 && adzKey.trim().length >= 16,
            children: <>
              <input autoComplete="off" spellCheck={false} value={adzId} onChange={(e) => setAdzId(e.target.value)} className={input} placeholder="Adzuna app ID" aria-label="Adzuna app ID" />
              <input type="password" autoComplete="off" spellCheck={false} value={adzKey} onChange={(e) => setAdzKey(e.target.value)} className={input} placeholder="Adzuna app key" aria-label="Adzuna app key" />
            </> })}
          <p className="text-[11px] text-slate-400">Free keys: jooble.org/api/about · developer.adzuna.com. Only a super admin can save keys.</p>
        </div>)}
    </div>
  );
}
