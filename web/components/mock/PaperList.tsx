'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Clock, ListChecks, Users, Loader2, PlayCircle, RotateCcw, Trophy, BarChart3 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { startPaper, GUEST_TESTS } from './start';

type P = { id: string; kind: 'full' | 'sectional' | 'topic'; number: number; title: string; section: string | null; topic: string | null; duration_min: number; questions: number; attempts: number; my_attempt: string | null; my_status: string | null; my_score: number | null; max_score: number | null };
const TABS = [['full', 'Full mock tests'], ['sectional', 'Sectional tests'], ['topic', 'Topic tests']] as const;

export default function PaperList({ exam, groupId }: { exam: string; groupId?: string }) {
  const { user } = useAuth();
  const router = useRouter(); const path = usePathname();
  const [rows, setRows] = useState<P[] | null>(null);
  const [tab, setTab] = useState<P['kind']>('full');
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const load = useCallback(() => supabaseBrowser().rpc('exam_papers', { p_exam: exam }).then(({ data }: { data: P[] | null }) => setRows(data || [])), [exam]);
  useEffect(() => { load(); }, [load, user?.id]);
  const counts = useMemo(() => Object.fromEntries(TABS.map(([k]) => [k, (rows || []).filter((r) => r.kind === k).length])), [rows]);
  useEffect(() => { if (rows && !counts[tab]) { const first = TABS.find(([k]) => counts[k]); if (first) setTab(first[0]); } }, [rows, counts, tab]);
  const go = async (p: P) => {
    setErr(''); setBusy(p.id);
    const r = await startPaper(p.id, groupId);
    if (r.login) { router.push(`/login?mode=register&next=${encodeURIComponent(path)}`); return; }
    if (r.error) { setBusy(''); setErr(r.error); return; }
    router.push(`/mock-tests/attempt/${r.id}`);
  };
  if (!rows) return <div className="card h-48 animate-pulse" />;
  if (!rows.length) return <div className="card p-8 text-center text-slate-500">Tests for this exam are being prepared — check back soon.</div>;
  const list = rows.filter((r) => r.kind === tab);
  const grouped = new Map<string, P[]>();
  for (const r of list) { const k = tab === 'full' ? '' : tab === 'sectional' ? r.section || '' : `${r.section} · ${r.topic}`; grouped.set(k, [...(grouped.get(k) || []), r]); }
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">{TABS.map(([k, l]) => counts[k] > 0 && (
        <button key={k} onClick={() => setTab(k)} className={`${tab === k ? 'btn-primary' : 'btn-ghost'} whitespace-nowrap py-2`}>{l} ({counts[k]})</button>))}</div>
      {!user && <p className="mt-3 text-sm text-slate-500">{GUEST_TESTS ? 'Start any test without signing up — create a free account later to keep your results.' : 'Log in free to take tests and get your rank.'}</p>}
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {Array.from(grouped.entries()).map(([g, ps]) => (
        <div key={g} className="mt-5">
          {g && <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{g}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ps.map((p) => {
            const live = p.my_status === 'in_progress'; const done = p.my_status === 'submitted';
            return (
              <div key={p.id} className="card flex flex-col p-4">
                <p className="font-semibold text-slate-900">{p.title}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><ListChecks size={12} />{p.questions} Qs</span>
                  <span className="flex items-center gap-1"><Clock size={12} />{p.duration_min} min</span>
                  {Number(p.attempts) > 0 && <span className="flex items-center gap-1"><Users size={12} />{Number(p.attempts).toLocaleString('en-IN')}</span>}
                </div>
                {done && <p className="mt-2 text-xs font-semibold text-emerald-700">Your score: {Number(p.my_score)} / {Number(p.max_score)}</p>}
                <div className="mt-3 flex gap-2">
                  {live ? <Link href={`/mock-tests/attempt/${p.my_attempt}`} className="btn-primary flex-1 py-1.5 text-sm"><PlayCircle size={15} />Resume</Link>
                    : <button onClick={() => go(p)} disabled={!!busy} className={`${done ? 'btn-ghost' : 'btn-primary'} flex-1 py-1.5 text-sm`}>
                        {busy === p.id ? <Loader2 size={15} className="animate-spin" /> : done ? <RotateCcw size={15} /> : <PlayCircle size={15} />}{done ? 'Retake' : 'Start test'}</button>}
                  {done && <Link href={`/mock-tests/result/${p.my_attempt}`} className="btn-ghost px-2.5 py-1.5" title="My result"><BarChart3 size={15} /></Link>}
                  <Link href={`/mock-tests/leaderboard/${p.id}${groupId ? `?group=${groupId}` : ''}`} className="btn-ghost px-2.5 py-1.5" title="Leaderboard"><Trophy size={15} /></Link>
                </div>
              </div>);
          })}</div>
        </div>
      ))}
    </div>
  );
}
