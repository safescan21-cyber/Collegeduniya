'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Gift, Star, FilePlus2, UserPlus, Loader2, Copy, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

const WAYS = [
  { icon: Star, pts: 50, title: 'Verified college review', text: 'Review your college and upload your ID or fee receipt. Points arrive when our team verifies it.', href: '/colleges' },
  { icon: FilePlus2, pts: 10, title: 'Apply to a college', text: 'Each college or management-quota application through Collegeolo.', href: '/apply' },
  { icon: UserPlus, pts: 20, title: 'Invite a friend', text: 'Share your link. Points unlock once your friend applies somewhere or writes a review.', href: '/ambassador' },
];
const REASON: Record<string, string> = { review_verified: 'Verified review', college_applications: 'College application', quota_applications: 'Quota application', referral: 'Friend joined', redemption: 'Redeemed', admin: 'Bonus' };

export default function Rewards({ catalog }: { catalog: { code: string; title: string; points: number; stock: number | null }[] }) {
  const { user, profile, loading } = useAuth();
  const supabase = supabaseBrowser();
  const [bal, setBal] = useState<number | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [reds, setReds] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [b, l, r, p] = await Promise.all([
      supabase.rpc('points_balance'),
      supabase.from('reward_points').select('id, points, reason, status, created_at, note').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('reward_redemptions').select('id, reward_code, points, status, voucher, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('profiles').select('referral_code').eq('id', user.id).single(),
    ]);
    setBal(b.data ?? 0); setLedger(l.data || []); setReds(r.data || []); setCode(p.data?.referral_code || '');
  }, [user, supabase]);
  useEffect(() => { load(); }, [load]);

  const redeem = async (c: string) => {
    if (!confirm('Redeem this reward? Points are deducted now and refunded if we can’t fulfil it.')) return;
    setBusy(c); setMsg('');
    const { error } = await supabase.rpc('request_redemption', { p_code: c });
    setBusy('');
    setMsg(error ? error.message : 'Requested! We usually send the voucher within 3 working days — it will appear below.');
    load();
  };
  const link = typeof window !== 'undefined' && code ? `${window.location.origin}/?ref=${code}` : '';
  const pending = ledger.filter((x) => x.status === 'pending').reduce((s, x) => s + x.points, 0);

  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><Gift className="text-brand-600" />Rewards</h1>
      <p className="mt-1 text-slate-500">Help other students, earn points, redeem them for vouchers.</p>

      {!loading && (user ? (
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_2fr]">
          <div className="card bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
            <p className="text-sm text-brand-100">Your points</p>
            <p className="text-5xl font-extrabold">{bal ?? '…'}</p>
            {pending > 0 && <p className="mt-1 text-sm text-brand-100">+{pending} pending (friends who haven’t applied yet)</p>}
            <p className="mt-3 text-sm text-brand-100">Hi {profile?.full_name?.split(' ')[0] || 'there'} 👋</p>
          </div>
          <div className="card p-6">
            <p className="font-bold text-slate-900">Your invite link</p>
            <div className="mt-2 flex gap-2">
              <input readOnly className="input flex-1 bg-slate-50" value={link} />
              <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost">{copied ? <Check size={16} /> : <Copy size={16} />}Copy</button>
              <a className="btn-primary" target="_blank" rel="noopener" href={`https://wa.me/?text=${encodeURIComponent(`Find colleges, PGs and part-time jobs on Collegeolo: ${link}`)}`}>WhatsApp</a>
            </div>
            <p className="mt-2 text-xs text-slate-500">Code <b>{code}</b> · friends must sign up within 7 days of opening your link. Want to do more? <Link href="/ambassador" className="text-brand-700 underline">Become a campus ambassador</Link>.</p>
          </div>
        </div>
      ) : (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-6">
          <p className="text-slate-700">Log in to see your points and invite link.</p>
          <Link href="/login?next=/rewards" className="btn-primary">Log in / register</Link>
        </div>
      ))}

      <h2 className="mt-10 text-xl font-bold text-slate-900">How to earn</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {WAYS.map((w) => (
          <Link key={w.title} href={w.href} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between"><w.icon className="text-brand-600" /><span className="chip-green">+{w.pts} points</span></div>
            <p className="mt-3 font-bold text-slate-900">{w.title}</p><p className="mt-1 text-sm text-slate-500">{w.text}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Redeem</h2>
      {msg && <p className="mt-2 rounded-xl bg-brand-50 p-3 text-sm text-slate-700">{msg}</p>}
      {catalog.length ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {catalog.map((c) => {
            const out = c.stock !== null && c.stock <= 0;
            const can = user && bal !== null && bal >= c.points && !out;
            return (
              <div key={c.code} className="card flex flex-col p-5">
                <Gift className="text-amber-500" /><p className="mt-2 flex-1 font-bold text-slate-900">{c.title}</p>
                <p className="mt-1 text-sm text-slate-500">{c.points} points{out ? ' · out of stock' : ''}</p>
                <button onClick={() => redeem(c.code)} disabled={!can || busy !== ''} className="btn-primary mt-3">{busy === c.code ? <Loader2 size={16} className="animate-spin" /> : null}Redeem</button>
              </div>
            );
          })}
        </div>
      ) : <p className="mt-2 text-sm text-slate-500">Rewards will be listed here soon — keep collecting points.</p>}

      {user && (reds.length > 0 || ledger.length > 0) && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {reds.length > 0 && <section><h2 className="text-lg font-bold text-slate-900">My redemptions</h2>
            <div className="card mt-3 divide-y divide-slate-100">{reds.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div><p className="font-medium">{catalog.find((c) => c.code === r.reward_code)?.title || r.reward_code}</p><p className="text-xs text-slate-500">{timeAgo(r.created_at)} · {r.points} points</p></div>
                {r.status === 'fulfilled' ? <code className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">{r.voucher || 'Sent by email'}</code>
                  : <span className={r.status === 'rejected' ? 'chip-red' : 'chip-amber'}>{r.status === 'rejected' ? 'Refunded' : 'Processing'}</span>}
              </div>))}</div></section>}
          {ledger.length > 0 && <section><h2 className="text-lg font-bold text-slate-900">Points history</h2>
            <div className="card mt-3 divide-y divide-slate-100">{ledger.map((x) => (
              <div key={x.id} className="flex items-center justify-between p-4 text-sm">
                <div><p className="font-medium">{REASON[x.reason] || x.reason}{x.status !== 'approved' ? <span className="chip ms-2">{x.status}</span> : null}</p><p className="text-xs text-slate-500">{timeAgo(x.created_at)}{x.note ? ` · ${x.note}` : ''}</p></div>
                <span className={`font-bold ${x.points < 0 ? 'text-rose-600' : 'text-emerald-700'} ${x.status === 'reversed' ? 'line-through opacity-50' : ''}`}>{x.points > 0 ? '+' : ''}{x.points}</span>
              </div>))}</div></section>}
        </div>
      )}
    </div>
  );
}
