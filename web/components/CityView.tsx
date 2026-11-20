import Link from 'next/link';
import { MapPin, Users, GraduationCap, Home, Briefcase, Clock } from 'lucide-react';
import { CollegeCard, HostelCard, JobCard, EmptyState } from './Cards';
import { LiveJobs, LiveNearby } from './LiveData';
import EnquiryForm from './EnquiryForm';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { ratingsFor } from '@/lib/data';
import { getT } from '@/lib/i18n-server';
import type { College, Hostel, Job } from '@/lib/types';

export type CityInfo = {
  geoname_id: number | null; name: string; admin1: string | null; country: string | null; country_code: string | null;
  latitude: number; longitude: number; population: number | null; timezone?: string | null; slug?: string | null;
};

const flag = (cc?: string | null) => (cc && cc.length === 2 ? String.fromCodePoint(...cc.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0))) : '🌍');

export default async function CityView({ city }: { city: CityInfo }) {
  const { t } = await getT();
  let colleges: College[] = []; let hostels: Hostel[] = []; let jobs: Job[] = [];
  let nearbyCities: { name: string; slug: string; population: number }[] = [];
  if (hasSupabase) {
    const sb = supabasePublic();
    const name = city.name.replace(/[",()%]/g, '');
    const [inCity, near, hIn, hNear, j, nc] = await Promise.all([
      sb.from('colleges').select('*').eq('is_published', true).ilike('city', name).order('ranking', { ascending: true, nullsFirst: false }).limit(24),
      sb.rpc('nearby_colleges', { lat: city.latitude, lng: city.longitude, radius_km: 40 }),
      sb.from('hostels').select('*, colleges(name, slug), hostel_rooms(beds_available)').eq('is_published', true).ilike('city', name).limit(12),
      sb.rpc('nearby_hostels', { lat: city.latitude, lng: city.longitude, radius_km: 25 }),
      sb.from('jobs').select('*').eq('is_published', true).eq('status', 'open').ilike('city', name).order('created_at', { ascending: false }).limit(9),
      city.country_code
        ? sb.from('cities').select('name, slug, population, latitude, longitude').eq('country_code', city.country_code)
            .gte('latitude', city.latitude - 1).lte('latitude', city.latitude + 1).gte('longitude', city.longitude - 1.2).lte('longitude', city.longitude + 1.2)
            .neq('name', city.name).order('population', { ascending: false }).limit(12)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const byId = new Map<string, College>();
    for (const c of (inCity.data || []) as College[]) byId.set(c.id, c);
    for (const c of (near.data || []) as any[]) if (!byId.has(c.id)) byId.set(c.id, c as College);
    colleges = Array.from(byId.values()).slice(0, 24);
    const hById = new Map<string, Hostel>();
    for (const h of (hIn.data || []) as Hostel[]) hById.set(h.id, h);
    for (const h of (hNear.data || []) as any[]) if (!hById.has(h.id)) hById.set(h.id, h as Hostel);
    hostels = Array.from(hById.values()).slice(0, 12);
    jobs = (j.data || []) as Job[];
    nearbyCities = (nc.data || []) as any[];
  }
  const ratings = await ratingsFor(colleges.map((c) => c.id));
  const local = city.timezone ? new Date().toLocaleTimeString('en-GB', { timeZone: city.timezone, hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <>
      <section className="bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 py-12 text-white">
        <div className="container-x">
          <Link href={city.country_code ? `/cities?country=${city.country_code}` : '/cities'} className="text-sm text-brand-200 hover:underline">{flag(city.country_code)} {city.country}</Link>
          <h1 className="mt-2 text-4xl font-extrabold">{t('city.title')} {city.name}</h1>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-brand-100">
            <span className="flex items-center gap-1"><MapPin size={16} />{[city.admin1, city.country].filter(Boolean).join(', ')}</span>
            {city.population ? <span className="flex items-center gap-1"><Users size={16} />{city.population.toLocaleString()} people</span> : null}
            {local && <span className="flex items-center gap-1"><Clock size={16} />Local time {local}</span>}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <a href="#colleges" className="btn bg-white/10 text-white hover:bg-white/20"><GraduationCap size={16} />{colleges.length} colleges</a>
            <a href="#stay" className="btn bg-white/10 text-white hover:bg-white/20"><Home size={16} />{hostels.length} PG & hostels</a>
            <a href="#jobs" className="btn bg-white/10 text-white hover:bg-white/20"><Briefcase size={16} />Jobs</a>
          </div>
        </div>
      </section>

      <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-12">
          <section id="colleges" className="scroll-mt-24">
            <h2 className="section-title mb-5">Colleges in & near {city.name}</h2>
            {colleges.length ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{colleges.map((c) => <CollegeCard key={c.id} c={c} rating={ratings[c.id]} />)}</div>
            ) : <EmptyState icon={<GraduationCap size={28} />} title={`No colleges listed in ${city.name} yet`} text="Ask our counsellors — we can still help you find options nearby." />}
          </section>

          <section id="stay" className="scroll-mt-24">
            <div className="mb-5 flex items-end justify-between">
              <h2 className="section-title">PG & hostels</h2>
              <Link href={`/hostels?city=${encodeURIComponent(city.name)}`} className="text-sm font-semibold text-brand-700 hover:underline">All in {city.name}</Link>
            </div>
            {hostels.length ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{hostels.map((h) => <HostelCard key={h.id} h={h} />)}</div>
            ) : <EmptyState icon={<Home size={28} />} title="No verified PGs listed yet" text="Own a PG here? List it free from “List your PG”." />}
            <div className="mt-5"><LiveNearby lat={city.latitude} lng={city.longitude} kinds={['pg', 'hospital', 'pharmacy', 'transport', 'bank']} radius={5000} title={`Around ${city.name} (map data)`} /></div>
          </section>

          <section id="jobs" className="scroll-mt-24 space-y-5">
            <h2 className="section-title">Part-time jobs in {city.name}</h2>
            {jobs.length > 0 && <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{jobs.map((j) => <JobCard key={j.id} j={j} />)}</div>}
            <LiveJobs city={city.name} country={city.country_code} />
          </section>

          {nearbyCities.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-slate-900">Cities near {city.name}</h2>
              <div className="flex flex-wrap gap-2">{nearbyCities.map((c) => <Link key={c.slug} href={`/city/${c.slug}`} className="chip hover:bg-brand-50 hover:text-brand-700">{c.name}</Link>)}</div>
            </section>
          )}
        </div>
        <aside><div className="lg:sticky lg:top-24"><EnquiryForm title={`Studying in ${city.name}?`} subtitle="Free help with colleges, PGs and part-time work." /></div></aside>
      </div>
    </>
  );
}
