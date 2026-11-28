'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, CheckCircle2, XCircle } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

type Q = { id: string; exam_slug: string; exam: string; section: string; topic: string | null; stem: string; options: string[]; day: string };
const L = 'ABCDEF';

// Question of the day — no login, the answer comes from the database only after you pick
export default function DailyQuestion({ exam }: { exam?: string }) {
  const sb = supabaseBrowser();
  const [q, setQ] = useState<Q | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [res, setRes] = useState<{ correct: boolean; answer: number; explanation: string | null } | null>(null);
  useEffect(() => {
    sb.rpc('daily_question', { p_exam: exam || null }).then(({ data }: { data: Q[] | null }) => {
      const d = data?.[0]; if (!d) return;
      setQ(d);
      try { const saved = JSON.parse(localStorage.getItem(`ses-dq-${d.id}`) || 'null'); if (saved) { setPick(saved.pick); setRes(saved.res); } } catch { /* ignore */ }
    });
  }, [sb, exam]);
  if (!q) return null;
  const answer = async (i: number) => {
    if (res) return;
    setPick(i);
    const { data } = await sb.rpc('check_daily', { p_question: q.id, p_choice: i, p_exam: exam || null });
    const r = data?.[0]; if (!r) return;
    setRes(r);
    try { localStorage.setItem(`ses-dq-${q.id}`, JSON.stringify({ pick: i, res: r })); } catch { /* ignore */ }
  };
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold text-slate-900"><CalendarCheck size={18} className="text-brand-600" />Question of the day</p>
        <span className="chip-brand">{q.exam} · {q.topic || q.section}</span>
      </div>
      <p className="mt-3 whitespace-pre-line text-slate-900">{q.stem}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{q.options.map((o, i) => {
        const state = !res ? '' : i === res.answer ? 'border-emerald-500 bg-emerald-50' : i === pick ? 'border-rose-400 bg-rose-50' : 'opacity-60';
        return (
          <button key={i} disabled={!!res} onClick={() => answer(i)}
            className={`flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-left text-sm transition hover:border-brand-400 ${state}`}>
            <b className="text-slate-500">{L[i]}.</b><span>{o}</span>
            {res && i === res.answer && <CheckCircle2 size={16} className="ms-auto shrink-0 text-emerald-600" />}
            {res && i === pick && i !== res.answer && <XCircle size={16} className="ms-auto shrink-0 text-rose-600" />}
          </button>);
      })}</div>
      {res && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
          <p className={`font-semibold ${res.correct ? 'text-emerald-700' : 'text-rose-700'}`}>{res.correct ? 'Correct! 🎉' : `Not quite — the answer is ${L[res.answer]}.`}</p>
          {res.explanation && <p className="mt-1 text-slate-700">{res.explanation}</p>}
          <Link href={`/mock-tests/${q.exam_slug}`} className="mt-2 inline-block font-semibold text-brand-700 underline">Practise more {q.exam} →</Link>
        </div>
      )}
    </section>
  );
}
