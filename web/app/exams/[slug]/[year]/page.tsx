import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, Target, Calculator, ClipboardCheck, FileStack } from 'lucide-react';
import ExamDates from '@/components/exams/ExamDates';
import ExamNewsList, { type ExamNewsItem } from '@/components/exams/ExamNewsList';
import FollowExam from '@/components/exams/FollowExam';
import EnquiryForm from '@/components/EnquiryForm';
import { extUrl } from '@/lib/extUrl';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

// One page per exam per year ("JEE Main 2027"): dates, last cutoffs, predictor, papers and news together.
// Allowed years: last year → next year (pages for older years only if we hold that year's cutoffs).
const NOW = new Date().getFullYear();

async function load(slug: string, yearStr: string) {
  if (!hasSupabase || !/^20\d\d$/.test(yearStr)) return null;
  const year = Number(yearStr);
  const sb = supabasePublic();
  const { data: exam } = await sb.from('exams').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (!exam) return null;
  const { data: yrs } = await sb.from('cutoffs').select('year').eq('exam_slug', slug).order('year', { ascending: false }).limit(1);
  const latestCut = yrs?.[0]?.year ?? null;
  // the cutoffs that matter for a session are the previous year's (or the same year's once counselling is over)
  const { data: sameYear } = await sb.from('cutoffs').select('id').eq('exam_slug', slug).eq('year', year).limit(1);
  const cutYear = sameYear?.length ? year : latestCut && latestCut < year ? latestCut : null;
  if (year < NOW - 1 && !sameYear?.length) return null;
  if (year > NOW + 1) return null;
  const [{ data: top }, { data: news }, { data: docs }, { count: mock }] = await Promise.all([
    cutYear ? sb.from('cutoffs').select('course, closing_rank, quota, round, colleges(name, slug, city)').eq('exam_slug', slug).eq('year', cutYear)
      .eq('category', 'General').neq('gender', 'Female-only (including Supernumerary)').order('closing_rank', { ascending: true }).limit(60) : Promise.resolve({ data: [] as any[] }),
    sb.from('exam_news').select('id, title, url, source, published_at, official, date_known').eq('exam_id', exam.id).eq('is_hidden', false)
      .gte('published_at', new Date(Date.now() - 60 * 86400e3).toISOString()).order('published_at', { ascending: false }).limit(12),
    sb.from('exam_resources').select('id').eq('exam_slug', slug).eq('is_published', true).order('year', { ascending: false, nullsFirst: false }).limit(6),
    sb.from('mock_blueprints').select('id', { count: 'exact', head: true }).eq('exam_slug', slug).eq('is_published', true),
  ]);
  // keep one row per college+course (lowest closing rank = last round shown first is fine for a "toughest" list)
  const seen = new Set<string>(); const rows: any[] = [];
  for (const r of (top || []) as any[]) { const k = `${r.colleges?.slug}|${r.course}`; if (!r.colleges || seen.has(k)) continue; seen.add(k); rows.push(r); if (rows.length >= 20) break; }
  return { exam, year, cutYear, rows, news: (news || []) as ExamNewsItem[], docs: (docs || []) as any[], hasMock: (mock || 0) > 0 };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; year: string }> }): Promise<Metadata> {
  const { slug, year } = await params;
  const d = await load(slug, year);
  if (!d) return { title: 'Exam not found' };
  const n = d.exam.short_name;
  return {
    title: `${n} ${d.year}: dates, cutoffs, college predictor & latest news`,
    description: `${n} ${d.year} in one place — official dates with sources, ${d.cutYear ? `${d.cutYear} closing ranks, ` : ''}college predictor, previous papers and the latest official notices.`,
    alternates: { canonical: `/exams/${d.exam.slug}/${d.year}` },
  };
}

