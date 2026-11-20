'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, Target, TrendingUp, Sparkles, CheckCircle2, XCircle, MinusCircle, Flag, Loader2, RotateCcw, Mail, Timer, Medal, Wand2, Copy, Check, Save } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { api } from '@/lib/api';

type Fb = { summary: string; strengths: string[]; weaknesses: string[]; plan: string[]; ai: boolean };
type R = { idx: number; id: string; section: string; topic: string | null; stem: string; options: string[]; answer: number; chosen: number | null; explanation: string | null };
const LETTERS = 'ABCDEF';
type Ex = { concept: string; working: string; mistake: string; tip: string };
const fmt = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : `${Math.round(sec)}s`);
const n = (x: any) => (x == null ? '—' : Number.isInteger(Number(x)) ? String(Number(x)) : Number(x).toFixed(2));

export default function Result({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [a, setA] = useState<any | null>(null);
  const [rev, setRev] = useState<R[]>([]);
  const [fb, setFb] = useState<Fb | null>(null);
  const [filter, setFilter] = useState<'all' | 'wrong' | 'skipped' | 'right'>('all');
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const [rank, setRank] = useState<{ rank: number; total: number; group_rank: number | null; group_total: number | null } | null>(null);
  const [board, setBoard] = useState<any[]>([]);
  const [ex, setEx] = useState<Record<string, Ex | string>>({}); const [exBusy, setExBusy] = useState('');
  const [copied, setCopied] = useState(false);
  const [gEmail, setGEmail] = useState(''); const [gMsg, setGMsg] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(`/login?next=/mock-tests/result/${id}`); return; }
    (async () => {
      const { data } = await sb.from('mock_attempts').select('*').eq('id', id).maybeSingle();
      if (!data) { setErr('Result not found.'); return; }
      if (data.status !== 'submitted') { router.replace(`/mock-tests/attempt/${id}`); return; }
      setA(data);
      if (data.paper_id) {
        sb.rpc('paper_rank', { p_attempt: id }).then(({ data: rk }: { data: any[] | null }) => rk?.[0] && setRank(rk[0]));
        sb.rpc('paper_leaderboard', { p_paper: data.paper_id, p_group: data.group_id, p_lim: 10 }).then(({ data: b }: { data: any[] | null }) => setBoard(b || []));
      }
      const { data: r } = await sb.rpc('attempt_review', { p_attempt: id });
      setRev((r || []) as R[]);
      if (data.feedback) setFb(data.feedback);
      else {
        try { const res = await api<{ feedback: Fb }>(`/api/mock/attempts/${id}/finish`, { method: 'POST' }); setFb(res.feedback); }
        catch { setFb(null); }
      }
    })();
  }, [user, loading, id, sb, router]);

  const report = async (qid: string) => {
    const { error } = await sb.rpc('report_mock_question', { p_question: qid, p_reason: reason || 'The answer or question looks wrong' });
    if (!error) { setReported((s) => new Set(s).add(qid)); setReporting(null); setReason(''); } else alert(error.message);
  };

  const explain = async (qid: string) => {
    setExBusy(qid);
    try { const r = await api<{ explanation: Ex }>(`/api/mock/questions/${qid}/explain`, { method: 'POST' }); setEx((m) => ({ ...m, [qid]: r.explanation })); }
    catch (e: any) { setEx((m) => ({ ...m, [qid]: e.message || 'Could not explain right now' })); }
    setExBusy('');
  };
  const guest = !!(user as any)?.is_anonymous;
  const saveGuest = async (e: React.FormEvent) => {
    e.preventDefault(); setGMsg('');
    const { error } = await sb.auth.updateUser({ email: gEmail.trim() }, { emailRedirectTo: `${location.origin}/dashboard?tab=mocks` });
    setGMsg(error ? error.message : `Check ${gEmail} and click the link — your results will stay in your new account.`);
  };

  if (err) return <div className="container-x py-20 text-center text-rose-600">{err}</div>;
  if (!a) return <div className="container-x py-10"><div className="card h-96 animate-pulse" /></div>;
  const attempted = a.correct + a.wrong;
  const accuracy = attempted ? Math.round((100 * a.correct) / attempted) : 0;
  const mins = Math.max(1, Math.round((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 60000));
  const ts: Record<string, number> = a.time_spent || {};
  const hasTime = Object.keys(ts).length > 0;
  const secTime = new Map<string, { t: number; c: number; ok: number }>();
  for (const r of rev) { const v = secTime.get(r.section) || { t: 0, c: 0, ok: 0 }; v.t += ts[r.id] || 0; v.c++; if (r.chosen === r.answer) v.ok++; secTime.set(r.section, v); }
  const slow = rev.filter((r) => ts[r.id]).sort((x, y) => (ts[y.id] || 0) - (ts[x.id] || 0)).slice(0, 5);
  const totalT = Object.values(ts).reduce((x, y) => x + y, 0);
  const wrongTime = rev.filter((r) => r.chosen != null && r.chosen !== r.answer).reduce((x, r) => x + (ts[r.id] || 0), 0);
  const wrongs = rev.filter((r) => r.chosen != null && r.chosen !== r.answer).slice(0, 5);
  const prompt = wrongs.length ? `I am preparing for ${a.title}. I got these questions wrong in a practice test. For each one, explain the concept, solve it step by step, tell me why my answer was wrong, and give me 2 similar practice questions.\n\n` +
    wrongs.map((r, i) => `${i + 1}. ${r.stem}\nOptions: ${r.options.map((o, j) => `${LETTERS[j]}. ${o}`).join(' | ')}\nMy answer: ${LETTERS[r.chosen!]} · Correct: ${LETTERS[r.answer]}`).join('\n\n') : '';
  const list = rev.filter((r) => filter === 'all' || (filter === 'skipped' ? r.chosen == null : filter === 'right' ? r.chosen === r.answer : r.chosen != null && r.chosen !== r.answer));

  return (
    <div className="container-x py-10">
      <Link href="/mock-tests" className="text-sm text-slate-500 hover:underline">← All mock tests</Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{a.title} — result</h1>

      {guest && (
        <form onSubmit={saveGuest} className="card mt-4 flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50 p-4 text-sm">
          <Save size={18} className="text-amber-700" /><span className="flex-1 text-amber-900">You are taking tests as a guest. Add your email to keep this result, your rank and your study plan.</span>
          <input type="email" required className="input max-w-xs py-1.5" value={gEmail} onChange={(e) => setGEmail(e.target.value)} placeholder="you@email.com" />
          <button className="btn-primary py-1.5">Save my results</button>
          {gMsg && <p className="w-full text-amber-900">{gMsg}</p>}
        </form>)}
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="card bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white md:col-span-1">
          <p className="flex items-center gap-1.5 text-sm text-brand-100"><Trophy size={15} />Score</p>
          <p className="mt-1 text-4xl font-extrabold">{n(a.score)}<span className="text-lg font-semibold text-brand-200"> / {n(a.max_score)}</span></p>
          {rank ? <p className="mt-1 text-sm text-brand-100">All India rank <b className="text-white">{Number(rank.rank).toLocaleString('en-IN')}</b> of {Number(rank.total).toLocaleString('en-IN')}{rank.group_rank ? ` · group #${rank.group_rank} of ${rank.group_total}` : ''}</p>
            : <p className="mt-1 text-sm text-brand-100">{n(a.percentile)} percentile on StudyEarnstay</p>}
        </div>
        <div className="card p-5"><p className="flex items-center gap-1.5 text-sm text-slate-500"><Target size={15} />Accuracy</p><p className="mt-1 text-3xl font-extrabold text-slate-900">{accuracy}%</p><p className="text-xs text-slate-500">{a.correct} right of {attempted} attempted</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Answers</p>
          <p className="mt-2 flex flex-wrap gap-3 text-sm"><span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={15} />{a.correct}</span><span className="flex items-center gap-1 text-rose-600"><XCircle size={15} />{a.wrong}</span><span className="flex items-center gap-1 text-slate-500"><MinusCircle size={15} />{a.unanswered}</span></p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Time used</p><p className="mt-1 text-3xl font-extrabold text-slate-900">{Math.min(mins, a.duration_min)}<span className="text-base font-semibold text-slate-400"> / {a.duration_min} min</span></p></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-bold text-slate-900">Section-wise</h2>
          <div className="mt-3 space-y-3">{(a.section_stats || []).map((s: any) => {
            const p = s.max > 0 ? Math.max(0, (100 * s.score) / s.max) : 0;
            return (
              <div key={s.section}>
                <div className="flex justify-between text-sm"><span className="font-medium">{s.section}</span><span>{n(s.score)} / {n(s.max)}</span></div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${p >= 70 ? 'bg-emerald-500' : p >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, p)}%` }} /></div>
                <p className="mt-0.5 text-xs text-slate-500">{s.correct} right · {s.wrong} wrong · {s.skipped} skipped</p>
              </div>);
          })}</div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold text-slate-900">Topic-wise accuracy</h2>
          <div className="mt-3 max-h-72 overflow-y-auto">
            <table className="w-full text-sm"><tbody>{(a.topic_stats || []).slice().sort((x: any, y: any) => (x.accuracy ?? -1) - (y.accuracy ?? -1)).map((t: any) => (
              <tr key={t.section + t.topic} className="border-t border-slate-100">
                <td className="py-1.5"><p className="font-medium">{t.topic}</p><p className="text-xs text-slate-400">{t.section}</p></td>
                <td className="py-1.5 text-right text-xs text-slate-500">{t.correct}/{t.total}{t.skipped ? ` · ${t.skipped} skipped` : ''}</td>
                <td className="w-16 py-1.5 text-right"><span className={`chip ${t.accuracy == null ? '' : t.accuracy >= 70 ? 'chip-green' : t.accuracy >= 40 ? 'chip-amber' : 'chip-red'}`}>{t.accuracy == null ? '—' : `${t.accuracy}%`}</span></td>
              </tr>))}</tbody></table>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {hasTime && (
          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><Timer size={17} className="text-brand-600" />Time analysis</h2>
            <p className="mt-1 text-xs text-slate-500">Average {fmt(totalT / Math.max(1, rev.length))} per question{wrongTime > 0 ? ` · ${fmt(wrongTime)} spent on questions you got wrong` : ''}</p>
            <table className="mt-3 w-full text-sm"><thead className="text-xs text-slate-500"><tr><th className="text-left">Section</th><th className="text-right">Time</th><th className="text-right">Per question</th><th className="text-right">Right</th></tr></thead>
              <tbody>{Array.from(secTime.entries()).map(([k, v]) => <tr key={k} className="border-t border-slate-100"><td className="py-1.5">{k}</td><td className="text-right">{fmt(v.t)}</td><td className="text-right">{fmt(v.t / v.c)}</td><td className="text-right">{v.ok}/{v.c}</td></tr>)}</tbody></table>
            {slow.length > 0 && <><p className="mt-4 text-sm font-semibold">Slowest questions</p>
              <ul className="mt-1 space-y-1 text-sm">{slow.map((r) => <li key={r.id} className="flex justify-between gap-2"><a href={`#q${r.idx}`} className="truncate text-brand-700 hover:underline">Q{r.idx} · {r.topic || r.section}</a><span className={r.chosen === r.answer ? 'text-emerald-700' : 'text-rose-600'}>{fmt(ts[r.id])} {r.chosen === r.answer ? '✓' : r.chosen == null ? '–' : '✗'}</span></li>)}</ul></>}
          </section>)}
        {board.length > 0 && (
          <section className="card p-5">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold text-slate-900"><Medal size={17} className="text-amber-500" />{a.group_id ? 'Group leaderboard' : 'Top scorers'}</h2>
              <Link href={`/mock-tests/leaderboard/${a.paper_id}${a.group_id ? `?group=${a.group_id}` : ''}`} className="text-xs text-brand-700 hover:underline">Full list →</Link></div>
            <ol className="mt-3 space-y-1 text-sm">{board.map((r, i) => <li key={i} className={`flex justify-between rounded-lg px-2 py-1 ${r.is_me ? 'bg-brand-50 font-semibold' : ''}`}><span>{Number(r.rank)}. {r.name}{r.is_me ? ' (you)' : ''}</span><span>{Number(r.score)}/{Number(r.max_score)} · {Number(r.minutes)} min</span></li>)}</ol>
          </section>)}
      </div>

      {prompt && (
        <section className="card mt-6 flex flex-wrap items-center gap-3 p-5">
          <Wand2 size={20} className="text-brand-600" />
          <div className="min-w-60 flex-1"><p className="font-bold text-slate-900">Review your mistakes with an AI tutor</p><p className="text-xs text-slate-500">Opens your {wrongs.length} wrong question{wrongs.length > 1 ? 's' : ''} (no personal details) in a new tab.</p></div>
          <a target="_blank" rel="noopener noreferrer" href={`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`} className="btn-ghost py-1.5 text-sm">ChatGPT</a>
          <a target="_blank" rel="noopener noreferrer" href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`} className="btn-ghost py-1.5 text-sm">Claude</a>
          <button onClick={() => { navigator.clipboard?.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost py-1.5 text-sm">{copied ? <Check size={14} /> : <Copy size={14} />}Copy prompt</button>
        </section>)}

      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Sparkles size={18} className="text-brand-600" />Where to improve</h2>
        {!fb ? <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={15} className="animate-spin" />Preparing your personal analysis…</p> : (
          <>
            <p className="mt-2 text-slate-700">{fb.summary}</p>
            <div className="mt-4 grid gap-6 md:grid-cols-3">
              {fb.weaknesses.length > 0 && <div><p className="text-sm font-semibold text-rose-700">Weak areas</p><ul className="mt-1.5 list-disc space-y-1 ps-5 text-sm text-slate-700">{fb.weaknesses.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              <div className="md:col-span-2"><p className="flex items-center gap-1.5 text-sm font-semibold text-brand-700"><TrendingUp size={15} />Your study plan</p><ol className="mt-1.5 list-decimal space-y-1 ps-5 text-sm text-slate-700">{fb.plan.map((x) => <li key={x}>{x}</li>)}</ol></div>
            </div>
            {fb.strengths.length > 0 && <p className="mt-4 text-sm text-emerald-700"><b>Strengths:</b> {fb.strengths.join(' · ')}</p>}
            {user?.email && <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400"><Mail size={13} />A copy of this result is sent to {user.email}.</p>}
          </>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">Answers & explanations</h2>
          <div className="flex gap-1.5">{(['all', 'wrong', 'skipped', 'right'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`${filter === f ? 'btn-primary' : 'btn-ghost'} py-1.5 text-sm capitalize`}>{f}</button>))}</div>
        </div>
        <div className="mt-4 space-y-4">{list.map((r) => {
          const ok = r.chosen === r.answer; const skip = r.chosen == null;
          return (
            <div key={r.id} id={`q${r.idx}`} className={`card scroll-mt-24 border-l-4 p-5 ${skip ? 'border-l-slate-300' : ok ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Q{r.idx} · {r.section}{r.topic ? ` · ${r.topic}` : ''}</span>
                {ts[r.id] ? <span className="ms-auto flex items-center gap-1"><Timer size={12} />{fmt(ts[r.id])}</span> : null}<span className={skip ? 'chip' : ok ? 'chip-green' : 'chip-red'}>{skip ? 'Not answered' : ok ? 'Correct' : 'Wrong'}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-slate-900">{r.stem}</p>
              <ul className="mt-3 space-y-1.5">{r.options.map((o, i) => (
                <li key={i} className={`flex gap-2 rounded-lg px-3 py-2 text-sm ${i === r.answer ? 'bg-emerald-50 text-emerald-900' : i === r.chosen ? 'bg-rose-50 text-rose-900' : 'text-slate-700'}`}>
                  <b>{LETTERS[i]}.</b><span>{o}</span>{i === r.answer && <CheckCircle2 size={15} className="ms-auto shrink-0 text-emerald-600" />}{i === r.chosen && i !== r.answer && <XCircle size={15} className="ms-auto shrink-0 text-rose-600" />}
                </li>))}</ul>
              {r.explanation && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><b>Explanation: </b>{r.explanation}</p>}
              {typeof ex[r.id] === 'object' && (() => { const e = ex[r.id] as Ex; return (
                <div className="mt-3 space-y-2 rounded-lg border border-brand-100 bg-brand-50/60 p-3 text-sm text-slate-800">
                  {e.concept && <p><b>Concept: </b>{e.concept}</p>}
                  <div><b>Solution:</b><p className="mt-1 whitespace-pre-line">{e.working}</p></div>
                  {e.mistake && <p><b>Common mistake: </b>{e.mistake}</p>}
                  {e.tip && <p className="text-brand-800"><b>Exam tip: </b>{e.tip}</p>}
                </div>); })()}
              {typeof ex[r.id] === 'string' && <p className="mt-2 text-xs text-rose-600">{ex[r.id] as string}</p>}
              <div className="mt-2 flex items-center justify-between gap-2">
                {typeof ex[r.id] !== 'object' ? <button onClick={() => explain(r.id)} disabled={exBusy === r.id} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">{exBusy === r.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}Explain with AI</button> : <span />}
                <span>{reported.has(r.id) ? <span className="text-xs text-emerald-700">Thanks — our team will check it.</span>
                  : reporting === r.id ? (
                    <div className="flex flex-wrap justify-end gap-2"><input className="input max-w-sm py-1.5 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What’s wrong? e.g. option C is also correct" />
                      <button onClick={() => report(r.id)} className="btn-primary py-1.5 text-sm">Send</button></div>
                  ) : <button onClick={() => setReporting(r.id)} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600"><Flag size={12} />Report a problem</button>}</span>
              </div>
            </div>);
        })}</div>
      </section>
      <div className="mt-8 text-center"><Link href={`/mock-tests/${a.exam_slug}`} className="btn-primary"><RotateCcw size={16} />Take another {a.title}</Link></div>
    </div>
  );
}
