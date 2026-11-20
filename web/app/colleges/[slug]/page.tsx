import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Globe, Phone, Mail, Calendar, Award, Building2, Hospital, Landmark, Bus, CheckCircle2 } from 'lucide-react';
import { HostelCard, JobCard, Stars, EmptyState } from '@/components/Cards';
import ReviewSection from '@/components/ReviewSection';
import Gallery from '@/components/Gallery';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { FALLBACK_IMG, money, range, SITE_URL } from '@/lib/format';
import type { College, Course, Place, Hostel, Job, ReviewPublic } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getCollege(slug: string) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().from('colleges').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  return data as College | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollege(slug);
  if (!c) return { title: 'College not found' };
  return {
    title: `${c.name}, ${c.city} — Fees, Courses, Reviews, Hostels`,
    description: (c.description || `${c.name} in ${c.city}, ${c.country}: courses, fees, reviews, nearby PG & hostels and part-time jobs.`).slice(0, 160),
    alternates: { canonical: `/colleges/${c.slug}` },
    openGraph: { images: c.cover_url ? [c.cover_url] : [] },
  };
}

const PLACE_ICON: Record<string, React.ReactNode> = {
  company: <Building2 size={18} />, hospital: <Hospital size={18} />, bank: <Landmark size={18} />, transport: <Bus size={18} />, other: <MapPin size={18} />,
};