export default async function ExamYearPage({ params }: { params: Promise<{ slug: string; year: string }> }) {
  const { slug, year } = await params;
  const d = await load(slug, year);
  if (!d) notFound();
  const { exam } = d;
  const n = exam.short_name;
  const site = extUrl(exam.website);
  const faq = [
    { q: `When is ${n} ${d.year}?`, a: `See the important dates on this page — each date links to the official notice it came from. Dates marked tentative are not final yet. Always confirm on ${site ? 'the official website' : 'the conducting body’s website'}.` },
    ...(d.cutYear ? [{ q: `What rank is needed for top colleges in ${n} ${d.year}?`, a: `We show the official ${d.cutYear} closing ranks (General category). Cutoffs change every year, so use them as a guide and check your chances with the ${n} college predictor.` }] : []),
    { q: `Where can I practise for ${n} ${d.year}?`, a: `Use previous-year papers${d.hasMock ? ' and the free mock tests' : ''} linked on this page.` },
  ];
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Exams', item: '/exams' }, { '@type': 'ListItem', position: 2, name: n, item: `/exams/${exam.slug}` },
      { '@type': 'ListItem', position: 3, name: `${n} ${d.year}`, item: `/exams/${exam.slug}/${d.year}` }] },
  ];
  const years = [NOW - 1, NOW, NOW + 1].filter((y) => y !== d.year);

  return (
    <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-w-0 space-y-6">
        <div>
          <Link href={`/exams/${exam.slug}`} className="text-sm text-slate-500 hover:underline">← {n} overview</Link>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{n} {d.year}: dates, cutoffs & predictor</h1>
          <p className="mt-1 text-slate-500">{exam.full_name}{exam.conducting_body ? ` · conducted by ${exam.conducting_body}` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">{years.map((y) => <Link key={y} href={`/exams/${exam.slug}/${y}`} className="chip hover:bg-brand-50">{n} {y}</Link>)}</div>
        </div>

        <ExamDates slug={exam.slug} name={`${n} ${d.year}`} />

        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">{d.cutYear ? `${n} ${d.cutYear} closing ranks (General)` : `${n} cutoffs`}</h2>
            <Link href={`/predictor/${exam.slug}`} className="btn-primary py-1.5"><Target size={14} />Predict my colleges</Link>
          </div>
          {d.rows.length ? (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-500"><th className="py-2 pr-3">College</th><th className="py-2 pr-3">Course</th><th className="py-2 pr-3">Quota</th><th className="py-2 text-right">Closing rank</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{d.rows.map((r: any, i: number) => (
                    <tr key={i}><td className="py-2 pr-3"><Link href={`/colleges/${r.colleges.slug}#cutoffs`} className="font-medium text-brand-700 hover:underline">{r.colleges.name}</Link></td>
                      <td className="py-2 pr-3 text-slate-600">{r.course}</td><td className="py-2 pr-3 text-slate-500">{r.quota || 'All India'}{r.round && r.round !== 'Final' ? ` · ${r.round}` : ''}</td>
                      <td className="py-2 text-right font-semibold text-slate-900">{Number(r.closing_rank).toLocaleString('en-IN')}</td></tr>))}</tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">From the official counselling results. Other categories, home-state quota and female-only seats are in the predictor.</p>
            </>
          ) : <p className="mt-2 text-sm text-slate-500">We don’t have official {n} closing ranks yet. They’ll appear here once counselling results are published.</p>}
        </section>

        <ExamNewsList items={d.news} name={`${n} ${d.year}`} />

        <section className="card p-6">
          <h2 className="text-lg font-bold text-slate-900">Prepare for {n} {d.year}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {exam.level !== 'Abroad' && <Link href={`/rank-predictor/${exam.slug}`} className="btn-ghost justify-start"><Calculator size={16} />{n} rank predictor (marks → rank)</Link>}
            {d.hasMock && <Link href={`/mock-tests/${exam.slug}`} className="btn-ghost justify-start"><ClipboardCheck size={16} />Free {n} mock tests</Link>}
            <Link href={`/papers?exam=${exam.slug}`} className="btn-ghost justify-start"><FileStack size={16} />Previous papers & answer keys{d.docs.length ? ` (${d.docs.length}+)` : ''}</Link>
            <Link href={`/exams/${exam.slug}`} className="btn-ghost justify-start">Eligibility, pattern & syllabus</Link>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-bold text-slate-900">Questions students ask</h2>
          <dl className="mt-3 space-y-3">{faq.map((f) => <div key={f.q}><dt className="font-semibold text-slate-800">{f.q}</dt><dd className="text-sm text-slate-600">{f.a}</dd></div>)}</dl>
        </section>
      </div>
      <aside className="space-y-5">
        {site && <a href={site} target="_blank" rel="noopener noreferrer" className="btn-primary w-full"><ExternalLink size={16} />Official website</a>}
        {exam.news_enabled !== false && <FollowExam examId={exam.id} name={n} slug={exam.slug} />}
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Dates and rules change every year — always confirm on the official website before applying.</p>
        <div className="lg:sticky lg:top-24"><EnquiryForm compact title={`Need help with ${n} ${d.year}?`} subtitle="Free guidance on colleges and counselling." /></div>
      </aside>
    </div>
  );
}
