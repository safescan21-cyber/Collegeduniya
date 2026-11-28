import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, ExternalLink, CheckCircle2, Lightbulb, CalendarDays, Target } from 'lucide-react';
import { prepFor, PREP } from '@/lib/prepMaterial';

// Free study material (original notes) for exams that have it: /exams/cat/study-material, /exams/gmat/study-material
export function generateStaticParams() { return Object.keys(PREP).map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = prepFor((await params).slug);
  if (!p) return {};
  return { title: `${p.exam} free study material — notes, formulas, solved questions`, description: p.intro.slice(0, 155),
    alternates: { canonical: `/exams/${p.slug}/study-material` } };
}

export default async function StudyMaterial({ params }: { params: Promise<{ slug: string }> }) {
  const p = prepFor((await params).slug);
  if (!p) notFound();
  return (
    <div className="container-x space-y-6 py-8">
      <nav className="text-sm text-slate-500"><Link href="/exams" className="hover:underline">Exams</Link> › <Link href={`/exams/${p.slug}`} className="hover:underline">{p.exam}</Link> › Study material</nav>
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900"><BookOpen className="text-brand-600" />{p.title}</h1>
        <p className="max-w-3xl text-slate-600">{p.intro}</p>
        <div className="flex flex-wrap gap-2 pt-1 text-sm">
          {p.sections.map((s) => <a key={s.short} href={`#${s.short}`} className="chip hover:bg-brand-50">{s.name}</a>)}
          <a href="#plan" className="chip hover:bg-brand-50">Study plan</a><a href="#free" className="chip hover:bg-brand-50">Free official tests</a>
        </div>
      </header>

      <section className="card overflow-hidden">
        <h2 className="p-5 pb-3 text-xl font-bold text-slate-900">{p.exam} exam pattern</h2>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Section</th><th className="px-4 py-2">Questions</th><th className="px-4 py-2">Time</th><th className="px-4 py-2">What it tests</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{p.pattern.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`px-4 py-2 ${i === 0 ? 'font-medium text-slate-900' : 'text-slate-600'}`}>{c}</td>)}</tr>)}</tbody>
        </table></div>
        <ul className="space-y-1 p-5 pt-3 text-sm text-slate-600">{p.pattern.notes.map((n) => <li key={n}>• {n}</li>)}
          <li className="pt-1">Source: <a href={p.pattern.source.href} target="_blank" rel="noopener nofollow" className="text-brand-700 hover:underline">{p.pattern.source.label}</a></li></ul>
      </section>

      {p.sections.map((s) => (
        <section key={s.short} id={s.short} className="card scroll-mt-24 space-y-5 p-6">
          <div><h2 className="text-2xl font-bold text-slate-900">{s.name} ({s.short})</h2><p className="mt-1 text-slate-600">{s.about}</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            {s.topics.map((t) => (
              <div key={t.title} className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">{t.title}</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-700">{t.points.map((x) => <li key={x} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />{x}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <h3 className="flex items-center gap-1.5 font-semibold text-amber-900"><Lightbulb size={16} />Strategy</h3>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">{s.strategy.map((x) => <li key={x}>• {x}</li>)}</ul>
          </div>
          <div>
            <h3 className="flex items-center gap-1.5 font-semibold text-slate-900"><Target size={16} className="text-brand-600" />Solved practice questions</h3>
            <ol className="mt-3 space-y-3">
              {s.practice.map((q, i) => (
                <li key={i} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <p className="font-medium text-slate-900">{i + 1}. {q.q}</p>
                  {q.options && <ul className="mt-2 grid gap-1 sm:grid-cols-2">{q.options.map((o, j) => <li key={o} className="text-slate-600">{String.fromCharCode(65 + j)}. {o}</li>)}</ul>}
                  <details className="mt-2"><summary className="cursor-pointer font-semibold text-brand-700">Show answer</summary>
                    <p className="mt-2"><b>Answer:</b> {q.answer}</p><p className="text-slate-600">{q.solution}</p></details>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ))}

      <section id="plan" className="card scroll-mt-24 p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><CalendarDays size={20} className="text-brand-600" />Study plan</h2>
        <ol className="mt-3 space-y-2">{p.plan.map((w) => <li key={w.week} className="text-sm"><span className="font-semibold text-slate-900">{w.week}:</span> <span className="text-slate-700">{w.focus}</span></li>)}</ol>
      </section>

      <section id="free" className="card scroll-mt-24 p-6">
        <h2 className="text-xl font-bold text-slate-900">Free official practice tests & links</h2>
        <ul className="mt-3 space-y-3">{p.free.map((f) => (
          <li key={f.href} className="text-sm">
            {f.href.startsWith('/') ? <Link href={f.href} className="font-semibold text-brand-700 hover:underline">{f.label}</Link>
              : <a href={f.href} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">{f.label}<ExternalLink size={12} /></a>}
            <span className="block text-slate-600">{f.note}</span>
          </li>))}</ul>
        <p className="mt-4 text-xs text-slate-400">Notes written by Collegeolo. Exam pattern checked {p.checked} against the official sources linked above — rules can change, so confirm on the official website.</p>
      </section>
    </div>
  );
}
