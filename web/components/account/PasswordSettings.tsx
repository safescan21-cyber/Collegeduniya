'use client';
import { useState } from 'react';
import { Lock, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

// Set or change the account password (accounts made with an email code have none yet).
export default function PasswordSettings({ title = 'Password', onDone }: { title?: string; onDone?: () => void }) {
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setOk(false);
    if (pw.length < 8) return setErr('Use at least 8 characters.');
    if (pw !== pw2) return setErr('The two passwords do not match.');
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(/same/i.test(error.message) ? 'That is already your password.' : error.message);
    setOk(true); setPw(''); setPw2(''); onDone?.();
  };
  return (
    <form onSubmit={save} className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-bold text-slate-900"><Lock size={18} className="text-brand-600" />{title}</h2>
      <p className="text-sm text-slate-500">Set a password to log in without waiting for a code. You can still use email codes any time.</p>
      <div className="relative">
        <input type={show ? 'text' : 'password'} className="input pr-10" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ characters)" autoComplete="new-password" />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
      </div>
      <input type={show ? 'text' : 'password'} className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Type it again" autoComplete="new-password" />
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {ok && <p className="flex items-center gap-1 text-sm text-emerald-700"><Check size={16} />Password saved. You can now log in with it.</p>}
      <button disabled={busy || !pw} className="btn-primary">{busy && <Loader2 size={16} className="animate-spin" />}Save password</button>
    </form>
  );
}
