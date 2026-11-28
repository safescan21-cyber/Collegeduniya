'use client';
import { useEffect, useState } from 'react';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

// Connect the email account that sends login codes, password resets and site emails (super admin only)
export default function EmailSetup() {
  const [st, setSt] = useState<{ enabled: boolean; from: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('safescan21@gmail.com');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok?: boolean; steps?: string[]; error?: string } | null>(null);
  const load = () => api('/api/admin/email/status').then(setSt).catch(() => undefined);
  useEffect(() => { load(); }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setRes(null);
    try { const r = await api('/api/admin/email/setup', { method: 'POST', body: JSON.stringify({ email, password: pass }) }); setRes(r); setPass(''); setOpen(false); load(); }
    catch (e2: any) { setRes({ error: e2.message }); }
    setBusy(false);
  };
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold text-slate-900"><Mail size={17} className="text-brand-600" />Email for login codes</p>
        {st && (st.enabled ? <span className="chip-green"><CheckCircle2 size={12} />Connected{st.from ? ` · ${st.from.replace(/^.*</, '').replace(/>$/, '')}` : ''}</span> : <span className="chip-amber">Not connected — email codes and password resets don’t arrive</span>)}
      </div>
      <p className="mt-1 text-sm text-slate-500">Connect a Gmail account to send login codes, sign-up codes, password resets and alerts. Gmail needs an <b>App Password</b>, not your normal password: turn on 2-Step Verification, then create one at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" className="text-brand-700 underline">myaccount.google.com/apppasswords</a> (name it “Collegeolo”) and paste the 16 letters here. Gmail sends up to about 500 emails a day.</p>
      {!open ? <button className="btn-primary mt-3" onClick={() => { setOpen(true); setRes(null); }}><Mail size={16} />{st?.enabled ? 'Change email account' : 'Connect Gmail'}</button> : (
        <form onSubmit={save} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="Gmail address" />
          <input type="password" required autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} className="input" placeholder="16-letter App Password" />
          <button className="btn-primary" disabled={busy || pass.replace(/\s/g, '').length < 8}>{busy ? <Loader2 size={16} className="animate-spin" /> : null}{busy ? 'Connecting… (up to a minute)' : 'Save & send test'}</button>
        </form>
      )}
      {res?.error && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{res.error}</p>}
      {res?.steps && <ul className="mt-3 list-disc space-y-0.5 rounded-lg bg-emerald-50 p-3 ps-7 text-sm text-emerald-800">{res.steps.map((s) => <li key={s}>{s}</li>)}<li>Try it: log out and sign in with “Email code”.</li></ul>}
    </section>
  );
}
