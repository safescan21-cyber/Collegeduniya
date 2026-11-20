'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UsersRound, Copy, Check, Plus, Trophy, PlayCircle, Loader2, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { startPaper } from '@/components/mock/start';

export default function Group({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [g, setG] = useState<any>(null); const [members, setMembers] = useState<any[]>([]); const [assigned, setAssigned] = useState<any[]>([]);
  const [boards, setBoards] = useState<Record<string, any[]>>({});
  const [exams, setExams] = useState<any[]>([]); const [exam, setExam] = useState(''); const [papers, setPapers] = useState<any[]>([]); const [pick, setPick] = useState('');
  const [copied, setCopied] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const owner = g && user && g.owner_id === user.id;
  const load = useCallback(async () => {
    const { data: grp } = await sb.from('study_groups').select('*').eq('id', id).maybeSingle();
    if (!grp) { setErr('Group not found, or you are not a member.'); return; }
    setG(grp);
    const [{ data: m }, { data: a }] = await Promise.all([sb.rpc('group_members', { p_group: id }), sb.from('study_group_papers').select('paper_id, due_at, assigned_at').eq('group_id', id).order('assigned_at', { ascending: false })]);
    setMembers(m || []);
    const ids = (a || []).map((x: any) => x.paper_id);
    const { data: ps } = ids.length ? await sb.from('mock_papers').select('id, title, exam_slug, duration_min').in('id', ids) : { data: [] };
    const list = (a || []).map((x: any) => ({ ...x, paper: (ps || []).find((p: any) => p.id === x.paper_id) })).filter((x: any) => x.paper);
    setAssigned(list);
    const b: Record<string, any[]> = {};
    await Promise.all(list.map(async (x: any) => { const { data } = await sb.rpc('paper_leaderboard', { p_paper: x.paper_id, p_group: id, p_lim: 10 }); b[x.paper_id] = data || []; }));
    setBoards(b);
  }, [id, sb]);
  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => { if (owner) sb.rpc('mock_catalog_v2').then(({ data }: { data: any[] | null }) => setExams(data || [])); }, [owner, sb]);
  useEffect(() => { if (exam) sb.rpc('exam_papers', { p_exam: exam }).then(({ data }: { data: any[] | null }) => { setPapers(data || []); setPick(''); }); }, [exam, sb]);

  const assign = async () => { if (!pick) return; const { error } = await sb.from('study_group_papers').insert({ group_id: id, paper_id: pick }); if (error) setErr(error.message); else { setPick(''); load(); } };
  const unassign = async (pid: string) => { await sb.from('study_group_papers').delete().eq('group_id', id).eq('paper_id', pid); load(); };
  const take = async (pid: string) => { setBusy(pid); const r = await startPaper(pid, id); if (r.id) router.push(`/mock-tests/attempt/${r.id}`); else { setBusy(''); setErr(r.error || 'Log in to take the test'); } };
  const leave = async () => { if (!confirm(owner ? 'Delete this group for everyone?' : 'Leave this group?')) return;
    if (owner) await sb.from('study_groups').delete().eq('id', id); else await sb.from('study_group_members').delete().eq('group_id', id).eq('user_id', user!.id);
    router.push('/mock-tests/groups'); };

  if (err && !g) return <div className="container-x py-20 text-center text-slate-500">{err} <Link href="/mock-tests/groups" className="text-brand-700 underline">My groups</Link></div>;
  if (!g) return <div className="container-x py-10"><div className="card h-64 animate-pulse" /></div>;
  return (
    <div className="container-x max-w-5xl py-10">
      <Link href="/mock-tests/groups" className="text-sm text-slate-500 hover:underline">← My groups</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><UsersRound className="text-brand-600" />{g.name}</h1>
        <button onClick={leave} className="btn-ghost text-sm text-rose-600">{owner ? <><Trash2 size={15} />Delete group</> : <><LogOut size={15} />Leave</>}</button>
      </div>
      <div className="card mt-4 flex flex-wrap items-center gap-3 p-4 text-sm">
        <span>Invite code <b className="font-mono text-lg tracking-widest">{g.code}</b></span>
        <button onClick={() => { navigator.clipboard?.writeText(`Join my study group "${g.name}" on StudyEarnstay: ${location.origin}/mock-tests/groups — code ${g.code}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost py-1 text-xs">{copied ? <Check size={13} /> : <Copy size={13} />}Copy invite</button>
        <a className="btn-ghost py-1 text-xs" target="_blank" rel="noopener" href={`https://wa.me/?text=${encodeURIComponent(`Join my study group "${g.name}" on StudyEarnstay — open ${typeof location !== 'undefined' ? location.origin : ''}/mock-tests/groups and enter code ${g.code}`)}`}>Share on WhatsApp</a>
        <span className="ms-auto text-slate-500">{members.length} member{members.length === 1 ? '' : 's'}</span>
      </div>
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Group tests</h2>
          {owner && (
            <div className="card flex flex-wrap items-end gap-2 p-4">
              <label className="text-sm"><span className="label">Exam</span><select className="input" value={exam} onChange={(e) => setExam(e.target.value)}><option value="">Choose…</option>{exams.map((e) => <option key={e.exam_slug} value={e.exam_slug}>{e.short_name}</option>)}</select></label>
              <label className="min-w-48 flex-1 text-sm"><span className="label">Test</span><select className="input" value={pick} onChange={(e) => setPick(e.target.value)} disabled={!papers.length}><option value="">Choose…</option>{papers.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
              <button onClick={assign} disabled={!pick} className="btn-primary"><Plus size={16} />Assign to group</button>
            </div>)}
          {assigned.length === 0 && <div className="card p-6 text-center text-sm text-slate-500">{owner ? 'Assign a test above — everyone in the group takes the same paper.' : 'No tests assigned yet.'}</div>}
          {assigned.map((x) => (
            <div key={x.paper_id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-semibold">{x.paper.title}</p><p className="text-xs text-slate-500">{x.paper.duration_min} min</p></div>
                <div className="flex gap-2">
                  <button onClick={() => take(x.paper_id)} disabled={!!busy} className="btn-primary py-1.5 text-sm">{busy === x.paper_id ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}Take test</button>
                  <Link href={`/mock-tests/leaderboard/${x.paper_id}?group=${id}`} className="btn-ghost py-1.5 text-sm"><Trophy size={15} />Full board</Link>
                  {owner && <button onClick={() => unassign(x.paper_id)} className="btn-ghost px-2 py-1.5 text-rose-600" aria-label="Remove"><Trash2 size={14} /></button>}
                </div>
              </div>
              {(boards[x.paper_id] || []).length > 0 && <ol className="mt-3 space-y-1 text-sm">{boards[x.paper_id].map((r: any, i: number) => (
                <li key={i} className={`flex justify-between rounded-lg px-2 py-1 ${r.is_me ? 'bg-brand-50 font-semibold' : ''}`}><span>{Number(r.rank)}. {r.name}</span><span>{Number(r.score)}/{Number(r.max_score)} · {Number(r.minutes)} min</span></li>))}</ol>}
            </div>))}
        </section>
        <aside className="card h-fit p-4"><p className="font-bold">Members</p>
          <ul className="mt-2 space-y-1 text-sm">{members.map((m) => <li key={m.user_id} className="flex justify-between"><span>{m.name}</span>{m.role === 'owner' && <span className="chip">owner</span>}</li>)}</ul></aside>
      </div>
    </div>
  );
}
