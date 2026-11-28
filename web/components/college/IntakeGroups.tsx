'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plane, Loader2, UsersRound } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

type G = { id: string; intake: string; name: string; member_count: number; joined: boolean };

// the next few intakes, nearest first (Spring = Jan–Apr, Summer = May–Jul, Fall/Winter = Aug–Dec)
function nextIntakes(n = 6) {
  const out: string[] = []; const now = new Date(); const order = ['Spring', 'Summer', 'Fall', 'Winter'];
  let y = now.getFullYear(); let i = now.getMonth() < 3 ? 0 : now.getMonth() < 6 ? 1 : now.getMonth() < 9 ? 2 : 3;
  i++; if (i > 3) { i = 0; y++; }
  while (out.length < n) { out.push(`${order[i]} ${y}`); i++; if (i > 3) { i = 0; y++; } }
  return out;
}

// "Going to this university?" — one group per intake for students heading there at the same time
export default function IntakeGroups({ collegeId, collegeName }: { collegeId: string; collegeName: string }) {
  const { user } = useAuth();
  const loggedIn = !!user && !(user as any).is_anonymous;
  const router = useRouter();
  const sb = supabaseBrowser();
  const [groups, setGroups] = useState<G[] | null>(null);
  const [intake, setIntake] = useState(nextIntakes()[1]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { sb.rpc('intake_groups', { p_college: collegeId }).then(({ data }: { data: any }) => setGroups((data || []) as G[])); }, [collegeId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async (which: string) => {
    if (!loggedIn) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
    setBusy(true); setErr('');
    const { data, error } = await sb.rpc('join_intake_group', { p_college: collegeId, p_intake: which });
    setBusy(false);
    if (error) return setErr(error.message);
    router.push(`/messages?tab=groups&g=${data}`);
  };

  return (
    <section className="card p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Plane size={19} className="text-brand-600" />Going to {collegeName}?</h2>
      <p className="mt-1 text-sm text-slate-500">Join the group for your intake — talk visas, housing, flights and roommates with students going at the same time.</p>
      {groups && groups.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">{groups.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span className="font-medium text-slate-800">{g.intake} <span className="ml-1 inline-flex items-center gap-1 text-xs text-slate-500"><UsersRound size={12} />{g.member_count}</span></span>
            {g.joined ? <Link href={`/messages?tab=groups&g=${g.id}`} className="btn-ghost py-1.5 text-sm">Open chat</Link>
              : <button disabled={busy} onClick={() => join(g.intake)} className="btn-primary py-1.5 text-sm">Join</button>}
          </li>))}</ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={intake} onChange={(e) => setIntake(e.target.value)} aria-label="Intake">{nextIntakes().map((x) => <option key={x}>{x}</option>)}</select>
        <button disabled={busy} onClick={() => join(intake)} className="btn-primary">{busy ? <Loader2 size={16} className="animate-spin" /> : <UsersRound size={16} />}{groups?.some((g) => g.intake === intake) ? 'Join group' : 'Start the group'}</button>
      </div>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <p className="mt-2 text-xs text-slate-400">Groups are public. Never share passport numbers, bank details or OTPs in chat.</p>
    </section>
  );
}
