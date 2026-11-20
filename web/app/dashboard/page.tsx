'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Star, User, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Stars } from '@/components/Cards';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

const STATUS_CHIP: Record<string, string> = { pending: 'chip-amber', shortlisted: 'chip-brand', hired: 'chip-green', rejected: 'chip-red', approved: 'chip-green', blocked: 'chip-red' };

export default function DashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const supabase = supabaseBrowser();
  const [tab, setTab] = useState<'applications' | 'reviews' | 'profile'>('applications');
  const [apps, setApps] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [form, setForm] = useState({ full_name: '', phone: '', city: '', country: '', course_interest: '' });
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('job_applications').select('*, jobs(id, title, company, city)').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }: { data: any[] | null }) => setApps(data || []));
    supabase.from('reviews').select('*, colleges(name, slug)').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }: { data: any[] | null }) => setReviews(data || []));
  }, [user, supabase]);

  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name || '', phone: profile.phone || '', city: profile.city || '',
      country: profile.country || '', course_interest: profile.course_interest || '',
    });
  }, [profile]);

  if (loading) return <div className="container-x py-10"><div className="card h-64 animate-pulse" /></div>;
  if (!user) return <div className="container-x py-20 text-center"><Link href="/login?next=/dashboard" className="btn-primary">Login to continue</Link></div>;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('profiles').update(form).eq('id', user.id);
    setSaved(error ? error.message : 'Profile saved ✓');
    refreshProfile();
    setTimeout(() => setSaved(''), 3000);
  };

  const withdraw = async (id: string) => {
    if (!confirm('Withdraw this application?')) return;
    const { error } = await supabase.from('job_applications').delete().eq('id', id);
    if (!error) setApps((a) => a.filter((x) => x.id !== id));
  };

  return (
    <div className="container-x py-10">
      <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-xl font-bold text-white">{(profile?.full_name || user.email || '?')[0].toUpperCase()}</span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Hi, {profile?.full_name || 'Student'} 👋</h1>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
        {profile?.is_blocked && <span className="chip-red">Your account is restricted — contact support</span>}
        <div className="flex gap-2"><Link href="/jobs" className="btn-primary">Find jobs</Link><Link href="/colleges" className="btn-ghost">Explore colleges</Link></div>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto">
        <button onClick={() => setTab('applications')} className={tab === 'applications' ? 'btn-primary' : 'btn-ghost'}><Briefcase size={16} />Applications ({apps.length})</button>
        <button onClick={() => setTab('reviews')} className={tab === 'reviews' ? 'btn-primary' : 'btn-ghost'}><Star size={16} />My reviews ({reviews.length})</button>
        <button onClick={() => setTab('profile')} className={tab === 'profile' ? 'btn-primary' : 'btn-ghost'}><User size={16} />Profile</button>
      </div>

      <div className="mt-6">
        {tab === 'applications' && (
          apps.length ? (
            <div className="card divide-y divide-slate-100">
              {apps.map((a) => (
                <div key={a.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href={`/jobs/${a.jobs?.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{a.jobs?.title || 'Job removed'}</Link>
                    <p className="text-sm text-slate-500">{a.jobs?.company} · {a.jobs?.city} · applied {timeAgo(a.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`${STATUS_CHIP[a.status] || 'chip'} capitalize`}>{a.status}</span>
                    {a.status === 'pending' && <button onClick={() => withdraw(a.id)} className="btn-ghost py-1.5 text-rose-600" aria-label="Withdraw"><Trash2 size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="card p-10 text-center text-slate-500">No applications yet. <Link href="/jobs" className="font-semibold text-brand-700">Browse part-time jobs →</Link></div>
        )}

        {tab === 'reviews' && (
          reviews.length ? (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="card p-5">
                  <div className="flex items-start justify-between">
                    <Link href={`/colleges/${r.colleges?.slug}#reviews`} className="font-semibold text-slate-900 hover:text-brand-700">{r.colleges?.name}</Link>
                    <span className={`${STATUS_CHIP[r.status] || 'chip'} capitalize`}>{r.status}</span>
                  </div>
                  <Stars value={r.rating} />
                  <p className="mt-1 font-medium">{r.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.body}</p>
                </div>
              ))}
            </div>
          ) : <div className="card p-10 text-center text-slate-500">You have not reviewed any college yet.</div>
        )}

        {tab === 'profile' && (
          <form onSubmit={saveProfile} className="card grid max-w-2xl gap-4 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Full name</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Course interested in</label><input className="input" value={form.course_interest} onChange={(e) => setForm({ ...form, course_interest: e.target.value })} placeholder="e.g. MBA" /></div>
            <div><label className="label">City</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><label className="label">Country</label><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button className="btn-primary"><Save size={16} />Save profile</button>
              {saved && <span className="text-sm text-emerald-700">{saved}</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
