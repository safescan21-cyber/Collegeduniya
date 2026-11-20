'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, Target, TrendingUp, Sparkles, CheckCircle2, XCircle, MinusCircle, Flag, Loader2, RotateCcw, Mail } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { api } from '@/lib/api';

type Fb = { summary: string; strengths: string[]; weaknesses: string[]; plan: string[]; ai: boolean };
type R = { idx: number; id: string; section: string; topic: string | null; stem: string; options: string[]; answer: number; chosen: number | null; explanation: string | null };
const LETTERS = 'ABCDEF';
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

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(`/login?next=/mock-tests/result/${id}`); return; }
    (async () => {
      const { data } = await sb.from('mock_attempts').select('*').eq('id', id).maybeSingle();
      if (!data) { setErr('Result not found.'); return; }
      if (data.status !== 'submitted') { router.replace(`/mock-tests/attempt/${id}`); return; }
      setA(data);
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

  if (err) return <div className="container-x py-20 text-center text-rose-600">{err}</div>;
  if (!a) return <div className="container-x py-10"><div className="card h-96 animate-pulse" /></div>;
  const attempted = a.correct + a.wrong;
  const accuracy = attempted ? Math.round((100 * a.correct) / attempted) : 0;
  const mins = Math.max(1, Math.round((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 60000));
  const list = rev.filter((r) => filter === 'all' || (filter === 'skipped' ? r.chosen == null : filter === 'right' ? r.chosen === r.answer : r.chosen != null && r.chosen !== r.answer));

  return (
    <div className="container-x py-10">
      <Link href="/mock-tests" className="text-sm text-slate-500 hover:underline">← All mock tests</Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{a.title} — result</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="card bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white md:col-span-1">
          <p className="flex items-center gap-1.5 text-sm text-brand-100"><Trophy size={15} />Score</p>
          <p className="mt-1 text-4xl font-extrabold">{n(a.score)}<span className="text-lg font-semibold text-brand-200"> / {n(a.max_score)}</span></p>
          <p className="mt-1 text-sm text-brand-100">{n(a.percentile)} percentile on StudyEarnstay</p>
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
            <div key={r.id} className={`card border-l-4 p-5 ${skip ? 'border-l-slate-300' : ok ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Q{r.idx} · {r.section}{r.topic ? ` · ${r.topic}` : ''}</span>
                <span className={skip ? 'chip' : ok ? 'chip-green' : 'chip-red'}>{skip ? 'Not answered' : ok ? 'Correct' : 'Wrong'}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-slate-900">{r.stem}</p>
              <ul className="mt-3 space-y-1.5">{r.options.map((o, i) => (
                <li key={i} className={`flex gap-2 rounded-lg px-3 py-2 text-sm ${i === r.answer ? 'bg-emerald-50 text-emerald-900' : i === r.chosen ? 'bg-rose-50 text-rose-900' : 'text-slate-700'}`}>
                  <b>{LETTERS[i]}.</b><span>{o}</span>{i === r.answer && <CheckCircle2 size={15} className="ms-auto shrink-0 text-emerald-600" />}{i === r.chosen && i !== r.answer && <XCircle size={15} className="ms-auto shrink-0 text-rose-600" />}
                </li>))}</ul>
              {r.explanation && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><b>Explanation: </b>{r.explanation}</p>}
              <div className="mt-2 text-right">
                {reported.has(r.id) ? <span className="text-xs text-emerald-700">Thanks — our team will check it.</span>
                  : reporting === r.id ? (
                    <div className="flex flex-wrap justify-end gap-2"><input className="input max-w-sm py-1.5 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What’s wrong? e.g. option C is also correct" />
                      <button onClick={() => report(r.id)} className="btn-primary py-1.5 text-sm">Send</button></div>
                  ) : <button onClick={() => setReporting(r.id)} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600"><Flag size={12} />Report a problem</button>}
              </div>
            </div>);
        })}</div>
      </section>
      <div className="mt-8 text-center"><Link href={`/mock-tests/${a.exam_slug}`} className="btn-primary"><RotateCcw size={16} />Take another {a.title}</Link></div>
    </div>
  );
}
