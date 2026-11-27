import type { Metadata } from 'next';
import ReportCard from '@/components/college/ReportCard';
import { Flag, flagSrc, isForeign } from '@/components/Flag';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  MapPin, Globe, Phone, Mail, Calendar, Award, Building2, Hospital, Landmark, Bus, CheckCircle2, TrendingUp, Target,
} from 'lucide-react';
import { HostelCard, JobCard, Stars, EmptyState } from '@/components/Cards';
import ReviewSection from '@/components/ReviewSection';
import Gallery from '@/components/Gallery';
import QuotaSeatCard from '@/components/QuotaSeatCard';
import CollegeCommunity from '@/components/CollegeCommunity';
import CollegeStudents from '@/components/college/CollegeStudents';
import CollegeNews from '@/components/college/CollegeNews';
import CollegePosts from '@/components/community/CollegePosts';
import EnquiryForm from '@/components/EnquiryForm';
import { SaveButton, CompareButton, ShareButtons, ApplyCartButton } from '@/components/ActionButtons';
import { AskForm, QuestionList } from '@/components/QuestionsBlock';
import { LiveJobs, LiveNearby } from '@/components/LiveData';
import TranslateText from '@/components/TranslateText';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { FALLBACK_IMG, money, range, SITE_URL } from '@/lib/format';
import { collegeTitle, collegeDescription, breadcrumbs, updatedOn } from '@/lib/seo';
import { Highlights, Admission, Rankings, Scholarships, Faqs, parseDates, parseFaqs, feeRange } from '@/components/college/Sections';
import { Download, PenLine } from 'lucide-react';
import type { College, Course, Place, Hostel, Job, ReviewPublic, Placement, Cutoff, QuestionPublic, QuotaSeat } from '@/lib/types';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts

async function getCollege(slug: string) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().from('colleges_public').select('*').eq('slug', slug).maybeSingle();
  return data as College | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollege(slug);
  if (!c) return { title: 'College not found', robots: { index: false } };
  const sb = supabasePublic();
  const [{ data: q }, { data: ok }, { data: rt }] = await Promise.all([
    sb.rpc('college_quality', { p_id: c.id }), sb.rpc('college_indexable', { p_id: c.id }),
    sb.from('college_ratings').select('avg_rating, review_count').eq('college_id', c.id).maybeSingle(),
  ]);
  const signals: string[] = (q as any)?.[0]?.signals || [];
  return {
    title: collegeTitle(c, signals),
    description: collegeDescription(c, { avg: Number(rt?.avg_rating || 0), count: Number(rt?.review_count || 0) }),
    alternates: { canonical: `/colleges/${c.slug}` },
    // thin pages stay usable for students but out of Google until they have real information (see migration 018)
    robots: ok === true ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { images: c.cover_url ? [c.cover_url] : [] },
  };
}

const PLACE_ICON: Record<string, React.ReactNode> = {
  company: <Building2 size={18} />, hospital: <Hospital size={18} />, bank: <Landmark size={18} />, transport: <Bus size={18} />, other: <MapPin size={18} />,
};

