'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FilePlus2, X, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useList, removeItem, clearList, toggleItem } from '@/lib/localList';

type Partner = { id: string; slug: string; name: string; city: string; country: string; application_note: string | null };
type Course = { college_id: string; name: string; level: string };

export default function ApplyClient() {
  const { user, profile, loading } = useAuth();
  const supabase = supabaseBrowser();
  const cart = useList('apply');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [f, setF] = useState<any>({ full_name: '', email: '', phone: '', dob: '', gender: '', city: '', state: '', country: 'India',
    qualification: '12th', board_or_university: '', percentage: '', passing_year: '', entrance_exam: '', entrance_score: '', statement: '' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('colleges_public').select('id, slug, name, city, country, application_note').eq('is_published', true).eq('accepts_applications', true).order('name').limit(200)
      .then(({ data }: { data: Partner[] | null }) => setPartners(data || []));
  }, [supabase]);

  const cartIds = useMemo(() => cart.map((c) => c.id).join(','), [cart]);
  useEffect(() => {
    if (!cartIds) { setCourses([]); return; }
    supabase.from('courses').select('college_id, name, level').in('college_id', cartIds.split(',')).order('name')
      .then(({ data }: { data: Course[] | null }) => setCourses(data || []));
  }, [cartIds, supabase]);

  useEffect(() => {
    if (profile || user) setF((p: any) => ({ ...p, full_name: p.full_name || profile?.full_name || '', email: p.email || user?.email || '',
      phone: p.phone || profile?.phone || '', city: p.city || profile?.city || '', country: p.country || profile?.country || 'India' }));
  }, [profile, user]);

  const validCart = cart.filter((c) => partners.some((p) => p.id === c.id));
  const notPartner = partners.length ? cart.filter((c) => !partners.some((p) => p.id === c.id)) : [];

  if (done !== null) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={44} />
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Application sent to {done} college{done > 1 ? 's' : ''}</h1>
        <p className="mt-2 text-slate-500">We review your application and forward it to each college. Track status in your dashboard — we’ll also call you if anything is missing.</p>
        <Link href="/dashboard?tab=colleges" className="btn-primary mt-5">Track applications</Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErr('');
    if (!validCart.length) return setErr('Add at least one partner college.');
    const missing = validCart.find((c) => !choice[c.id]);
    if (missing) return setErr(`Choose a course for ${missing.name}.`);
    if (!/^[+\d][\d\s-]{6,}$/.test(f.phone)) return setErr('Enter a valid phone number.');
    if (!agree) return setErr('Please confirm the declaration.');
    setBusy(true);
    const batch_id = crypto.randomUUID();
    const num = (v: string) => (v === '' ? null : Number(v));
    const rows = validCart.map((c) => ({
      batch_id, user_id: user.id, college_id: c.id, course: choice[c.id],
      full_name: f.full_name.trim(), email: f.email.trim(), phone: f.phone.trim(), dob: f.dob || null, gender: f.gender || null,
      city: f.city || null, state: f.state || null, country: f.country || null, qualification: f.qualification || null,
      board_or_university: f.board_or_university || null, percentage: num(f.percentage), passing_year: num(f.passing_year),
      entrance_exam: f.entrance_exam || null, entrance_score: f.entrance_score || null, statement: f.statement || null,
    }));
    const { error } = await supabase.from('college_applications').insert(rows);
    setBusy(false);
    if (error) return setErr(error.message.includes('duplicate') ? 'You already applied to one of these colleges for the same course.' : error.message);
    if (!profile?.phone) await supabase.from('profiles').update({ phone: f.phone, full_name: profile?.full_name || f.full_name }).eq('id', user.id);
    clearList('apply');
    setDone(rows.length);
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><FilePlus2 className="text-brand-600" />One application, many colleges</h1>
        <p className="mt-1 text-slate-500">Fill this form once and send it to every partner college you choose. No extra charge from StudyEarnstay.</p>

        <div className="card mt-6 p-5">
          <p className="font-semibold text-slate-900">Your colleges ({validCart.length})</p>
          {validCart.length === 0 && <p className="mt-1 text-sm text-slate-500">Add colleges from the list on the right (or use “Add to my application” on a college page).</p>}
          <ul className="mt-3 space-y-3">
            {validCart.map((c) => {
              const list = courses.filter((x) => x.college_id === c.id);
              return (
                <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1"><Link href={`/colleges/${c.slug}`} className="font-medium text-slate-900 hover:text-brand-700">{c.name}</Link><p className="text-xs text-slate-500">{c.city}</p></div>
                  {list.length ? (
                    <select className="input sm:w-64" value={choice[c.id] || ''} onChange={(e) => setChoice({ ...choice, [c.id]: e.target.value })}>
                      <option value="">Choose course *</option>{list.map((x) => <option key={x.name} value={x.name}>{x.name} ({x.level})</option>)}
                    </select>
                  ) : (
                    <input className="input sm:w-64" placeholder="Course you want *" value={choice[c.id] || ''} onChange={(e) => setChoice({ ...choice, [c.id]: e.target.value })} />
                  )}
                  <button onClick={() => removeItem('apply', c.id)} className="btn-ghost px-2" aria-label="Remove"><X size={16} /></button>
                </li>
              );
            })}
          </ul>
          {notPartner.length > 0 && <p className="mt-3 text-xs text-amber-700">{notPartner.map((c) => c.name).join(', ')} {notPartner.length > 1 ? 'are' : 'is'} not accepting applications through us right now.</p>}
        </div>

        {loading ? <div className="card mt-6 h-64 animate-pulse" /> : !user ? (
          <div className="card mt-6 flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-slate-700">Create a free account to fill the application — your details are saved for next time.</p>
            <div className="flex gap-2"><Link href="/login?mode=register&next=/apply" className="btn-primary">Register</Link><Link href="/login?next=/apply" className="btn-ghost">Login</Link></div>
          </div>
        ) : (
          <form onSubmit={submit} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
            <p className="font-semibold text-slate-900 sm:col-span-2">Personal details</p>
            <div className="sm:col-span-2"><label className="label">Full name (as on marksheet) *</label><input required className="input" value={f.full_name} onChange={set('full_name')} /></div>
            <div><label className="label">Email *</label><input required type="email" className="input" value={f.email} onChange={set('email')} /></div>
            <div><label className="label">Mobile *</label><input required className="input" value={f.phone} onChange={set('phone')} /></div>
            <div><label className="label">Date of birth</label><input type="date" className="input" value={f.dob} onChange={set('dob')} /></div>
            <div><label className="label">Gender</label><select className="input" value={f.gender} onChange={set('gender')}><option value="">—</option><option>Female</option><option>Male</option><option>Other</option></select></div>
            <div><label className="label">City</label><input className="input" value={f.city} onChange={set('city')} /></div>
            <div><label className="label">State</label><input className="input" value={f.state} onChange={set('state')} /></div>
            <p className="pt-2 font-semibold text-slate-900 sm:col-span-2">Academic details</p>
            <div><label className="label">Highest qualification</label><select className="input" value={f.qualification} onChange={set('qualification')}>{['10th', '12th', 'Diploma', 'Graduation', 'Post-graduation'].map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className="label">Board / university</label><input className="input" value={f.board_or_university} onChange={set('board_or_university')} placeholder="CBSE, State board, DU…" /></div>
            <div><label className="label">Percentage / CGPA</label><input className="input" inputMode="decimal" value={f.percentage} onChange={set('percentage')} /></div>
            <div><label className="label">Passing year</label><input className="input" inputMode="numeric" value={f.passing_year} onChange={set('passing_year')} /></div>
            <div><label className="label">Entrance exam</label><input className="input" value={f.entrance_exam} onChange={set('entrance_exam')} placeholder="CUET, CAT, JEE…" /></div>
            <div><label className="label">Score / rank</label><input className="input" value={f.entrance_score} onChange={set('entrance_score')} /></div>
            <div className="sm:col-span-2"><label className="label">Why this course? (optional)</label><textarea rows={3} maxLength={2000} className="input" value={f.statement} onChange={set('statement')} /></div>
            <label className="flex items-start gap-2 text-sm text-slate-600 sm:col-span-2">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
              I confirm these details are correct and allow StudyEarnstay to share my application with the selected colleges and contact me about it.
            </label>
            {err && <p className="text-sm text-rose-600 sm:col-span-2">{err}</p>}
            <button disabled={busy || !validCart.length} className="btn-primary sm:col-span-2">{busy ? <Loader2 className="animate-spin" size={16} /> : null}Submit to {validCart.length || 0} college{validCart.length === 1 ? '' : 's'}</button>
          </form>
        )}
      </div>

      <aside>
        <div className="card p-5 lg:sticky lg:top-24">
          <p className="font-semibold text-slate-900">Partner colleges ({partners.length})</p>
          {partners.length === 0 ? <p className="mt-2 text-sm text-slate-500">No colleges are accepting applications yet.</p> : (
            <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
              {partners.map((p) => {
                const inCart = cart.some((c) => c.id === p.id);
                return (
                  <li key={p.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{p.name}</p><p className="truncate text-xs text-slate-500">{p.city}{p.application_note ? ` · ${p.application_note}` : ''}</p></div>
                    <button onClick={() => { const r = toggleItem('apply', { id: p.id, slug: p.slug, name: p.name, city: p.city }); if (!r.ok && r.message) alert(r.message); }}
                      className={inCart ? 'btn-ghost px-2 py-1 text-emerald-700' : 'btn-ghost px-2 py-1'}>{inCart ? <CheckCircle2 size={16} /> : <Plus size={16} />}</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
