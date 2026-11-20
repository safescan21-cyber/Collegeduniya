'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, Trophy, Users, Award, Loader2, CheckCircle2, Copy, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

const PERKS = [
  { icon: Award, title: 'Certificate & LinkedIn recommendation', text: 'For approved ambassadors who stay active for 3 months.' },
  { icon: Trophy, title: 'Monthly leaderboard', text: 'Top ambassadors get bonus points and featured shout-outs.' },
  { icon: Users, title: 'Help your juniors', text: 'Share honest information about your college, PGs and part-time jobs nearby.' },
];

export default function Ambassador({ board }: { board: { first_name: string; college: string | null; referrals: number }[] }) {
  const { user, profile, loading } = useAuth();
  const supabase = supabaseBrowser();
  const [me, setMe] = useState<any | null>(null);
  const [stats, setStats] = useState<{ code: string; joined: number; active: number; points: number } | null>(null);
  const [f, setF] = useState({ college_name: '', city: '', year_of_study: '', instagram: '', why: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [a, s] = await Promise.all([supabase.from('ambassadors').select('*').eq('user_id', user.id).maybeSingle(), supabase.rpc('my_referrals')]);
    setMe(a.data || null); setStats((s.data as any)?.[0] || null);
  }, [user, supabase]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (profile?.city) setF((x) => ({ ...x, city: x.city || profile.city || '' })); }, [profile]);

  const apply = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (f.why.trim().length < 30) return setErr('Tell us a little more (at least 30 characters).');
    setBusy(true);
    const { error } = await supabase.from('ambassadors').insert({
      user_id: user!.id, college_name: f.college_name.trim(), city: f.city.trim() || null,
      year_of_study: f.year_of_study ? Number(f.year_of_study) : null, instagram: f.instagram.trim() || null, why: f.why.trim(),
    });
    setBusy(false);
    if (error) return setErr(error.message);
    load();
  };
  const link = typeof window !== 'undefined' && stats?.code ? `${window.location.origin}/?ref=${stats.code}` : '';

  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><Megaphone className="text-brand-600" />Campus ambassador programme</h1>
      <p className="mt-1 max-w-2xl text-slate-500">Represent StudyEarnstay at your college. Every student who joins with your link and applies somewhere earns you 20 points — redeem them on the <Link href="/rewards" className="text-brand-700 underline">rewards page</Link>.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">{PERKS.map((p) => (
        <div key={p.title} className="card p-5"><p.icon className="text-brand-600" /><p className="mt-2 font-bold text-slate-900">{p.title}</p><p className="mt-1 text-sm text-slate-500">{p.text}</p></div>))}</div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <section>
          {loading ? <div className="card h-48 animate-pulse" /> : !user ? (
            <div className="card p-6 text-center"><p className="text-slate-700">Log in with your email to apply.</p><Link href="/login?mode=register&next=/ambassador" className="btn-primary mt-4">Register & apply</Link></div>
          ) : (
            <div className="space-y-4">
              {stats && (
                <div className="card p-6">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><p className="text-3xl font-extrabold text-slate-900">{stats.joined}</p><p className="text-xs text-slate-500">Friends joined</p></div>
                    <div><p className="text-3xl font-extrabold text-emerald-700">{stats.active}</p><p className="text-xs text-slate-500">Active (points earned)</p></div>
                    <div><p className="text-3xl font-extrabold text-brand-700">{stats.points}</p><p className="text-xs text-slate-500">Your points</p></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input readOnly className="input flex-1 bg-slate-50" value={link} />
                    <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
                  </div>
                </div>
              )}
              {me ? (
                <div className="card flex items-center gap-3 p-6">
                  <CheckCircle2 className={me.status === 'approved' ? 'text-emerald-600' : 'text-amber-500'} />
                  <div><p className="font-bold text-slate-900">{me.status === 'approved' ? 'You are a StudyEarnstay campus ambassador 🎉' : me.status === 'applied' ? 'Application received — we review within a week' : `Status: ${me.status}`}</p>
                    <p className="text-sm text-slate-500">{me.college_name}{me.admin_note ? ` · ${me.admin_note}` : ''}</p></div>
                </div>
              ) : (
                <form onSubmit={apply} className="card grid gap-3 p-6 sm:grid-cols-2">
                  <p className="font-bold text-slate-900 sm:col-span-2">Apply</p>
                  <div className="sm:col-span-2"><label className="label">Your college *</label><input required minLength={3} className="input" value={f.college_name} onChange={(e) => setF({ ...f, college_name: e.target.value })} /></div>
                  <div><label className="label">City</label><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
                  <div><label className="label">Year of study</label><select className="input" value={f.year_of_study} onChange={(e) => setF({ ...f, year_of_study: e.target.value })}><option value="">—</option>{[1, 2, 3, 4, 5].map((y) => <option key={y}>{y}</option>)}</select></div>
                  <div className="sm:col-span-2"><label className="label">Instagram / LinkedIn (optional)</label><input className="input" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} /></div>
                  <div className="sm:col-span-2"><label className="label">Why do you want to be an ambassador? *</label><textarea rows={4} maxLength={1000} className="input" value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} /></div>
                  {err && <p className="text-sm text-rose-600 sm:col-span-2">{err}</p>}
                  <button disabled={busy} className="btn-primary sm:col-span-2">{busy && <Loader2 size={16} className="animate-spin" />}Submit application</button>
                </form>
              )}
            </div>
          )}
        </section>
        <aside className="card h-fit p-5">
          <p className="flex items-center gap-2 font-bold text-slate-900"><Trophy size={18} className="text-amber-500" />Top referrers — last 30 days</p>
          {board.length ? <ol className="mt-3 space-y-2">{board.map((b, i) => (
            <li key={i} className="flex items-center gap-3 text-sm"><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 font-bold">{i + 1}</span>
              <div className="min-w-0 flex-1"><p className="font-medium">{b.first_name}</p>{b.college && <p className="truncate text-xs text-slate-500">{b.college}</p>}</div><span className="font-bold text-brand-700">{b.referrals}</span></li>))}</ol>
            : <p className="mt-2 text-sm text-slate-500">Be the first on the board this month!</p>}
        </aside>
      </div>
    </div>
  );
}
