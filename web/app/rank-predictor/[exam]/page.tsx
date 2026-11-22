import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ExternalLink } from 'lucide-react';
import RankFromMarks from '@/components/RankFromMarks';
import PercentileRank from '@/components/PercentileRank';
import ShareRankResult from '@/components/ShareRankResult';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts
const YEAR = new Date().getFullYear();

async function load(slug: string) {
  if (!hasSupabase) return null;
  const sb = supabasePublic();
  const { data: exam } = await sb.from('exams').select('id, slug, short_name, full_name, website, level').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (!exam || exam.level === 'Abroad') return null;
  const [{ data: bands }, { data: stats }, { data: reports }] = await Promise.all([
    sb.from('rank_bands').select('year, category, marks_from, marks_to, rank_from, rank_to, source').eq('exam_slug', slug).order('year', { ascending: false }).order('marks_from', { ascending: false }).limit(400),
    sb.from('exam_stats').select('year, session, total_candidates, source').eq('exam_slug', slug).order('year', { ascending: false }).limit(20),
    sb.from('rank_reports').select('year, session, category, marks, percentile, rank').eq('exam_slug', slug).eq('status', 'approved').order('year', { ascending: false }).order('rank').limit(200),
  ]);
  return { exam, bands: (bands || []) as any[], stats: (stats || []) as any[], reports: (reports || []) as any[] };
}

export async function generateMetadata({ params }: { params: Promise<{ exam: string }> }): Promise<Metadata> {
  const d = await load((await params).exam);
  if (!d) return { title: 'Rank predictor not found', robots: { index: false } };
  const n = d.exam.short_name;
  const hasData = d.bands.length > 0 || d.stats.length > 0 || d.reports.length >= 3;
  const what = [d.bands.length ? 'marks' : '', d.stats.length ? 'percentile' : ''].filter(Boolean).join(' or ') || 'marks';
  return {
    title: `${n} rank predictor ${YEAR} — ${what} to rank`,
    description: `Estimate your ${n} rank from your ${what}${d.bands.length || d.stats.length ? ', using official result figures' : ''}${d.reports.length ? ` and ${d.reports.length} real results shared by students` : ''}. See which colleges you can get at that rank.`,
    alternates: { canonical: `/rank-predictor/${d.exam.slug}` },
    robots: hasData ? undefined : { index: false, follow: true },
  };
}

export default async function RankPredictorPage({ params }: { params: Promise<{ exam: string }> }) {
  const d = await load((await params).exam);
  if (!d) notFound();
  const { exam, bands, stats, reports } = d;
  const categories = Array.from(new Set(bands.map((b) => b.category))) as string[];
  const sessions = Array.from(new Set(stats.map((s) => s.session))) as string[];
  const sources = Array.from(new Set([...bands.map((b) => `${b.year} · ${b.source || 'source not given'}`), ...stats.map((s) => `${s.year} · ${s.source}`)]));
  const nothing = !bands.length && !stats.length && reports.length < 3;
  return (
    <div className="container-x py-10">
      <nav className="text-sm text-slate-500"><Link href="/rank-predictor" className="hover:underline">Rank predictor</Link> / {exam.short_name}</nav>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">{exam.short_name} rank predictor {YEAR}</h1>
      <p className="mt-1 max-w-2xl text-slate-500">Enter your {bands.length ? 'marks' : ''}{bands.length && stats.length ? ' or ' : ''}{stats.length ? 'percentile' : ''}{!bands.length && !stats.length ? 'marks' : ''} to see an expected rank, then check colleges for that rank.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {nothing && <div className="card p-5 text-sm text-slate-600">We don't have official {exam.short_name} marks-vs-rank figures yet, and not enough students have shared their results. If you have your result, please share it below.</div>}
          {stats.length > 0 && <PercentileRank examName={exam.short_name} stats={stats} examSlug={exam.slug} />}
          {(bands.length > 0 || reports.length > 0) && <RankFromMarks exam={exam.slug} examName={exam.short_name} categories={categories} />}
          {reports.length > 0 && (
            <section className="card overflow-x-auto p-5">
              <h2 className="font-bold text-slate-900">Real {exam.short_name} results shared by students</h2>
              <p className="text-xs text-slate-500">Checked by our team. Ranks are all-India ranks as printed on scorecards.</p>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs text-slate-500"><tr><th className="py-1.5">Year</th><th>Category</th><th>Marks</th><th>Percentile</th><th className="text-right">Rank</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.slice(0, 60).map((r, i) => (
                    <tr key={i}><td className="py-1.5">{r.year}{r.session !== 'All' ? ` · ${r.session}` : ''}</td><td>{r.category}</td><td>{r.marks ?? '—'}</td><td>{r.percentile ?? '—'}</td><td className="text-right font-semibold">{Number(r.rank).toLocaleString('en-IN')}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          <ShareRankResult exam={exam.slug} examName={exam.short_name} categories={categories} sessions={sessions} />
        </div>
        <aside className="space-y-4">
          <Link href={`/predictor/${exam.slug}`} className="card flex items-center justify-between p-4 font-semibold text-brand-700 hover:shadow-md">Know your rank? Find colleges <ArrowRight size={16} /></Link>
          <Link href={`/exams/${exam.slug}`} className="card flex items-center justify-between p-4 font-semibold text-slate-800 hover:shadow-md">{exam.short_name} dates, pattern & news <ArrowRight size={16} /></Link>
          <div className="card p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Where the numbers come from</p>
            {sources.length ? <ul className="mt-1 list-disc space-y-0.5 ps-4">{sources.slice(0, 8).map((s) => <li key={s}>{s}</li>)}</ul> : <p className="mt-1">No official figures added yet.</p>}
            {reports.length > 0 && <p className="mt-1">Plus {reports.length} results shared by students.</p>}
            <p className="mt-2">This is an estimate. Your real rank depends on this year's paper, number of candidates, ties and normalisation.</p>
            {exam.website && <a href={exam.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-brand-700 hover:underline">Official website <ExternalLink size={12} /></a>}
          </div>
        </aside>
      </div>
    </div>
  );
}
