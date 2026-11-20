import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardCheck, Clock, ListChecks, Users } from 'lucide-react';
import { EmptyState } from '@/components/Cards';
import MyAttempts from './MyAttempts';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const revalidate = 600;
export const metadata: Metadata = {
  title: 'Free mock tests for JEE, NEET, CUET, CAT, GATE, IELTS, SAT & more — with instant analysis',
  description: 'Take free full-length online mock tests for Indian and international exams. Exam-style timing and marking, instant score, percentile, topic-wise analysis and a study plan by email.',
  alternates: { canonical: '/mock-tests' },
};

type Row = { exam_slug: string; short_name: string; full_name: string; stream: string | null; level: string | null; country: string | null; title: string; duration_min: number; questions: number; sections: number; ready_questions: number; attempts: number };

function Card({ r }: { r: Row }) {
  return (
    <Link href={`/mock-tests/${r.exam_slug}`} className="card flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap gap-1.5">{r.stream && <span className="chip-brand">{r.stream}</span>}{r.level && r.level !== 'Other' && <span className="chip">{r.level}</span>}</div>
      <p className="mt-2 text-lg font-bold text-slate-900">{r.short_name}</p>
      <p className="line-clamp-1 text-sm text-slate-500">{r.full_name}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1"><ListChecks size={13} />{r.questions} Qs</span>
        <span className="flex items-center gap-1"><Clock size={13} />{r.duration_min} min</span>
        {Number(r.attempts) > 0 && <span className="flex items-center gap-1"><Users size={13} />{Number(r.attempts).toLocaleString()} attempts</span>}
      </div>
      <span className="btn-primary mt-4 py-2 text-sm">Start free mock test</span>
    </Link>
  );
}

export default async function MockTests() {
  const rows = hasSupabase ? (((await supabasePublic().rpc('mock_catalog')).data || []) as Row[]).filter((r) => Number(r.ready_questions) > 0) : [];
  const india = rows.filter((r) => r.country === 'India');
  const world = rows.filter((r) => r.country !== 'India');
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><ClipboardCheck className="text-brand-600" />Free mock tests</h1>
      <p className="mt-1 max-w-3xl text-slate-500">Exam-style timing and marking. Get your score, percentile, section- and topic-wise analysis, and a personal study plan — on screen and by email.</p>
      <MyAttempts />
      {rows.length === 0 ? <div className="mt-8"><EmptyState icon={<ClipboardCheck size={28} />} title="Mock tests are being prepared" text="Our team is building question banks for each exam. Check back soon." /></div> : (
        <>
          {india.length > 0 && <section className="mt-10"><h2 className="text-xl font-bold text-slate-900">Indian exams</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{india.map((r) => <Card key={r.exam_slug} r={r} />)}</div></section>}
          {world.length > 0 && <section className="mt-10"><h2 className="text-xl font-bold text-slate-900">International exams</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{world.map((r) => <Card key={r.exam_slug} r={r} />)}</div></section>}
        </>
      )}
      <p className="mt-10 max-w-3xl text-xs text-slate-400">Practice questions are original, written with AI help and checked by our team. They follow each exam’s published pattern, but they are not official papers and your score here does not predict your real result. Found a mistake? Report it from the answer review.</p>
    </div>
  );
}