const pkg = (v: number | null, cur: string | null, unit: string | null) => {
  if (v == null) return '—';
  if ((cur || 'INR') === 'INR' && (unit || 'year') === 'year' && v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)} LPA`;
  return `${money(v, cur || 'INR')}${unit === 'month' ? ' / month' : ''}`;
};

export default async function CollegePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCollege(slug);
  if (!c) notFound();
  const hidden = new Set(c.hidden_sections || []);
  const show = (s: string) => !hidden.has(s);

  const sb = supabasePublic();
  const cityQ = c.city.replace(/[",()]/g, '');
  let countryCode = (c as any).country_code as string | null;
  if (!countryCode) {
    const { data: cc } = await sb.from('countries').select('code').ilike('name', c.country).maybeSingle();
    countryCode = cc?.code || null;
  }
  const { data: cityRow } = await sb.from('cities').select('slug').ilike('name', cityQ).eq('country_code', countryCode || '--').order('population', { ascending: false }).limit(1).maybeSingle();
  const [courses, places, reviews, rating, hostels, jobs, placements, cutoffs, questions, quota] = await Promise.all([
    sb.from('courses').select('*').eq('college_id', c.id).order('level').order('name'),
    sb.from('places').select('*').eq('college_id', c.id).order('distance_km', { ascending: true, nullsFirst: false }),
    sb.from('reviews_public').select('*').eq('college_id', c.id).order('created_at', { ascending: false }).limit(50),
    sb.from('college_ratings').select('*').eq('college_id', c.id).maybeSingle(),
    sb.from('hostels').select('*, hostel_rooms(beds_available)').eq('is_published', true).or(`college_id.eq.${c.id},city.eq."${cityQ}"`).limit(8),
    sb.from('jobs').select('*').eq('is_published', true).eq('status', 'open').or(`college_id.eq.${c.id},city.eq."${cityQ}"`).order('created_at', { ascending: false }).limit(6),
    sb.from('college_placements').select('*').eq('college_id', c.id).order('year', { ascending: false }).limit(10),
    sb.from('cutoffs').select('*').eq('college_id', c.id).order('year', { ascending: false }).order('closing_rank').limit(100),
    sb.from('questions_public').select('*').eq('college_id', c.id).order('created_at', { ascending: false }).limit(10),
    sb.from('quota_seats_public').select('*').eq('college_id', c.id).order('status').order('created_at', { ascending: false }).limit(12),
  ]);
  const cx = c as any;
  const [{ data: rankRows }, { data: examRows }, { data: rowFacts }] = await Promise.all([
    show('ranking') ? sb.from('college_rankings').select('source, year, category, rank, rank_band, source_url').eq('college_id', c.id).order('year', { ascending: false }).limit(60) : Promise.resolve({ data: [] as any[] }),
    sb.from('exams').select('slug, short_name').in('slug', (cx.exams_accepted || []).length ? cx.exams_accepted : ['-']),
    sb.rpc('college_rows', { p_ids: [c.id] }),
  ]);
  const examNames: Record<string, string> = Object.fromEntries((examRows || []).map((e: any) => [e.slug, e.short_name]));
  const rf: any = (rowFacts as any[] | null)?.[0] || {};
  const dates = parseDates(cx.important_dates);
  const faqs = parseFaqs(cx.faqs);
  const quotaList = (quota.data || []) as QuotaSeat[];
  const courseList = (courses.data || []) as Course[];
  const placeList = (places.data || []) as Place[];
  const reviewList = (reviews.data || []) as ReviewPublic[];
  const placementList = (placements.data || []) as Placement[];
  const cutoffList = (cutoffs.data || []) as Cutoff[];
  const questionList = (questions.data || []) as QuestionPublic[];
  const companies = placeList.filter((p) => p.kind === 'company');
  const hospitals = placeList.filter((p) => p.kind === 'hospital');
  const otherPlaces = placeList.filter((p) => !['company', 'hospital'].includes(p.kind));
  const avg = rating.data?.avg_rating ? Number(rating.data.avg_rating) : 0;
  const count = rating.data?.review_count || 0;
  const latestPlacement = placementList[0];
  const listItem = { id: c.id, slug: c.slug, name: c.name, city: c.city };



  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollegeOrUniversity', name: c.name, url: `${SITE_URL}/colleges/${c.slug}`,
    address: { '@type': 'PostalAddress', addressLocality: c.city, addressRegion: c.state, addressCountry: c.country, streetAddress: c.address },
    ...(c.website ? { sameAs: [c.website] } : {}),
    ...(count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: avg, reviewCount: count, bestRating: 5 } } : {}),
  };

  const tabs: [string, string][] = [
    ['overview', 'Overview'],
    ...(show('admission') && (cx.admission_process || dates.length || (cx.exams_accepted || []).length) ? [['admission', 'Admission'] as [string, string]] : []),
    ...(show('quota') && quotaList.length ? [['quota', `${c.country === 'India' ? 'Management quota' : 'Direct admission'} (${quotaList.length})`] as [string, string]] : []),
    ...(show('courses') ? [['courses', `Courses & Fees (${courseList.length})`] as [string, string]] : []),
    ...(show('placements') && placementList.length ? [['placements', 'Placements'] as [string, string]] : []),
    ...(show('cutoffs') && cutoffList.length ? [['cutoffs', 'Cutoffs'] as [string, string]] : []),
    ...(show('ranking') && (rankRows || []).length ? [['ranking', 'Ranking'] as [string, string]] : []),
    ...(show('scholarships') && cx.scholarship_info ? [['scholarships', 'Scholarships'] as [string, string]] : []),
    ...(show('reviews') ? [['reviews', `Reviews (${count})`] as [string, string]] : []),
    ...(show('qa') ? [['qa', `Q&A (${questionList.length})`] as [string, string]] : []),
    ...(show('faqs') && faqs.length ? [['faqs', 'FAQs'] as [string, string]] : []),
    ...(show('community') ? [['community', 'Talk to students'] as [string, string]] : []),
    ...(show('hostels') ? [['hostels', 'PG & Hostels'] as [string, string]] : []),
    ...(show('jobs') ? [['jobs', 'Part-time Jobs'] as [string, string]] : []),
    ...(show('nearby') ? [['nearby', 'Nearby'] as [string, string]] : []),
    ...(show('gallery') && c.photos?.length ? [['gallery', 'Gallery'] as [string, string]] : []),
  ];

  // Cutoffs grouped by exam → latest year only
  const cutoffByExam: Record<string, Cutoff[]> = {};
  for (const x of cutoffList) (cutoffByExam[x.exam_slug] ||= []).push(x);
  for (const k of Object.keys(cutoffByExam)) {
    const maxYear = Math.max(...cutoffByExam[k].map((x) => x.year));
    cutoffByExam[k] = cutoffByExam[k].filter((x) => x.year === maxYear);
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs([['Colleges', '/colleges'], ...(cityRow?.slug ? [[c.city, `/city/${cityRow.slug}`] as [string, string]] : []), [c.name, `/colleges/${c.slug}`]])) }} />
      <section className="relative h-72 bg-brand-950 sm:h-80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.cover_url || (isForeign((c as any).country_code) ? flagSrc((c as any).country_code)! : FALLBACK_IMG)} alt={c.name} className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/60 to-transparent" />
        {(() => { const cr = ((c as any).photo_credits || []).find((x: any) => x.url === c.cover_url); return cr ? (
          <p className="absolute bottom-1 end-2 z-10 max-w-[60%] truncate text-[10px] text-white/60">Photo: <a href={cr.page} target="_blank" rel="noopener" className="underline">{cr.author}</a> · {cr.license_url ? <a href={cr.license_url} target="_blank" rel="noopener license" className="underline">{cr.license}</a> : cr.license}</p>
        ) : null; })()}
        <div className="container-x relative flex h-full items-end pb-8">
          <div className="flex w-full flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-5">
              {c.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logo_url} alt="" className="hidden h-24 w-24 rounded-2xl border-4 border-white bg-white object-contain sm:block" />
              ) : isForeign((c as any).country_code) ? (
                <span className="hidden h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-white sm:flex"><Flag code={(c as any).country_code} country={c.country} className="h-12 w-16" /></span>
              ) : null}
              <div className="text-white">
                <div className="mb-2 flex flex-wrap gap-2">
                  {isForeign((c as any).country_code) && <span className="chip bg-white/15 text-white"><Flag code={(c as any).country_code} country={c.country} />{c.country}</span>}
                  {c.type && <span className="chip bg-white/15 text-white">{c.type}</span>}
                  {c.accreditation && <span className="chip bg-white/15 text-white"><Award size={12} />{c.accreditation}</span>}
                  {c.ranking && <span className="chip bg-accent-500 text-slate-900">#{c.ranking} Rank</span>}
                  {c.accepts_applications && <span className="chip bg-emerald-500 text-white">Applications open</span>}
                </div>
                <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{c.name}</h1>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-brand-100">
                  <span className="flex items-center gap-1"><MapPin size={16} />{[c.city, c.state, c.country].filter(Boolean).join(', ')}</span>
                  {c.established && <span className="flex items-center gap-1"><Calendar size={16} />Estd. {c.established}</span>}
                  {count > 0 && <span className="flex items-center gap-1"><Stars value={avg} />{avg} ({count})</span>}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CompareButton item={listItem} /><SaveButton type="college" id={c.id} />
              {cx.brochure_url && <a href={cx.brochure_url} target="_blank" rel="noopener noreferrer" className="btn-ghost border-white/30 bg-white/10 py-2 text-sm text-white hover:bg-white/20"><Download size={15} />Brochure</a>}
              {show('reviews') && <a href="#reviews" className="btn-ghost border-white/30 bg-white/10 py-2 text-sm text-white hover:bg-white/20"><PenLine size={15} />Write a review</a>}
              {c.accepts_applications ? <a href="#apply" className="btn-accent py-2 text-sm">Apply now</a> : <a href="#enquiry" className="btn-accent py-2 text-sm">Get admission help</a>}
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-16 z-30 border-b border-slate-200 bg-white">
        <div className="container-x flex gap-1 overflow-x-auto py-2">
          {tabs.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-brand-700">{label}</a>
          ))}
        </div>
      </nav>

      <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <section id="overview" className="card scroll-mt-32 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">About {c.short_name || c.name}</h2>
              <ShareButtons title={`${c.name} — fees, courses & reviews`} path={`/colleges/${c.slug}`} />
            </div>
            <TranslateText text={c.description || collegeDescription(c, { avg, count })} className="mt-3 whitespace-pre-line leading-relaxed text-slate-600" />
            {(c as any).description_source === 'wikipedia' && (c as any).wikipedia_url && (
              <p className="mt-2 text-xs text-slate-400">Text from <a href={(c as any).wikipedia_url} target="_blank" rel="noopener" className="underline">Wikipedia</a>, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener license" className="underline">CC BY-SA 4.0</a>.</p>
            )}
            {(c as any).facts?.cricos && (
              <p className="mt-2 text-xs text-slate-400">Courses and tuition fees: Source — <a href="https://cricos.education.gov.au/" target="_blank" rel="noopener" className="underline">CRICOS</a>, Australian Government Department of Education, licensed <a href="https://creativecommons.org/licenses/by/2.5/au/" target="_blank" rel="noopener license" className="underline">CC BY 2.5 AU</a>{(c as any).facts.cricos.snapshot ? ` (list of ${(c as any).facts.cricos.snapshot})` : ''}. Fees are for international students; per-year fees are the total course tuition divided by the course length. Check the university's website before applying.</p>
            )}
            {(c as any).facts?.uk && (
              <p className="mt-2 text-xs text-slate-400">Courses, graduate outcomes and NSS scores: Contains HESA data — <a href="https://discoveruni.gov.uk" target="_blank" rel="noopener" className="underline">Discover Uni</a> dataset, licensed <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener license" className="underline">CC BY 4.0</a>{(c as any).facts.uk.updated ? ` (downloaded ${(c as any).facts.uk.updated})` : ''}.</p>
            )}
            {(c as any).facts?.eter && (
              <p className="mt-2 text-xs text-slate-400">{(c as any).facts.eter.source || 'Data source: ETER project'} (<a href="https://www.eter-project.com" target="_blank" rel="noopener" className="underline">European Tertiary Education Register</a>).</p>
            )}
            {(c as any).source && (c as any).source !== 'admin' && (
              <p className="mt-3 text-xs text-slate-400">Profile from public data ({({ hipolabs: 'Hipolabs university list', wikidata: 'Wikidata', aishe: 'AISHE, Govt. of India', scorecard: 'U.S. College Scorecard', discover_uni: 'Discover Uni (HESA)', eter: 'ETER', cricos: 'CRICOS, Australian Govt.' } as Record<string, string>)[(c as any).source] || (c as any).source}{(c as any).wikidata_id ? ' + Wikidata' : ''}). <Link href="/counselling" className="underline">Ask us</Link> for current fees and admission details.</p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              {updatedOn((c as any).data_updated_at || (c as any).updated_at) && <>Last updated {updatedOn((c as any).data_updated_at || (c as any).updated_at)} · </>}
              <Link href="/editorial-policy" className="underline">How we collect college data</Link> · <Link href={`/contact?topic=correction&about=${encodeURIComponent(c.name)}`} className="underline">Report a correction</Link>
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {c.students_count ? <span className="chip">~{c.students_count.toLocaleString()} students</span> : null}
              {c.admission_rate != null ? <span className="chip">Admission rate {Math.round(Number(c.admission_rate) * 100)}%</span> : null}
              {c.management ? <span className="chip">{c.management}</span> : null}
              {c.affiliated_to ? <span className="chip">Affiliated to {c.affiliated_to}</span> : null}
              {c.district && c.district !== c.city ? <span className="chip">District: {c.district}</span> : null}
              {(c as any).facts?.institution && <span className="chip">{(c as any).facts.institution}{(c as any).facts.category && (c as any).facts.category !== (c as any).facts.institution ? ` · ${(c as any).facts.category}` : ''}</span>}
              {(c as any).facts?.area && <span className="chip">{(c as any).facts.area} area</span>}
              {(c as any).facts?.graduation_rate != null ? <span className="chip">Graduation rate {Math.round((c as any).facts.graduation_rate * 100)}%</span> : null}
              {(c as any).facts?.uk?.nss_satisfaction != null ? <span className="chip-green">Student satisfaction {(c as any).facts.uk.nss_satisfaction}% (NSS)</span> : null}
              {(c as any).facts?.uk?.median_salary_gbp != null ? <span className="chip-green">Graduate median salary {money((c as any).facts.uk.median_salary_gbp, 'GBP')}</span> : null}
              {(c as any).facts?.eter?.category && !(c as any).facts?.category ? <span className="chip">{(c as any).facts.eter.category}</span> : null}
              {(c as any).facts?.median_earnings_10y != null ? <span className="chip-green">Median earnings after 10 yrs {money((c as any).facts.median_earnings_10y, 'USD')}</span> : null}
            </div>
            {latestPlacement && (
              <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-emerald-50 p-4 text-center">
                <div><p className="text-xs text-emerald-700">Average package</p><p className="font-bold text-emerald-900">{pkg(latestPlacement.avg_package, latestPlacement.currency, latestPlacement.package_unit)}</p></div>
                <div><p className="text-xs text-emerald-700">Highest package</p><p className="font-bold text-emerald-900">{pkg(latestPlacement.highest_package, latestPlacement.currency, latestPlacement.package_unit)}</p></div>
                <div><p className="text-xs text-emerald-700">Placement rate</p><p className="font-bold text-emerald-900">{latestPlacement.placement_rate != null ? `${latestPlacement.placement_rate}%` : '—'}</p></div>
              </div>
            )}
            {c.streams?.length ? (
              <div className="mt-5"><p className="label">Streams</p><div className="flex flex-wrap gap-2">{c.streams.map((s) => <span key={s} className="chip-brand">{s}</span>)}</div></div>
            ) : null}
            {c.facilities?.length ? (
              <div className="mt-5"><p className="label">Facilities</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{c.facilities.map((f) => (
                  <span key={f} className="flex items-center gap-2 text-sm text-slate-700"><CheckCircle2 size={16} className="text-emerald-600" />{f}</span>
                ))}</div>
              </div>
            ) : null}
          </section>

                    <Highlights source={cx.details_source} rows={[
            ['Established', c.established],
            ['Ownership', c.type],
            ['Approvals', (cx.approvals || []).length ? cx.approvals.join(', ') : c.accreditation],
            ['Affiliated to', cx.affiliated_to],
            ['Courses offered', courseList.length ? `${courseList.length} course${courseList.length > 1 ? 's' : ''}` : null],
            ['Fees', show('courses') ? feeRange(rf.fee_low, rf.fee_high, c.currency) : null],
            ['Entrance exams', (cx.exams_accepted || []).length ? cx.exams_accepted.map((e: string) => examNames[e] || e).join(', ') : null],
            ['Average package', show('placements') && latestPlacement?.avg_package ? `${pkg(Number(latestPlacement.avg_package), latestPlacement.currency, latestPlacement.package_unit)} (${latestPlacement.year})` : null],
            ['Rank', rf.rank_value ? `#${rf.rank_value} ${rf.rank_source || ''} ${rf.rank_year || ''}`.trim() : c.ranking ? `#${c.ranking}` : null],
            ['Students', c.students_count ? `~${c.students_count.toLocaleString('en-IN')}` : null],
            ['Student rating', count ? `${avg}/5 from ${count} review${count > 1 ? 's' : ''}` : null],
            ['Official website', c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">{c.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a> : null],
          ]} />
          {show('quota') && quotaList.length ? (
            <section id="quota" className="scroll-mt-32">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{c.country === 'India' ? 'Management quota admission' : 'Direct admission seats'}</h2>
                  <p className="text-sm text-slate-500">Official fee, seats left and last date. Apply free; fees are paid only to the institution.</p>
                </div>
                <Link href={`/management-quota${(c as any).country_code ? `?country=${(c as any).country_code}` : ''}`} className="text-sm font-semibold text-brand-700">More in {c.country} →</Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2">{quotaList.map((q) => <QuotaSeatCard key={q.id} s={q} showCollege={false} />)}</div>
            </section>
          ) : null}

          {show('courses') && <section id="courses" className="scroll-mt-32">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Courses & fees</h2>
            {courseList.length ? (
              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Course</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Fees / year</th><th className="px-4 py-3">Eligibility</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {courseList.map((co) => (
                      <tr key={co.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{(co as any).url ? <a href={(co as any).url} target="_blank" rel="noopener nofollow" className="hover:text-brand-700 hover:underline">{co.name}</a> : co.name}{(co as any).study_mode ? <span className="block text-xs text-slate-400">{(co as any).study_mode}</span> : null}{co.seats ? <span className="block text-xs text-slate-400">{co.seats} seats</span> : null}</td>
                        <td className="px-4 py-3"><span className="chip">{co.level}</span></td>
                        <td className="px-4 py-3 text-slate-600">{co.duration || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{money(co.fees, co.currency || c.currency || 'INR')}</td>
                        <td className="px-4 py-3 text-slate-600">{co.eligibility || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="Courses not added yet" />}
          </section>}

          {show('admission') && <Admission name={c.short_name || c.name} process={cx.admission_process} dates={dates} exams={cx.exams_accepted || []} examNames={examNames}
            eligibility={courseList.filter((x: any) => x.eligibility).slice(0, 15).map((x: any) => ({ course: x.name, text: x.eligibility }))} />}
          {show('placements') && placementList.length > 0 && (
            <section id="placements" className="scroll-mt-32">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900"><TrendingUp size={20} className="text-emerald-600" />Placements</h2>
              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Year</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Average</th><th className="px-4 py-3">Median</th><th className="px-4 py-3">Highest</th><th className="px-4 py-3">Placed</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {placementList.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-semibold">{p.year}</td>
                        <td className="px-4 py-3">{p.course || 'All'}</td>
                        <td className="px-4 py-3">{pkg(p.avg_package, p.currency, p.package_unit)}</td>
                        <td className="px-4 py-3">{pkg(p.median_package, p.currency, p.package_unit)}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">{pkg(p.highest_package, p.currency, p.package_unit)}</td>
                        <td className="px-4 py-3">{p.placement_rate != null ? `${p.placement_rate}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {latestPlacement?.top_recruiters?.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold text-slate-700">Top recruiters:</span>{latestPlacement.top_recruiters.map((r) => <span key={r} className="chip">{r}</span>)}</div>
              ) : null}
              {latestPlacement?.source && <p className="mt-2 text-xs text-slate-400">Source: {latestPlacement.source}</p>}
            </section>
          )}

          {show('cutoffs') && cutoffList.length > 0 && (
            <section id="cutoffs" className="scroll-mt-32">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-xl font-bold text-slate-900">Cutoffs (closing ranks)</h2>
                <Link href="/predictor" className="btn-ghost py-1.5"><Target size={14} />Check my chances</Link>
              </div>
              <div className="space-y-4">
                {Object.entries(cutoffByExam).map(([exam, rows]) => (
                  <div key={exam} className="card overflow-x-auto">
                    <p className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
                      <Link href={`/exams/${exam}`} className="hover:text-brand-700">{exam.replace(/-/g, ' ').toUpperCase()}</Link> · {rows[0].year}
                    </p>
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Course</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Quota</th><th className="px-4 py-2">Opening</th><th className="px-4 py-2">Closing</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((r) => (
                          <tr key={r.id}><td className="px-4 py-2">{r.course}</td><td className="px-4 py-2">{r.category}</td><td className="px-4 py-2">{r.quota || '—'}</td><td className="px-4 py-2">{r.opening_rank?.toLocaleString() ?? '—'}</td><td className="px-4 py-2 font-semibold">{r.closing_rank.toLocaleString()}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          )}

          {show('ranking') && <Rankings name={c.short_name || c.name} rows={(rankRows || []) as any[]} review={count ? { avg: Number(avg) || 0, count } : null} nirf={(c as any).facts?.nirf?.tlr != null ? (c as any).facts.nirf : null} />}
          {show('scholarships') && <Scholarships name={c.short_name || c.name} text={cx.scholarship_info} />}
          {show('reviews') && <section id="reviews" className="scroll-mt-32">
            <ReportCard collegeId={c.id} />
            <ReviewSection collegeId={c.id} collegeName={c.name} reviews={reviewList} avg={avg} count={count} />
          </section>}

          {show('news') && <CollegeNews collegeId={c.id} name={c.short_name || c.name} />}

          {show('community') && (
            <section id="community" className="scroll-mt-32">
              <h2 className="mb-1 text-xl font-bold text-slate-900">Talk to students of {c.short_name || c.name}</h2>
              <p className="mb-4 text-sm text-slate-500">Ask seniors about hostels, faculty and placements, or find classmates and roommates who are also applying.</p>
              <CollegeStudents collegeId={c.id} collegeName={c.short_name || c.name} />
              <CollegeCommunity collegeId={c.id} collegeName={c.short_name || c.name} />
              <div className="mt-6"><CollegePosts collegeId={c.id} collegeName={c.short_name || c.name} /></div>
            </section>
          )}

          {show('qa') && <section id="qa" className="scroll-mt-32 space-y-4">
            <div className="flex items-end justify-between">
              <h2 className="text-xl font-bold text-slate-900">Questions about {c.short_name || c.name}</h2>
              <Link href={`/questions?college=${c.id}`} className="text-sm font-semibold text-brand-700 hover:underline">All questions</Link>
            </div>
            <QuestionList items={questionList} showCollege={false} />
            <AskForm collegeId={c.id} collegeName={c.short_name || c.name} />
          </section>}

          {show('faqs') && <Faqs name={c.short_name || c.name} items={faqs} />}
          {show('hostels') && <section id="hostels" className="scroll-mt-32">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xl font-bold text-slate-900">PG & hostels near {c.short_name || c.name}</h2>
              <Link href={cityRow?.slug ? `/city/${cityRow.slug}` : `/hostels?city=${encodeURIComponent(c.city)}`} className="text-sm font-semibold text-brand-700 hover:underline">See all in {c.city}</Link>
            </div>
            {(hostels.data || []).length ? (
              <div className="grid gap-5 sm:grid-cols-2">{(hostels.data as Hostel[]).map((h) => <HostelCard key={h.id} h={h} />)}</div>
            ) : <EmptyState title="No PG or hostel listed yet" text="Own a PG nearby? List it free from “Post PG / Job”." />}
          </section>}

          {show('jobs') && <section id="jobs" className="scroll-mt-32">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xl font-bold text-slate-900">Part-time jobs near campus</h2>
              <Link href={`/jobs?city=${encodeURIComponent(c.city)}`} className="text-sm font-semibold text-brand-700 hover:underline">All jobs in {c.city}</Link>
            </div>
            {(jobs.data || []).length ? (
              <div className="grid gap-5 sm:grid-cols-2">{(jobs.data as Job[]).map((j) => <JobCard key={j.id} j={j} />)}</div>
            ) : <EmptyState title="No Collegeolo jobs near this college yet" text="See live listings from job sites below." />}
            <div className="mt-5"><LiveJobs city={c.city === 'Not specified' ? c.country : c.city} country={countryCode} /></div>
          </section>}

          {show('nearby') && <section id="nearby" className="scroll-mt-32">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Nearby hospitals, food, places to visit & services</h2>
            {c.latitude != null && c.longitude != null && (
              <div className="mb-5"><LiveNearby lat={c.latitude} lng={c.longitude} kinds={['hospital', 'food', 'visit', 'pharmacy', 'pg', 'transport', 'bus', 'bank']} /></div>
            )}
            <div className="grid gap-5 md:grid-cols-2">
              <PlaceList title="Companies (jobs & internships)" items={companies} />
              <PlaceList title="Hospitals" items={hospitals} />
              {otherPlaces.length > 0 && <PlaceList title="Banks & transport" items={otherPlaces} />}
            </div>
          </section>}

          {show('gallery') && c.photos?.length ? (
            <section id="gallery" className="scroll-mt-32">
              <h2 className="mb-4 text-xl font-bold text-slate-900">Gallery</h2>
              <Gallery photos={c.photos} alt={c.name} credits={(c as any).photo_credits || []} />
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <div className="card p-5">
            <p className="text-xs text-slate-500">Fees per year</p>
            <p className="text-2xl font-extrabold text-slate-900">{range(c.fees_min, c.fees_max, c.currency)}</p>
            {show('quota') && quotaList.some((q) => q.status === 'open') && (
              <a href="#quota" className="mt-4 block rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                {quotaList.filter((q) => q.status === 'open').length} admission seat listing{quotaList.filter((q) => q.status === 'open').length > 1 ? 's' : ''} open → Apply
              </a>
            )}
            {c.accepts_applications && (
              <div id="apply" className="mt-4 scroll-mt-32 rounded-xl bg-emerald-50 p-3">
                <p className="mb-2 text-sm font-semibold text-emerald-800">Apply through Collegeolo{c.application_note ? ` · ${c.application_note}` : ''}</p>
                <ApplyCartButton item={listItem} />
              </div>
            )}
            <div className="mt-4 flex gap-2"><CompareButton item={listItem} variant="button" /><SaveButton type="college" id={c.id} variant="button" /></div>
            <div className="mt-5 space-y-3 text-sm">
              {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-brand-700 hover:underline"><Globe size={16} />Official website</a>}
              {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-slate-700"><Phone size={16} />{c.phone}</a>}
              {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-slate-700"><Mail size={16} />{c.email}</a>}
              {c.address && <p className="flex items-start gap-2 text-slate-700"><MapPin size={16} className="mt-0.5 shrink-0" />{c.address}</p>}
            </div>
            {c.latitude && c.longitude ? (
              <a className="btn-ghost mt-5 w-full" target="_blank" rel="noopener noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`}>Open in Google Maps</a>
            ) : null}
            {show('reviews') && <a href="#reviews" className="btn-primary mt-2 w-full">Write a review</a>}
          </div>
          {show('enquiry') && <div className="lg:sticky lg:top-32">
            <div id="enquiry" className="scroll-mt-32" />
            <EnquiryForm kind="college" collegeId={c.id} title={`Enquire about ${c.short_name || c.name}`} subtitle="Admission, fees, scholarships — get a call back." compact />
          </div>}
        </aside>
      </div>
    </>
  );
}

function PlaceList({ title, items }: { title: string; items: Place[] }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {items.length ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((p) => (
            <li key={p.id} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 text-brand-600">{PLACE_ICON[p.kind] || PLACE_ICON.other}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">{p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.name}</a> : p.name}</p>
                {p.address && <p className="text-xs text-slate-500">{p.address}</p>}
                {p.phone && <a href={`tel:${p.phone}`} className="text-xs text-brand-700">{p.phone}</a>}
              </div>
              {p.distance_km != null && <span className="chip">{p.distance_km} km</span>}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-slate-400">Not added yet.</p>}
    </div>
  );
}
