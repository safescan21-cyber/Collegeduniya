'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellRing, Loader2, Trash2, Plus, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

type Alert = {
  id?: string; city: string | null; country: string | null; job_type: string | null; keywords: string | null; remote_ok: boolean;
  channel: 'email' | 'whatsapp'; whatsapp: string | null; frequency: 'daily' | 'weekly'; is_active?: boolean; last_sent_at?: string | null;
};
const TYPES = ['Part-time', 'Internship', 'Weekend', 'Freelance', 'Full-time'];
const empty: Alert = { city: '', country: '', job_type: '', keywords: '', remote_ok: true, channel: 'email', whatsapp: '', frequency: 'daily' };
const clean = (a: Alert) => ({
  city: a.city?.trim() || null, country: a.country?.trim() || null, job_type: a.job_type || null, keywords: a.keywords?.trim() || null,
  remote_ok: a.remote_ok, channel: a.channel, whatsapp: a.channel === 'whatsapp' ? a.whatsapp?.trim() || null : null, frequency: a.frequency,
});
const describe = (a: Alert) => [a.keywords && `“${a.keywords}”`, a.job_type, a.city || a.country, a.remote_ok && 'remote OK'].filter(Boolean).join(' · ') || 'All new jobs';

// "Email me jobs like these" — on the /jobs list, prefilled from the current filters
export function CreateAlertButton({ preset }: { preset: Partial<Alert> }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const supabase = supabaseBrowser();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'err'>('idle');
  if (!user) return <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-ghost w-full"><BellRing size={16} />Get job alerts</Link>;
  if (state === 'done') return <Link href="/dashboard?tab=alerts" className="btn-ghost w-full text-emerald-700"><CheckCircle2 size={16} />Alert saved — manage</Link>;
  const save = async () => {
    setState('busy');
    const { error } = await supabase.from('job_alerts').insert({ ...clean({ ...empty, ...preset }), user_id: user.id });
    setState(error ? 'err' : 'done');
  };
  return (
    <button type="button" onClick={save} disabled={state === 'busy'} className="btn-ghost w-full">
      {state === 'busy' ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}{state === 'err' ? 'Try again' : 'Email me new jobs like these'}
    </button>
  );
}

// Dashboard → Job alerts
export function JobAlertManager() {
  const { user, profile } = useAuth();
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<Alert[]>([]);
  const [form, setForm] = useState<Alert | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('job_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setRows((data || []) as Alert[]);
  }, [user, supabase]);
  useEffect(() => { load(); }, [load]);
  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErr('');
    if (form.channel === 'whatsapp' && !/^\+?\d[\d\s-]{7,16}$/.test(form.whatsapp || '')) return setErr('Enter your WhatsApp number with country code, e.g. +91 98765 43210');
    if (rows.length >= 10 && !form.id) return setErr('You can keep up to 10 alerts.');
    const row = clean(form);
    const { error } = form.id ? await supabase.from('job_alerts').update(row).eq('id', form.id) : await supabase.from('job_alerts').insert({ ...row, user_id: user.id });
    if (error) return setErr(error.message);
    setForm(null); load();
  };
  const toggle = async (a: Alert) => { await supabase.from('job_alerts').update({ is_active: !a.is_active }).eq('id', a.id!); load(); };
  const remove = async (a: Alert) => { if (confirm('Delete this alert?')) { await supabase.from('job_alerts').delete().eq('id', a.id!); load(); } };
  const set = (k: keyof Alert, v: any) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">We send new matching jobs by email{' '}(or WhatsApp) — daily or weekly. Stop any time.</p>
        {!form && <button onClick={() => setForm({ ...empty, city: profile?.city || '' })} className="btn-primary"><Plus size={16} />New alert</button>}
      </div>
      {form && (
        <form onSubmit={save} className="card grid gap-3 p-5 sm:grid-cols-2">
          <div><label className="label">Keywords</label><input className="input" value={form.keywords || ''} onChange={(e) => set('keywords', e.target.value)} placeholder="tutor, content writer, data entry" /></div>
          <div><label className="label">Job type</label><select className="input" value={form.job_type || ''} onChange={(e) => set('job_type', e.target.value)}><option value="">Any</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label className="label">City</label><input className="input" value={form.city || ''} onChange={(e) => set('city', e.target.value)} placeholder="Pune" /></div>
          <div><label className="label">Country</label><input className="input" value={form.country || ''} onChange={(e) => set('country', e.target.value)} placeholder="India" /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.remote_ok} onChange={(e) => set('remote_ok', e.target.checked)} />Include work-from-home jobs</label>
          <div><label className="label">How often</label><select className="input" value={form.frequency} onChange={(e) => set('frequency', e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
          <div><label className="label">Send by</label><select className="input" value={form.channel} onChange={(e) => set('channel', e.target.value)}><option value="email">Email ({user.email})</option><option value="whatsapp">WhatsApp</option></select></div>
          {form.channel === 'whatsapp' && <div className="sm:col-span-2"><label className="label">WhatsApp number</label><input className="input" value={form.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="+91 98765 43210" />
            <p className="mt-1 text-xs text-slate-500">If WhatsApp can’t be delivered, we email you instead.</p></div>}
          {err && <p className="text-sm text-rose-600 sm:col-span-2">{err}</p>}
          <div className="flex gap-2 sm:col-span-2"><button className="btn-primary">Save alert</button><button type="button" onClick={() => setForm(null)} className="btn-ghost">Cancel</button></div>
        </form>
      )}
      {rows.length ? rows.map((a) => (
        <div key={a.id} className="card flex flex-wrap items-center gap-3 p-4">
          <BellRing size={18} className={a.is_active ? 'text-brand-600' : 'text-slate-300'} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{describe(a)}</p>
            <p className="text-xs text-slate-500">{a.frequency === 'daily' ? 'Daily' : 'Weekly'} · {a.channel === 'whatsapp' ? `WhatsApp ${a.whatsapp}` : 'Email'}{a.last_sent_at ? ` · last checked ${new Date(a.last_sent_at).toLocaleDateString()}` : ''}</p>
          </div>
          <button onClick={() => toggle(a)} className="btn-ghost text-xs">{a.is_active ? 'Pause' : 'Resume'}</button>
          <button onClick={() => setForm(a)} className="btn-ghost text-xs">Edit</button>
          <button onClick={() => remove(a)} className="btn-ghost text-rose-600" aria-label="Delete"><Trash2 size={15} /></button>
        </div>
      )) : !form && <div className="card p-8 text-center text-sm text-slate-500">No alerts yet. Create one, or tap “Email me new jobs like these” on the jobs page.</div>}
    </div>
  );
}