export default async function CollegePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCollege(slug);
  if (!c) notFound();

  const sb = supabasePublic();
  const [courses, places, reviews, rating, hostels, jobs] = await Promise.all([
    sb.from('courses').select('*').eq('college_id', c.id).order('level').order('name'),
    sb.from('places').select('*').eq('college_id', c.id).order('distance_km', { ascending: true, nullsFirst: false }),
    sb.from('reviews_public').select('*').eq('college_id', c.id).order('created_at', { ascending: false }).limit(50),
    sb.from('college_ratings').select('*').eq('college_id', c.id).maybeSingle(),
    sb.from('hostels').select('*').eq('is_published', true).or(`college_id.eq.${c.id},city.eq."${c.city.replace(/[",()]/g, '')}"`).limit(8),
    sb.from('jobs').select('*').eq('is_published', true).eq('status', 'open').or(`college_id.eq.${c.id},city.eq."${c.city.replace(/[",()]/g, '')}"`).order('created_at', { ascending: false }).limit(6),
  ]);
  const courseList = (courses.data || []) as Course[];
  const placeList = (places.data || []) as Place[];
  const reviewList = (reviews.data || []) as ReviewPublic[];
  const companies = placeList.filter((p) => p.kind === 'company');
  const hospitals = placeList.filter((p) => p.kind === 'hospital');
  const otherPlaces = placeList.filter((p) => !['company', 'hospital'].includes(p.kind));
  const avg = rating.data?.avg_rating ? Number(rating.data.avg_rating) : 0;
  const count = rating.data?.review_count || 0;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollegeOrUniversity', name: c.name, url: `${SITE_URL}/colleges/${c.slug}`,
    address: { '@type': 'PostalAddress', addressLocality: c.city, addressRegion: c.state, addressCountry: c.country, streetAddress: c.address },
    ...(c.website ? { sameAs: [c.website] } : {}),
    ...(count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: avg, reviewCount: count, bestRating: 5 } } : {}),
  };

  const tabs = [
    ['overview', 'Overview'], ['courses', `Courses & Fees (${courseList.length})`], ['reviews', `Reviews (${count})`],
    ['hostels', 'PG & Hostels'], ['jobs', 'Part-time Jobs'], ['nearby', 'Nearby'],
    ...(c.photos?.length ? [['gallery', 'Gallery']] : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Header */}
      <section className="relative h-72 bg-brand-950 sm:h-80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.cover_url || FALLBACK_IMG} alt={c.name} className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/60 to-transparent" />
        <div className="container-x relative flex h-full items-end pb-8">
          <div className="flex items-end gap-5">
            {c.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logo_url} alt="" className="hidden h-24 w-24 rounded-2xl border-4 border-white bg-white object-contain sm:block" />
            )}
            <div className="text-white">
              <div className="mb-2 flex flex-wrap gap-2">
                {c.type && <span className="chip bg-white/15 text-white">{c.type}</span>}
                {c.accreditation && <span className="chip bg-white/15 text-white"><Award size={12} />{c.accreditation}</span>}
                {c.ranking && <span className="chip bg-accent-500 text-slate-900">#{c.ranking} Rank</span>}
              </div>
              <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{c.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-brand-100">
                <span className="flex items-center gap-1"><MapPin size={16} />{[c.city, c.state, c.country].filter(Boolean).join(', ')}</span>
                {c.established && <span className="flex items-center gap-1"><Calendar size={16} />Estd. {c.established}</span>}
                {count > 0 && <span className="flex items-center gap-1"><Stars value={avg} />{avg} ({count})</span>}
              </p>
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

      <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-10">
          <section id="overview" className="card scroll-mt-32 p-6">
            <h2 className="text-xl font-bold text-slate-900">About {c.short_name || c.name}</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600">{c.description || 'Details coming soon.'}</p>
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

          <section id="courses" className="scroll-mt-32">
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
                        <td className="px-4 py-3 font-medium text-slate-900">{co.name}{co.seats ? <span className="block text-xs text-slate-400">{co.seats} seats</span> : null}</td>
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
          </section>

          <section id="reviews" className="scroll-mt-32">
            <ReviewSection collegeId={c.id} collegeName={c.name} reviews={reviewList} avg={avg} count={count} />
          </section>

          <section id="hostels" className="scroll-mt-32">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xl font-bold text-slate-900">PG & hostels near {c.short_name || c.name}</h2>
              <Link href={`/hostels?city=${encodeURIComponent(c.city)}`} className="text-sm font-semibold text-brand-700 hover:underline">See all in {c.city}</Link>
            </div>
            {(hostels.data || []).length ? (
              <div className="grid gap-5 sm:grid-cols-2">{(hostels.data as Hostel[]).map((h) => <HostelCard key={h.id} h={h} />)}</div>
            ) : <EmptyState title="No PG or hostel listed yet" text="Check back soon — new stays are added every week." />}
          </section>

          <section id="jobs" className="scroll-mt-32">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xl font-bold text-slate-900">Part-time jobs near campus</h2>
              <Link href={`/jobs?city=${encodeURIComponent(c.city)}`} className="text-sm font-semibold text-brand-700 hover:underline">All jobs in {c.city}</Link>
            </div>
            {(jobs.data || []).length ? (
              <div className="grid gap-5 sm:grid-cols-2">{(jobs.data as Job[]).map((j) => <JobCard key={j.id} j={j} />)}</div>
            ) : <EmptyState title="No open jobs near this college right now" />}
          </section>

          <section id="nearby" className="scroll-mt-32">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Nearby companies, hospitals & services</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <PlaceList title="Companies (jobs & internships)" items={companies} />
              <PlaceList title="Hospitals" items={hospitals} />
              {otherPlaces.length > 0 && <PlaceList title="Banks & transport" items={otherPlaces} />}
            </div>
          </section>

          {c.photos?.length ? (
            <section id="gallery" className="scroll-mt-32">
              <h2 className="mb-4 text-xl font-bold text-slate-900">Gallery</h2>
              <Gallery photos={c.photos} alt={c.name} />
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <div className="card sticky top-32 p-5">
            <p className="text-xs text-slate-500">Fees per year</p>
            <p className="text-2xl font-extrabold text-slate-900">{range(c.fees_min, c.fees_max, c.currency)}</p>
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
            <a href="#reviews" className="btn-primary mt-2 w-full">Write a review</a>
          </div>
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
