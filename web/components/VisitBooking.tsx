'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Loader2, CheckCircle2, Video } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { api } from '@/lib/api';

const today = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);

export default function VisitBooking({ hostelId, hostelName, slots }: { hostelId: string; hostelName: string; slots: string[] }) {
  const { user, profile } = useAuth();
  const supabase = supabaseBrowser();
  const [f, setF] = useState({ visit_date: today(), slot: slots[0] || '', mode: 'in_person', name: '', phone: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  if (!user) return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-bold text-slate-900"><CalendarCheck size={18} className="text-brand-600" />Book a visit</p>
      <p className="mt-1 text-sm text-slate-500">See the room in person or on a video call before you pay anything.</p>
      <Link href={`/login?next=/hostels/${hostelId}`} className="btn-primary mt-3 w-full">Login to book a visit</Link>
    </div>
  );
  if (done) return <div className="card p-5 text-center"><CheckCircle2 className="mx-auto text-emerald-600" /><p className="mt-2 font-semibold">Visit requested</p><p className="text-sm text-slate-500">The owner will confirm. Track it in your dashboard.</p></div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const row = { hostel_id: hostelId, user_id: user.id, visit_date: f.visit_date, slot: f.slot || null, mode: f.mode,
      name: (f.name || profile?.full_name || '').trim(), phone: (f.phone || profile?.phone || '').trim(), note: f.note.trim() || null };
    if (!row.name || !/^[+\d][\d\s-]{6,18}$/.test(row.phone)) { setBusy(false); return setErr('Add your name and a valid phone number.'); }
    const { data, error } = await supabase.from('hostel_visits').insert(row).select('id').single();
    setBusy(false);
    if (error) return setErr(error.message);
    api('/api/notify/visit', { method: 'POST', body: JSON.stringify({ visit_id: data.id }) }).catch(() => {});
    setDone(true);
  };
  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <p className="flex items-center gap-2 font-bold text-slate-900"><CalendarCheck size={18} className="text-brand-600" />Book a visit — {hostelName}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm"><span className="label">Date</span><input type="date" min={today()} className="input" value={f.visit_date} onChange={(e) => setF({ ...f, visit_date: e.target.value })} required /></label>
        <label className="text-sm"><span className="label">Time</span>
          {slots.length ? <select className="input" value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })}>{slots.map((s) => <option key={s}>{s}</option>)}</select>
            : <input className="input" placeholder="e.g. 5–7 pm" value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })} />}</label>
      </div>
      <div className="flex gap-2 text-sm">
        {[['in_person', 'In person'], ['video_call', 'Video call']].map(([k, l]) => (
          <button type="button" key={k} onClick={() => setF({ ...f, mode: k })} className={f.mode === k ? 'chip-brand cursor-pointer py-1.5' : 'chip cursor-pointer py-1.5'}>{k === 'video_call' && <Video size={12} />}{l}</button>
        ))}
      </div>
      <input className="input" placeholder={profile?.full_name || 'Your name'} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className="input" inputMode="tel" placeholder={profile?.phone || 'Phone / WhatsApp'} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <textarea className="input" rows={2} placeholder="Room type you want, move-in month…" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Request visit</button>
      <p className="text-xs text-slate-400">Never pay a token amount before you have seen the room.</p>
    </form>
  );
}
