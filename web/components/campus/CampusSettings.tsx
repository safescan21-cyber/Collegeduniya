'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Loader2, Save, School, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { uploadMedia, mediaUrl } from '@/lib/media';
import CollegePicker from './CollegePicker';
import Verified from './Verified';

const GENDERS = [['female', 'Female'], ['male', 'Male'], ['other', 'Other'], ['prefer_not', 'Prefer not to say']] as const;
const VSTATUS: Record<string, string> = { none: 'Not verified', pending: 'Checking…', verified: 'Verified', rejected: 'Not approved — try again', review: 'With our team (within 24 h)' };

export default function CampusSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const [f, setF] = useState({ gender: '', college_id: null as string | null, course: '', batch_year: '', allow_calls: true, show_last_seen: true, campus_visible: true });
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!profile) return;
    setF({ gender: profile.gender || '', college_id: profile.college_id || null, course: profile.course || '', batch_year: profile.batch_year ? String(profile.batch_year) : '',
      allow_calls: profile.allow_calls ?? true, show_last_seen: profile.show_last_seen ?? true, campus_visible: profile.campus_visible ?? true });
  }, [profile]);
  if (!user || !profile || (user as any).is_anonymous || (profile.account_type && profile.account_type !== 'student')) return null;
  const verified = profile.verification === 'verified';
  const sb = supabaseBrowser();

  const photo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files?.[0]; e.target.value = '';
    if (!fl) return;
    if (verified && !confirm('Changing your photo removes your verified tick until you verify again. Continue?')) return;
    setBusy('photo'); setMsg('');
    try { const m = await uploadMedia(user.id, fl); await sb.from('profiles').update({ avatar_url: mediaUrl(m.path) }).eq('id', user.id); await refreshProfile(); }
    catch (er: any) { setMsg(er.message); }
    setBusy('');
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg('');
    if (verified && f.gender !== (profile.gender || '') && !confirm('Changing gender removes your verified tick. Continue?')) return;
    const by = f.batch_year ? Number(f.batch_year) : null;
    if (by !== null && (by < 1980 || by > 2100)) return setMsg('Enter the year you pass out, e.g. 2027');
    setBusy('save');
    const { error } = await sb.from('profiles').update({ gender: f.gender || null, college_id: f.college_id, course: f.course.trim() || null, batch_year: by,
      allow_calls: f.allow_calls, show_last_seen: f.show_last_seen, campus_visible: f.campus_visible }).eq('id', user.id);
    setBusy(''); setMsg(error ? error.message : 'Saved'); if (!error) refreshProfile();
  };
  return (
    <form onSubmit={save} className="card space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><School size={18} className="text-brand-600" />My college & chat</h2>
        <span className={`chip ${verified ? 'chip-green' : ''}`}><Verified on={verified} size={13} />{VSTATUS[profile.verification || 'none']}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-2xl font-bold text-slate-400">{(profile.full_name || '?')[0]}</span>}
        </div>
        <div className="text-sm">
          <button type="button" onClick={() => file.current?.click()} disabled={!!busy} className="btn-ghost py-1.5 text-sm">{busy === 'photo' ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}{profile.avatar_url ? 'Change photo' : 'Add profile photo'}</button>
          <p className="mt-1 text-xs text-slate-500">A clear photo of your face — needed for the verified tick.</p>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={photo} />
        </div>
      </div>
      <div><label className="label">College you study in</label><CollegePicker value={f.college_id} onChange={(id) => setF({ ...f, college_id: id })} />
        <p className="mt-1 text-xs text-slate-500">You can chat with students of this college.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Course</label><input className="input" value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })} placeholder="B.Tech CSE" maxLength={120} /></div>
        <div><label className="label">Passing-out year</label><input className="input" inputMode="numeric" value={f.batch_year} onChange={(e) => setF({ ...f, batch_year: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="2027" /></div>
      </div>
      <div><label className="label">Gender (private — never shown on your profile)</label>
        <select className="input" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">Choose…</option>{GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <p className="mt-1 text-xs text-slate-500">Students must send girls a chat request first; verified girls can message anyone in their college directly.</p></div>
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.allow_calls} onChange={(e) => setF({ ...f, allow_calls: e.target.checked })} />Allow voice & video calls from accepted chats</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.show_last_seen} onChange={(e) => setF({ ...f, show_last_seen: e.target.checked })} />Show my last seen</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.campus_visible} onChange={(e) => setF({ ...f, campus_visible: e.target.checked })} />Show me in “People from your college”</label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={!!busy} className="btn-primary">{busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save</button>
        {!verified && <Link href="/verify" className="btn-ghost"><ShieldCheck size={16} />Get verified</Link>}
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </form>
  );
}
