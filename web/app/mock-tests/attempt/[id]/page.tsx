'use client';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ChevronLeft, ChevronRight, Flag, Loader2, Send, Eraser, Lightbulb } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { api } from '@/lib/api';

type Q = { idx: number; id: string; section: string; topic: string | null; stem: string; options: string[] };
type Attempt = { id: string; title: string; status: string; deadline: string; answers: Record<string, number>; sections: { name: string; correct: number; wrong: number }[]; time_spent: Record<string, number>; practice: boolean; hints_used: number };

const fmt = (s: number) => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const LETTERS = 'ABCDEF';

export default function TakeTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [att, setAtt] = useState<Attempt | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [cur, setCur] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'offline'>('saved');
  const dirty = useRef(false);
  const times = useRef<Record<string, number>>({});        // seconds per question
  const [hints, setHints] = useState<Record<string, string>>({});
  const [hintBusy, setHintBusy] = useState(false); const [hintsLeft, setHintsLeft] = useState(3);
  const submittedRef = useRef(false);
  const KEY = `ses-mock-${id}`;

  // load
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(`/login?next=/mock-tests/attempt/${id}`); return; }
    (async () => {
      const { data: a } = await sb.from('mock_attempts').select('id, title, status, deadline, answers, sections, time_spent, practice, hints_used').eq('id', id).maybeSingle();
      if (!a) { setErr('Test not found.'); return; }
      if (a.status === 'submitted') { router.replace(`/mock-tests/result/${id}`); return; }
      const { data: q, error } = await sb.rpc('attempt_questions', { p_attempt: id });
      if (error) { setErr(error.message); return; }
      let local: { answers?: Record<string, number>; marked?: string[]; times?: Record<string, number> } = {};
      try { local = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* ignore */ }
      setAtt(a as Attempt);
      setQs((q || []) as Q[]);
      setAnswers({ ...(a.answers || {}), ...(local.answers || {}) });
      setMarked(new Set(local.marked || []));
      times.current = { ...(a.time_spent || {}), ...(local.times || {}) };
      setHintsLeft(Math.max(0, 3 - (a.hints_used || 0)));
    })();
  }, [user, loading, id, sb, router, KEY]);

  const roundTimes = () => Object.fromEntries(Object.entries(times.current).map(([k, v]) => [k, Math.round(v)]));
  const save = useCallback(async () => {
    if (!dirty.current || submittedRef.current) return;
    dirty.current = false; setSaved('saving');
    const { error } = await sb.rpc('save_mock_progress', { p_attempt: id, p_answers: answers, p_time: roundTimes() });
    if (error) { dirty.current = true; setSaved('offline'); } else setSaved('saved');
  }, [sb, id, answers]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true; setSubmitting(true);
    const { error } = await sb.rpc('finish_mock', { p_attempt: id, p_answers: answers, p_time: roundTimes() });
    if (error) { submittedRef.current = false; setSubmitting(false); setErr(error.message); return; }
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    api(`/api/mock/attempts/${id}/finish`, { method: 'POST' }).catch(() => undefined);   // feedback + email in the background
    router.replace(`/mock-tests/result/${id}`);
  }, [sb, id, answers, router, KEY]);

  // timer (server deadline is the truth)
  useEffect(() => {
    if (!att) return;
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(att.deadline).getTime() - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [att, submit]);

  // autosave every 20 s + local backup on every change
  useEffect(() => { const t = setInterval(save, 20000); return () => clearInterval(t); }, [save]);
  useEffect(() => {
    if (!att) return;
    try { localStorage.setItem(KEY, JSON.stringify({ answers, marked: Array.from(marked), times: times.current })); } catch { /* ignore */ }
  }, [answers, marked, att, KEY]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (!submittedRef.current) { save(); e.preventDefault(); } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save]);

  const q = qs[cur];
  useEffect(() => { if (q) setVisited((v) => (v.has(q.id) ? v : new Set(v).add(q.id))); }, [q]);
  // count seconds on the visible question (paused when the tab is hidden)
  useEffect(() => {
    if (!q) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') { times.current[q.id] = (times.current[q.id] || 0) + 1; if (Math.round(times.current[q.id]) % 15 === 0) dirty.current = true; } }, 1000);
    return () => clearInterval(t);
  }, [q]);
  const askHint = async () => {
    if (!q || hints[q.id]) return;
    setHintBusy(true);
    try { const r = await api<{ hint: string; left: number }>(`/api/mock/attempts/${id}/hint`, { method: 'POST', body: JSON.stringify({ question_id: q.id }) }); setHints((h) => ({ ...h, [q.id]: r.hint })); setHintsLeft(r.left); }
    catch (e: any) { setHints((h) => ({ ...h, [q.id]: e.message })); }
    setHintBusy(false);
  };
  const sections = useMemo(() => Array.from(new Set(qs.map((x) => x.section))), [qs]);
  const pick = (opt: number | null) => {
    if (!q) return;
    setAnswers((a) => { const n = { ...a }; if (opt === null) delete n[q.id]; else n[q.id] = opt; return n; });
    dirty.current = true; setSaved('saving');
  };
  const toggleMark = () => q && setMarked((m) => { const n = new Set(m); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; });
  const answered = Object.keys(answers).filter((k) => qs.some((x) => x.id === k)).length;

  if (err) return <div className="container-x py-20 text-center"><p className="text-rose-600">{err}</p></div>;
  if (!att || !q || left === null) return <div className="container-x py-10"><div className="card h-96 animate-pulse" /></div>;
  const mark = att.sections.find((s) => s.name === q.section);
  const status = (x: Q) => marked.has(x.id) ? (answers[x.id] !== undefined ? 'bg-violet-600 text-white ring-2 ring-emerald-400' : 'bg-violet-600 text-white')
    : answers[x.id] !== undefined ? 'bg-emerald-600 text-white' : visited.has(x.id) ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600';

  return (
    <div className="container-x py-6">
      <div className="card sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 p-3">
        <p className="min-w-0 truncate font-bold text-slate-900">{att.title}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{saved === 'saving' ? 'Saving…' : saved === 'offline' ? 'Offline — saved on this device' : 'All answers saved'}</span>
          <span className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-lg font-bold ${left < 300 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-800'}`}><Clock size={18} />{fmt(left)}</span>
          <button onClick={() => { save(); setConfirm(true); }} className="btn-primary"><Send size={16} />Submit</button>
        </div>
      </div>

      {sections.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{sections.map((s) => (
          <button key={s} onClick={() => setCur(qs.findIndex((x) => x.section === s))} className={`${q.section === s ? 'btn-primary' : 'btn-ghost'} whitespace-nowrap py-1.5 text-sm`}>{s}</button>
        ))}</div>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-800">Question {cur + 1} of {qs.length}</span>
            <span>{q.section}{mark ? ` · +${mark.correct}${mark.wrong ? ` / ${mark.wrong}` : ''}` : ''}</span>
          </div>
          <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-slate-900">{q.stem}</p>
          <div className="mt-5 space-y-2.5">
            {q.options.map((o, i) => (
              <button key={i} onClick={() => pick(i)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${answers[q.id] === i ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${answers[q.id] === i ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{LETTERS[i]}</span>
                <span className="pt-0.5 text-slate-800">{o}</span>
              </button>
            ))}
          </div>
          {hints[q.id] && <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><Lightbulb size={16} className="mt-0.5 shrink-0" />{hints[q.id]}</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              {att.practice && !hints[q.id] && hintsLeft > 0 && <button onClick={askHint} disabled={hintBusy} className="btn-ghost text-sm text-amber-700">{hintBusy ? <Loader2 size={15} className="animate-spin" /> : <Lightbulb size={15} />}AI hint ({hintsLeft} left)</button>}
              <button onClick={toggleMark} className={`btn-ghost text-sm ${marked.has(q.id) ? 'text-violet-700' : ''}`}><Flag size={15} />{marked.has(q.id) ? 'Unmark' : 'Mark for review'}</button>
              {answers[q.id] !== undefined && <button onClick={() => pick(null)} className="btn-ghost text-sm"><Eraser size={15} />Clear</button>}
            </div>
            <div className="flex gap-2">
              <button disabled={cur === 0} onClick={() => setCur(cur - 1)} className="btn-ghost"><ChevronLeft size={16} />Previous</button>
              <button disabled={cur === qs.length - 1} onClick={() => { save(); setCur(cur + 1); }} className="btn-primary">Save & next<ChevronRight size={16} /></button>
            </div>
          </div>
        </section>

        <aside className="card h-fit p-4 lg:sticky lg:top-36">
          <p className="text-sm font-semibold text-slate-900">{answered} answered · {qs.length - answered} left</p>
          {sections.map((s) => (
            <div key={s} className="mt-3">
              {sections.length > 1 && <p className="mb-1.5 text-xs font-semibold uppercase text-slate-400">{s}</p>}
              <div className="grid grid-cols-8 gap-1.5">
                {qs.map((x, i) => x.section === s && (
                  <button key={x.id} onClick={() => setCur(i)} aria-label={`Question ${i + 1}`}
                    className={`h-8 rounded-md text-xs font-semibold ${status(x)} ${i === cur ? 'outline outline-2 outline-offset-1 outline-slate-800' : ''}`}>{i + 1}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-1.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-emerald-600" />Answered</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-rose-100" />Not answered</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-violet-600" />Marked</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-slate-100" />Not visited</span>
          </div>
        </aside>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={() => !submitting && setConfirm(false)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold text-slate-900">Submit the test?</p>
            <p className="mt-2 text-sm text-slate-600">{answered} answered, {qs.length - answered} unanswered{marked.size ? `, ${marked.size} marked for review` : ''}. You can’t change answers after submitting.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirm(false)} disabled={submitting} className="btn-ghost flex-1">Keep going</button>
              <button onClick={submit} disabled={submitting} className="btn-primary flex-1">{submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
