'use client';
import { useState } from 'react';
import { Mail, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useLang } from './LangProvider';

export default function NewsletterForm() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('busy'); setErr('');
    try {
      await api('/api/newsletter', { method: 'POST', body: JSON.stringify({ email, website: hp, source: 'footer' }) });
      setState('done');
    } catch (e: any) { setErr(e.message); setState('idle'); }
  };

  if (state === 'done') return <p className="flex items-center gap-2 font-semibold text-emerald-300"><CheckCircle2 size={18} />{t('footer.subscribed')}</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
          className="w-full rounded-xl border-0 bg-white py-3 pl-9 pr-3 text-sm text-slate-800 outline-none" />
        <input tabIndex={-1} autoComplete="off" className="hidden" value={hp} onChange={(e) => setHp(e.target.value)} aria-hidden />
      </div>
      <button disabled={state === 'busy'} className="btn-accent">{t('footer.subscribe')}</button>
      {err && <p className="text-sm text-rose-300">{err}</p>}
    </form>
  );
}
