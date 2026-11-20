import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { EmptyState } from '@/components/Cards';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import type { Exam } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Entrance exams — eligibility, pattern, dates & colleges',
  description: 'JEE, NEET, CUET, CAT, GATE, IELTS and more: eligibility, exam pattern, official websites and colleges that accept each exam.',
};
type SP = Record<string, string | undefined>;
const LEVELS = ['UG', 'PG', 'Abroad'];

export default async function ExamsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  let exams: Exam[] = [];
  if (hasSupabase) {
    let q = supabasePublic().from('exams').select('*').eq('is_published', true).order('short_name');
    if (sp.level) q = q.eq('level', sp.level);
    if (sp.stream) q = q.eq('stream', sp.stream);
    exams = ((await q).data || []) as Exam[];
  }
  const streams = Array.from(new Set(exams.map((e) => e.stream).filter(Boolean))) as string[];
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><BookOpen className="text-brand-600" />Entrance exams</h1>
      <p className="mt-1 text-slate-500">Eligibility, pattern and the colleges that accept each exam. Always confirm dates on the official website.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/exams" className={!sp.level && !sp.stream ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>All</Link>
        {LEVELS.map((l) => <Link key={l} href={`/exams?level=${l}`} className={sp.level === l ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>{l}</Link>)}
        {streams.map((s) => <Link key={s} href={`/exams?stream=${encodeURIComponent(s)}`} className={sp.stream === s ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>{s}</Link>)}
      </div>
      {exams.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((e) => (
            <Link key={e.id} href={`/exams/${e.slug}`} className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between"><span className="chip-brand">{e.stream || 'General'}</span><span className="chip">{e.level}</span></div>
              <h2 className="mt-3 text-xl font-extrabold text-slate-900 group-hover:text-brand-700">{e.short_name}</h2>
              <p className="text-sm text-slate-500">{e.full_name}</p>
              <p className="mt-3 line-clamp-2 text-sm text-slate-600">{e.description}</p>
              <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-brand-700">Details <ArrowRight size={14} /></span>
            </Link>
          ))}
        </div>
      ) : <div className="mt-6"><EmptyState title="No exams added yet" /></div>}
    </div>
  );
}
