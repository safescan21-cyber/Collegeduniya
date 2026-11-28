'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';

const TOPICS = [['general', 'General question'], ['correction', 'Correct college / listing information'], ['grievance', 'Complaint / grievance'],
  ['privacy', 'Privacy request (see, correct or delete my data)'], ['partnership', 'College or business partnership'], ['press', 'Press']] as const;

export default function ContactForm() {
  const sp = useSearchParams();
  const { user, profile } = useAuth();
  const t0 = sp.get('topic');
  const [f, setF] = useState({ topic: TOPICS.some(([k]) => k === t0) ? t0! : 'general', about: sp.get('about') || '', full_name: '', email: '', phone: '', message: '', website: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState<string | null>(null);
  const name = f.full_name || profile?.full_name || ''; const email = f.email || user?.email || '';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const r = await api<{ ref: string }>('/api/contact', { method: 'POST', body: JSON.stringify({ ...f, full_name: name, email, page: typeof document !== 'undefined' ? document.referrer.slice(0, 300) : null }) }); setDone(r.ref); }
    catch (er: any) { setErr(er.message); }
    setBusy(false);
  };
  if (done) return <div className="card flex items-start gap-3 p-5 not-prose"><CheckCircle2 className="shrink-0 text-emerald-600" /><div><p className="font-semibold text-slate-900">Thanks — we’ve got your message.</p><p className="text-sm text-slate-600">Reference <b>{done}</b>. We reply by email{f.topic === 'grievance' ? ' and acknowledge complaints within 24 hours' : ''}.</p></div></div>;
  return (
    <form onSubmit={submit} className="card grid gap-3 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="label">What is it about?</label>
        <select className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>{TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      {(f.topic === 'correction' || f.about) && <div className="sm:col-span-2"><label className="label">Which college, PG or page?</label><input className="input" maxLength={200} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} placeholder="Name or link" /></div>}
      <div><label className="label">Your name</label><input className="input" required minLength={2} maxLength={100} value={name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
      <div><label className="label">Email</label><input className="input" type="email" required value={email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div className="sm:col-span-2"><label className="label">Phone (optional)</label><input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div className="sm:col-span-2"><label className="label">Message</label><textarea className="input" rows={5} required minLength={10} maxLength={5000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })}
        placeholder={f.topic === 'correction' ? 'What is wrong, what it should say, and a link to the official source if you have one.' : ''} /></div>
      <input type="text" name="website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="flex items-center gap-3 sm:col-span-2"><button disabled={busy} className="btn-primary">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Send</button>{err && <span className="text-sm text-rose-600">{err}</span>}</div>
    </form>
  );
}
