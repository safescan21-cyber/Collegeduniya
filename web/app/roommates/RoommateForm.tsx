'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import CityInput from '@/components/CityInput';

export default function RoommateForm() {
  const { user } = useAuth();
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<any[]>([]);
  const [f, setF] = useState<any>({ looking_for: 'room', city: '', country: '', budget_min: '', budget_max: '', currency: 'INR', move_in: '', gender: 'Any', about: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('roommate_posts').select('id, city, is_active, expires_at').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }: any) => setMine(data || []));
  }, [user, supabase]);

  if (!user) return <div className="card flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm text-slate-600">Looking for a roommate or a room?</p><Link href="/login?next=/roommates" className="btn-primary py-1.5"><PlusCircle size={14} />Post (free)</Link></div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!f.city) return setErr('Choose a city.');
    if (f.about.trim().length < 20) return setErr('Write at least a couple of lines about yourself and what you want.');
    setBusy(true);
    const n = (v: string) => (v === '' ? null : Number(v));
    const { error } = await supabase.from('roommate_posts').insert({ user_id: user.id, looking_for: f.looking_for, city: f.city, country: f.country || null,
      budget_min: n(f.budget_min), budget_max: n(f.budget_max), currency: f.currency, move_in: f.move_in || null, gender: f.gender, about: f.about.trim() });
    setBusy(false);
    if (error) return setErr(error.message);
    setOpen(false); router.refresh();
  };
  const close = async (id: string) => { await supabase.from('roommate_posts').update({ is_active: false }).eq('id', id); setMine((m) => m.map((x) => (x.id === id ? { ...x, is_active: false } : x))); router.refresh(); };

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-sm">
          {mine.filter((m) => m.is_active).map((m) => <span key={m.id} className="chip-green">Your post · {m.city} <button onClick={() => close(m.id)} className="ms-1 underline">close</button></span>)}
        </div>
        {!open && <button onClick={() => setOpen(true)} className="btn-primary py-1.5"><PlusCircle size={14} />New post</button>}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2"><span className="label">I…</span>
            <select className="input" value={f.looking_for} onChange={(e) => setF({ ...f, looking_for: e.target.value })}>
              <option value="room">am looking for a room / shared flat</option><option value="roommate">have a place and need a roommate</option><option value="both">want to find a place together</option></select></label>
          <div className="text-sm"><span className="label">City</span><CityInput name="city" defaultValue={f.city} placeholder="City" onPick={(c: any) => setF((p: any) => ({ ...p, city: c.name, country: c.country || '' }))} /></div>
          <label className="text-sm"><span className="label">Roommate gender</span><select className="input" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="Any">Any</option><option>Female</option><option>Male</option></select></label>
          <label className="text-sm"><span className="label">Budget from (per month)</span><input className="input" inputMode="numeric" value={f.budget_min} onChange={(e) => setF({ ...f, budget_min: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="text-sm"><span className="label">Budget up to</span><input className="input" inputMode="numeric" value={f.budget_max} onChange={(e) => setF({ ...f, budget_max: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="text-sm"><span className="label">Move-in</span><input type="date" className="input" value={f.move_in} onChange={(e) => setF({ ...f, move_in: e.target.value })} /></label>
          <label className="text-sm"><span className="label">Currency</span><input className="input" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) })} /></label>
          <label className="text-sm sm:col-span-2"><span className="label">About you & what you want</span><textarea className="input" rows={3} maxLength={1000} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} placeholder="1st-year B.Com at Christ, vegetarian, early riser, looking near Hosur Road…" /></label>
          {err && <p className="text-sm text-rose-600 sm:col-span-2">{err}</p>}
          <div className="flex gap-2 sm:col-span-2"><button className="btn-primary" disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />}Post</button><button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button></div>
          <p className="text-xs text-slate-400 sm:col-span-2">Only your first name is shown. Posts expire after 60 days. Never pay a deposit before seeing the place.</p>
        </form>
      )}
    </div>
  );
}
