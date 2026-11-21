'use client';
import { useEffect, useState } from 'react';
import { Loader2, Play, Sparkles, MessageSquareHeart } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

type S = { enabled: boolean; every_hours: number; batch: number; running: boolean; last: any; waiting: number; with_photos: number; total: number;
  invites: { enabled: boolean; last: any }; invites_sent: number };

export default function AutofillCard() {
  const [s, setS] = useState<S | null>(null); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const load = () => api<S>('/api/admin/autofill/status').then(setS).catch((e) => setMsg(e.message));
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);
  const run = async (what: 'autofill' | 'invites') => {
    setBusy(what); setMsg('');
    try { const r = await api<any>(what === 'autofill' ? '/api/admin/autofill/run' : '/api/admin/review-invites/run', { method: 'POST' });
      setMsg(what === 'autofill' ? r.message : `Invited ${r.invited ?? 0}, reminded ${r.reminded ?? 0}`); load(); }
    catch (e: any) { setMsg(e.message); }
    setBusy('');
  };
  return (
    <div className="card grid gap-5 p-5 lg:grid-cols-2">
      <div>
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><Sparkles size={18} className="text-brand-600" />Automatic photos & details</h2>
        <p className="mt-1 text-sm text-slate-500">Every {s?.every_hours ?? 6} hours (and right after each import) the next {s?.batch ?? 300} new colleges get Wikipedia text, logo, campus photos with credit, website, founding year and location — free, from Wikidata and Wikimedia Commons.</p>
        {!s ? <Loader2 className="mt-3 animate-spin text-slate-300" /> : (
          <ul className="mt-3 space-y-1 text-sm">
            <li>Status: <b className={s.enabled ? 'text-emerald-700' : 'text-rose-600'}>{s.enabled ? (s.running ? 'working now…' : 'on') : 'off (AUTOFILL=off)'}</b></li>
            <li>Colleges with photos: <b>{s.with_photos.toLocaleString('en-IN')}</b> of {s.total.toLocaleString('en-IN')} · still to check: <b>{s.waiting.toLocaleString('en-IN')}</b></li>
            {s.last && <li className="text-slate-500">Last run {timeAgo(s.last.at)}: {s.last.error ? <span className="text-rose-600">{s.last.error}</span> : `${s.last.checked ?? 0} checked, ${s.last.matched ?? 0} filled`}</li>}
          </ul>)}
        <button onClick={() => run('autofill')} disabled={!!busy || s?.running} className="btn-primary mt-3">{busy === 'autofill' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}Run now</button>
      </div>
      <div>
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><MessageSquareHeart size={18} className="text-brand-600" />Automatic review invitations</h2>
        <p className="mt-1 text-sm text-slate-500">Once a day, students who added their college a week ago get a request to review it (in the app, plus WhatsApp or email), and one reminder after 30 days. Reviews are written only by real students — never generated.</p>
        {s && <ul className="mt-3 space-y-1 text-sm">
          <li>Status: <b className={s.invites.enabled ? 'text-emerald-700' : 'text-rose-600'}>{s.invites.enabled ? 'on' : 'off (REVIEW_INVITES=off)'}</b></li>
          <li>Invitations sent so far: <b>{s.invites_sent.toLocaleString('en-IN')}</b></li>
          {s.invites.last && <li className="text-slate-500">Last run {timeAgo(s.invites.last.at)}: {s.invites.last.error || `${s.invites.last.invited ?? 0} invited, ${s.invites.last.reminded ?? 0} reminded`}</li>}
        </ul>}
        <button onClick={() => run('invites')} disabled={!!busy} className="btn-ghost mt-3">{busy === 'invites' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}Send due invitations now</button>
      </div>
      {msg && <p className="text-sm text-slate-600 lg:col-span-2">{msg}</p>}
    </div>
  );
}
