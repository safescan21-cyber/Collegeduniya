import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import Predictor from '../Predictor';
import RankFromMarks from '@/components/RankFromMarks';
import PercentileRank from '@/components/PercentileRank';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { readRange } from '@/lib/sitemapPlan';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts
const YEAR = new Date().getFullYear();

async function load(slug: string) {
  if (!hasSupabase) return null;
  const sb = supabasePublic();
  const { data: exam } = await sb.from('exams').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (!exam) return null;
  const cut = await readRange<any>((a, b) => sb.from('cutoffs').select('category, quota, home_state, year').eq('exam_slug', slug).range(a, b), 0, 20000);
  const { count: bands } = await sb.from('rank_bands').select('id', { count: 'exact', head: true }).eq('exam_slug', slug);
  const { data: bandCats } = await sb.from('rank_bands').select('category').eq('exam_slug', slug).limit(200);
  const { data: stats } = await sb.from('exam_stats').select('year, session, total_candidates, source').eq('exam_slug', slug).order('year', { ascending: false }).limit(20);
  const latest = cut.length ? Math.max(...cut.map((c) => c.year)) : null;
  const { data: top } = latest ? await sb.from('cutoffs').select('course, closing_rank, quota, colleges(name, slug, city)').eq('exam_slug', slug).eq('year', latest)
    .eq('category', 'General').order('closing_rank', { ascending: true }).limit(15) : { data: [] as any[] };
  return {
    exam, latest, bands: bands || 0, stats: (stats || []) as any[],
    categories: Array.from(new Set(['General', ...cut.map((c) => c.category)])),
    quotas: Array.from(new Set(cut.map((c) => c.quota).filter(Boolean))) as string[],
    states: Array.from(new Set(cut.map((c) => c.home_state).filter(Boolean))).sort() as string[],
    bandCategories: Array.from(new Set((bandCats || []).map((b: any) => b.category))) as string[],
    top: (top || []) as any[],
  };
}

export async function generateMetadata({ params }: { params: Promise<{ exam: string }> }): Promise<Metadata> {
  const d = await load((await params).exam);
  if (!d) return { title: 'Predictor not found' };
  const n = d.exam.short_name;
  return {
    title: `${n} College Predictor ${YEAR} — colleges for your rank${d.stats.length ? ` + ${n} percentile to rank` : d.bands ? ` + ${n} rank predictor` : ''}`,
    description: `Free ${n} college predictor: enter your rank, category and home state to see colleges and branches with a high, medium or low chance, from official ${d.latest || 'previous year'} closing ranks.`,
    alternates: { canonical: `/predictor/${d.exam.slug}` },
  };
}

export default async function ExamPredictor({ params }: { params: Promise<{ exam: string }> }) {
  const d = await load((await params).exam);
  if (!d) notFound();
  const { exam } = d;
  const hasCutoffs = d.latest != null;
  const faq = [
    { q: `How does the ${exam.short_name} college predictor work?`, a: `It compares your rank with the official closing ranks of ${d.latest || 'the previous year'} for your category, quota and home state. High chance means your rank is well inside last year's closing rank; Low means slightly beyond it (possible in later rounds).` },
    { q: 'Is the prediction guaranteed?', a: 'No. Cutoffs change every year with seats, applicants and paper difficulty. Use it to plan choice filling, and keep safe options.' },
    { q: 'Is it free?', a: 'Yes — no login or payment needed.' },
  ];
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };

  return (
    <div className="container-x py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/predictor" className="text-sm text-slate-500 hover:text-slate-800">← All predictors</Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{exam.short_name} College Predictor {YEAR}</h1>
      <p className="mt-1 text-slate-500">{exam.full_name}{exam.conducting_body ? ` · conducted by ${exam.conducting_body}` : ''}
        {exam.website && <> · <a href={exam.website} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-brand-700 underline">official site<ExternalLink size={12} /></a></>}</p>

      {(d.bands > 0 || d.stats.length > 0) && (
        <div className="mt-6 grid max-w-4xl gap-4 md:grid-cols-2">
          {d.stats.length > 0 && <PercentileRank examName={exam.short_name} stats={d.stats} />}
          {d.bands > 0 && <RankFromMarks exam={exam.slug} examName={exam.short_name} categories={d.bandCategories} />}
        </div>
      )}
      <p className="mt-3 text-sm"><Link href={`/papers?exam=${exam.slug}`} className="text-brand-700 underline">{exam.short_name} previous-year papers & answer keys</Link></p>

      <div className="mt-6">
        <Suspense fallback={<div className="card h-64 animate-pulse" />}>
          <Predictor hideHeader exams={hasCutoffs ? [{ slug: exam.slug, short_name: exam.short_name }] : []} categories={d.categories} quotas={d.quotas} states={d.states} />
        </Suspense>
      </div>

      {d.top.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">Hardest to get: lowest {exam.short_name} closing ranks ({d.latest}, General)</h2>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">College</th><th className="px-4 py-2">Course</th><th className="px-4 py-2">Quota</th><th className="px-4 py-2">Closing rank</th></tr></thead>
              <tbody>{d.top.map((t, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2"><Link href={`/colleges/${t.colleges?.slug}`} className="font-medium text-brand-700">{t.colleges?.name}</Link></td>
                  <td className="px-4 py-2">{t.course}</td><td className="px-4 py-2">{t.quota}</td><td className="px-4 py-2 font-semibold">{t.closing_rank.toLocaleString()}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl font-bold text-slate-900">Frequently asked</h2>
        <div className="mt-3 space-y-3">{faq.map((f) => <details key={f.q} className="card p-4"><summary className="cursor-pointer font-semibold">{f.q}</summary><p className="mt-2 text-sm text-slate-600">{f.a}</p></details>)}</div>
      </section>
    </div>
  );
}
