import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardCheck, Clock, ListChecks, Users, Sparkles, Timer, BarChart3, UsersRound, CheckCircle2 } from 'lucide-react';
import { EmptyState } from '@/components/Cards';
import MyAttempts from './MyAttempts';
import DailyQuestion from '@/components/mock/DailyQuestion';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Free online mock tests — JEE, NEET, CUET, CAT, SSC, Banking, UPSC, Railways & more',
  description: 'Free full-length, sectional and topic-wise mock tests with real exam timing and marking. All-India rank, AI explanations, time analysis, study groups and a daily practice question.',
  alternates: { canonical: '/mock-tests' },
};

type Row = { exam_slug: string; short_name: string; full_name: string; stream: string | null; country: string | null; title: string; duration_min: number; questions: number; full_tests: number; sectional_tests: number; topic_tests: number; attempts: number };
const ORDER = ['Engineering', 'Medical', 'Management', 'Law', 'All streams', 'Government jobs', 'Banking', 'Civil services', 'Defence', 'Teaching', 'School', 'English test'];
const n = (x: number | string) => Number(x).toLocaleString('en-IN');

function Card({ r }: { r: Row }) {
  const tests = Number(r.full_tests) + Number(r.sectional_tests) + Number(r.topic_tests);
  return (
    <Link href={`/mock-tests/${r.exam_slug}`} className="card flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-lg font-bold text-slate-900">{r.short_name}</p>
      <p className="line-clamp-1 text-sm text-slate-500">{r.full_name}</p>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1"><ListChecks size={13} />{r.questions} Qs</span>
        <span className="flex items-center gap-1"><Clock size={13} />{r.duration_min} min</span>
        {Number(r.attempts) > 0 && <span className="flex items-center gap-1"><Users size={13} />{n(r.attempts)} attempts</span>}
      </div>
      <p className="mt-2 text-xs text-slate-500">{Number(r.full_tests)} full · {Number(r.sectional_tests)} sectional · {Number(r.topic_tests)} topic tests</p>
      <span className="btn-primary mt-4 py-2 text-sm">{tests ? `View ${tests} free tests` : 'Start free mock test'}</span>
    </Link>
  );
}

export default async function MockTests() {
  let rows: Row[] = []; let stats: any = null;
  if (hasSupabase) {
    const sb = supabasePublic();
    const [c, s] = await Promise.all([sb.rpc('mock_catalog_v2'), sb.rpc('mock_stats')]);
    rows = ((c.data || []) as Row[]).filter((r) => Number(r.full_tests) + Number(r.sectional_tests) + Number(r.topic_tests) > 0);
    stats = (s.data as any[])?.[0] || null;
  }
  const groups = new Map<string, Row[]>();
  for (const r of rows) { const k = r.country !== 'India' && r.stream !== 'English test' ? 'Study abroad' : r.stream || 'Other'; groups.set(k, [...(groups.get(k) || []), r]); }
  const cats = Array.from(groups.keys()).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  const popular = rows.slice().sort((a, b) => Number(b.attempts) - Number(a.attempts)).slice(0, 8);
  return (
    <div>
      <section className="bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 text-white">
        <div className="container-x grid gap-10 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="chip bg-white/10 text-white">100% free · no payment card · works on any phone</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Free mock tests that show you <span className="text-amber-300">exactly where to improve</span></h1>
            <p className="mt-4 max-w-xl text-brand-100">Real exam timing and marking, an All-India rank, AI explanations for every question, time analysis and a personal study plan.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {popular.slice(0, 6).map((r) => <Link key={r.exam_slug} href={`/mock-tests/${r.exam_slug}`} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20">{r.short_name}</Link>)}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#exams" className="btn bg-amber-400 font-bold text-slate-900 hover:bg-amber-300">Start a free test</a>
              <Link href="/mock-tests/groups" className="btn bg-white/10 text-white hover:bg-white/20"><UsersRound size={17} />Study groups</Link>
            </div>
          </div>
          <div className="text-slate-900"><DailyQuestion /></div>
        </div>
        {stats && (
          <div className="border-t border-white/10 bg-black/10">
            <div className="container-x grid grid-cols-2 gap-4 py-5 text-center sm:grid-cols-4">
              {[[stats.papers, 'free tests'], [stats.tests_completed, 'tests completed'], [stats.questions_answered, 'questions answered'], [stats.aspirants, 'registered aspirants']].map(([v, l]) => (
                <div key={l as string}><p className="text-2xl font-extrabold">{n(v)}</p><p className="text-xs text-brand-200">{l}</p></div>))}
            </div>
          </div>
        )}
      </section>

      <div className="container-x py-10">
        <MyAttempts />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[[Timer, 'Real exam feel', 'Timer, question palette, mark for review, exam marking'], [Sparkles, 'AI explanations', 'Concept, step-by-step working and the common mistake'],
            [BarChart3, 'Rank & time analysis', 'All-India rank, section scores, time per question'], [CheckCircle2, 'Full, sectional & topic', 'Practise a whole paper, one section or one topic']].map(([I, t, d]) => {
            const Icon = I as any;
            return <div key={t as string} className="card p-5"><Icon className="text-brand-600" /><p className="mt-2 font-bold text-slate-900">{t as string}</p><p className="mt-1 text-sm text-slate-500">{d as string}</p></div>;
          })}
        </div>

        <div id="exams" className="scroll-mt-24">
          {rows.length === 0 ? <div className="mt-10"><EmptyState icon={<ClipboardCheck size={28} />} title="Mock tests are being prepared" text="Question banks are being built for every exam. Check back soon." /></div> : (
            <>
              <nav className="sticky top-16 z-20 -mx-4 mt-10 flex gap-2 overflow-x-auto bg-slate-50/90 px-4 py-3 backdrop-blur">
                {cats.map((c) => <a key={c} href={`#cat-${c.replace(/\W+/g, '-')}`} className="chip whitespace-nowrap hover:bg-brand-50">{c} ({groups.get(c)!.length})</a>)}
              </nav>
              {cats.map((c) => (
                <section key={c} id={`cat-${c.replace(/\W+/g, '-')}`} className="mt-8 scroll-mt-32">
                  <h2 className="text-xl font-bold text-slate-900">{c} mock tests</h2>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{groups.get(c)!.map((r) => <Card key={r.exam_slug} r={r} />)}</div>
                </section>
              ))}
            </>
          )}
        </div>
        <p className="mt-10 max-w-3xl text-xs text-slate-400">Practice questions are original, written in the style of each exam with AI help and checked by our team. They are not official papers, and practice scores do not predict real results. Found a mistake? Report it from the answer review.</p>
      </div>
    </div>
  );
}
