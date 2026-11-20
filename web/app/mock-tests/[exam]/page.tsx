import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, ListChecks, ShieldCheck, ExternalLink, FileStack } from 'lucide-react';
import StartTest from './StartTest';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const revalidate = 600;

async function load(slug: string) {
  if (!hasSupabase) return null;
  const sb = supabasePublic();
  const [{ data: bp }, { data: exam }] = await Promise.all([
    sb.from('mock_blueprints').select('*').eq('exam_slug', slug).eq('is_published', true).maybeSingle(),
    sb.from('exams').select('slug, short_name, full_name, conducting_body, website, country').eq('slug', slug).maybeSingle(),
  ]);
  if (!bp || !exam) return null;
  const { data: cat } = await sb.rpc('mock_catalog');
  const row = ((cat || []) as any[]).find((r) => r.exam_slug === slug);
  return { bp, exam, ready: Number(row?.ready_questions || 0), attempts: Number(row?.attempts || 0) };
}

export async function generateMetadata({ params }: { params: Promise<{ exam: string }> }): Promise<Metadata> {
  const d = await load((await params).exam);
  if (!d) return { title: 'Mock test not found' };
  return {
    title: `${d.exam.short_name} mock test ${new Date().getFullYear()} — free online test with analysis`,
    description: `Free ${d.exam.short_name} mock test: ${d.bp.sections.reduce((s: number, x: any) => s + x.questions, 0)} questions, ${d.bp.duration_min} minutes, exam-style marking. Instant score, percentile, topic-wise analysis and a study plan.`,
    alternates: { canonical: `/mock-tests/${d.exam.slug}` },
  };
}

export default async function MockExam({ params }: { params: Promise<{ exam: string }> }) {
  const d = await load((await params).exam);
  if (!d) notFound();
  const { bp, exam } = d;
  const total = bp.sections.reduce((s: number, x: any) => s + x.questions, 0);
  const maxMarks = bp.sections.reduce((s: number, x: any) => s + x.questions * x.correct, 0);
  return (
    <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <Link href="/mock-tests" className="text-sm text-slate-500 hover:underline">← All mock tests</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{bp.title}</h1>
        <p className="mt-1 text-slate-500">{exam.full_name}{exam.conducting_body ? ` · exam by ${exam.conducting_body}` : ''}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="card flex items-center gap-3 p-4"><ListChecks className="text-brand-600" /><div><p className="text-xs text-slate-500">Questions</p><p className="font-bold">{total}</p></div></div>
          <div className="card flex items-center gap-3 p-4"><Clock className="text-brand-600" /><div><p className="text-xs text-slate-500">Duration</p><p className="font-bold">{bp.duration_min} min</p></div></div>
          <div className="card flex items-center gap-3 p-4"><ShieldCheck className="text-brand-600" /><div><p className="text-xs text-slate-500">Maximum marks</p><p className="font-bold">{maxMarks}</p></div></div>
        </div>
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Section</th><th className="px-4 py-2">Questions</th><th className="px-4 py-2">Correct</th><th className="px-4 py-2">Wrong</th><th className="px-4 py-2">Topics</th></tr></thead>
            <tbody>{bp.sections.map((s: any) => (
              <tr key={s.name} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2 font-medium">{s.name}</td><td className="px-4 py-2">{s.questions}</td>
                <td className="px-4 py-2 text-emerald-700">+{s.correct}</td><td className="px-4 py-2 text-rose-600">{s.wrong || 0}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{(s.topics || []).slice(0, 12).join(', ')}{(s.topics || []).length > 12 ? '…' : ''}</td>
              </tr>))}</tbody>
          </table>
        </div>
        {bp.instructions && <div className="card mt-6 p-5"><h2 className="font-bold text-slate-900">Instructions</h2><p className="mt-2 whitespace-pre-line text-sm text-slate-600">{bp.instructions}</p></div>}
        <p className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link href={`/papers?exam=${exam.slug}`} className="flex items-center gap-1 text-brand-700 underline"><FileStack size={14} />Official previous-year papers</Link>
          {exam.website && <a href={exam.website} target="_blank" rel="noopener" className="flex items-center gap-1 text-brand-700 underline"><ExternalLink size={14} />Official website</a>}
        </p>
      </div>
      <aside><div className="lg:sticky lg:top-24"><StartTest slug={exam.slug} ready={d.ready} needed={total} attempts={d.attempts} /></div></aside>
    </div>
  );
}
