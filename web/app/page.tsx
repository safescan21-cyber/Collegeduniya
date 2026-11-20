import Link from 'next/link';
import { GraduationCap, Home, Briefcase, Users, Globe2, Star, MapPin, ArrowRight, ShieldCheck } from 'lucide-react';
import HeroSearch from '@/components/HeroSearch';
import { CollegeCard, HostelCard, JobCard } from '@/components/Cards';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { counters, ratingsFor } from '@/lib/data';
import type { College, Hostel, Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STREAMS = ['Engineering', 'Management', 'Medical', 'Commerce', 'Arts', 'Science', 'Law', 'Design'];
const COUNTRIES = [
  { name: 'India', flag: '🇮🇳' }, { name: 'Canada', flag: '🇨🇦' }, { name: 'United Kingdom', flag: '🇬🇧' },
  { name: 'Australia', flag: '🇦🇺' }, { name: 'Germany', flag: '🇩🇪' }, { name: 'United States', flag: '🇺🇸' },
];

async function load() {
  if (!hasSupabase) return { colleges: [], hostels: [], jobs: [] };
  const sb = supabasePublic();
  const [c, h, j] = await Promise.all([
    sb.from('colleges').select('*').eq('is_published', true).order('is_featured', { ascending: false }).order('ranking', { ascending: true, nullsFirst: false }).limit(8),
    sb.from('hostels').select('*, colleges(name, slug)').eq('is_published', true).order('created_at', { ascending: false }).limit(4),
    sb.from('jobs').select('*').eq('is_published', true).eq('status', 'open').order('created_at', { ascending: false }).limit(6),
  ]);
  return { colleges: (c.data || []) as College[], hostels: (h.data || []) as Hostel[], jobs: (j.data || []) as Job[] };
}

export default async function HomePage() {
  const [{ colleges, hostels, jobs }, stats] = await Promise.all([load(), counters()]);
  const ratings = await ratingsFor(colleges.map((c) => c.id));

  const statItems = [
    { icon: GraduationCap, label: 'Colleges', value: stats.colleges },
    { icon: Globe2, label: 'Countries', value: stats.countries },
    { icon: Home, label: 'PG & Hostels', value: stats.hostels },
    { icon: Briefcase, label: 'Open jobs', value: stats.jobs },
    { icon: Users, label: 'Students joined', value: stats.students },
    { icon: Star, label: 'Reviews', value: stats.reviews },
  ];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 pb-24 pt-16 text-white sm:pt-24">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="container-x relative text-center">
          <span className="chip mb-5 bg-white/10 text-brand-100">🎓 Study · 💼 Earn · 🏠 Stay</span>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Find your college, a room nearby <span className="text-accent-400">and a job to pay for it</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-brand-100/90">
            Compare colleges worldwide by fees, courses and real student reviews. Discover PGs and hostels next to campus, and apply to part-time jobs in one click.
          </p>
          <div className="mt-10"><HeroSearch /></div>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
            {STREAMS.slice(0, 6).map((s) => (
              <Link key={s} href={`/colleges?stream=${s}`} className="rounded-full border border-white/20 px-3 py-1 text-brand-100 hover:bg-white/10">{s}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="container-x -mt-12 relative z-10">
        <div className="card grid grid-cols-2 divide-slate-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
          {statItems.map((s) => (
            <div key={s.label} className="flex flex-col items-center p-5 text-center">
              <s.icon className="text-brand-600" size={22} />
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{s.value.toLocaleString()}</p>
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TOP COLLEGES */}
      <section className="container-x mt-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="section-title">Top colleges</h2>
            <p className="mt-1 text-slate-500">Ranked institutions students are exploring right now</p>
          </div>
          <Link href="/colleges" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline sm:flex">View all <ArrowRight size={16} /></Link>
        </div>
        {colleges.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {colleges.map((c) => <CollegeCard key={c.id} c={c} rating={ratings[c.id]} />)}
          </div>
        ) : <SetupNotice />}
      </section>

      {/* COUNTRIES */}
      <section className="container-x mt-16">
        <h2 className="section-title">Study anywhere in the world</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {COUNTRIES.map((c) => (
            <Link key={c.name} href={`/colleges?country=${encodeURIComponent(c.name)}`}
              className="card flex flex-col items-center p-5 text-center transition hover:border-brand-300 hover:shadow-md">
              <span className="text-4xl">{c.flag}</span>
              <span className="mt-2 text-sm font-semibold text-slate-800">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* STREAMS */}
      <section className="container-x mt-16">
        <h2 className="section-title">Browse by stream</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STREAMS.map((s) => (
            <Link key={s} href={`/colleges?stream=${s}`} className="card flex items-center justify-between p-4 font-semibold text-slate-800 hover:border-brand-300 hover:text-brand-700">
              {s}<ArrowRight size={16} />
            </Link>
          ))}
        </div>
      </section>

      {/* HOSTELS */}
      {hostels.length > 0 && (
        <section className="container-x mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="section-title">PG & hostels near campus</h2>
              <p className="mt-1 text-slate-500">Verified stays with food, Wi-Fi and security</p>
            </div>
            <Link href="/hostels" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">View all <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{hostels.map((h) => <HostelCard key={h.id} h={h} />)}</div>
        </section>
      )}

      {/* JOBS */}
      {jobs.length > 0 && (
        <section className="container-x mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="section-title">Part-time jobs for students</h2>
              <p className="mt-1 text-slate-500">Earn while you study — register and apply in one click</p>
            </div>
            <Link href="/jobs" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">View all <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{jobs.map((j) => <JobCard key={j.id} j={j} />)}</div>
        </section>
      )}

      {/* CTA */}
      <section className="container-x mt-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 to-brand-900 p-8 text-white sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold">Join free with just your email</h2>
              <p className="mt-3 text-brand-100">No password needed — we send a one-time code to your inbox. Save colleges, write reviews and apply for jobs.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/login?mode=register" className="btn-accent">Create free account</Link>
                <Link href="/near-me" className="btn border border-white/30 text-white hover:bg-white/10"><MapPin size={16} />Explore near me</Link>
              </div>
            </div>
            <ul className="grid gap-3 text-sm">
              {['Real reviews from verified students', 'Fees, courses and eligibility for every college', 'PG & hostels with rent and amenities', 'Part-time jobs and internships near your campus'].map((t) => (
                <li key={t} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3"><ShieldCheck size={18} className="text-accent-400" />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function SetupNotice() {
  return (
    <div className="card p-8 text-center">
      <h3 className="font-semibold text-slate-900">No colleges yet</h3>
      <p className="mt-1 text-sm text-slate-500">
        {hasSupabase ? 'Add your first college from the Admin panel.' : 'Add your Supabase keys to web/.env.local and run supabase/schema.sql + seed.sql.'}
      </p>
    </div>
  );
}
