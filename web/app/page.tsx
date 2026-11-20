import Link from 'next/link';
import {
  GraduationCap, Home, Briefcase, Users, Globe2, Star, MapPin, ArrowRight, ShieldCheck, Target, Scale, FilePlus2, Calculator, PlusCircle,
} from 'lucide-react';
import HeroSearch from '@/components/HeroSearch';
import { CollegeCard, HostelCard, JobCard } from '@/components/Cards';
import EnquiryForm from '@/components/EnquiryForm';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { counters, ratingsFor } from '@/lib/data';
import { getT } from '@/lib/i18n-server';
import { FALLBACK_IMG, timeAgo } from '@/lib/format';
import type { Article, College, Hostel, Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STREAMS = ['Engineering', 'Management', 'Medical', 'Commerce', 'Arts', 'Science', 'Law', 'Design'];
const COUNTRIES = [
  { name: 'India', flag: '🇮🇳' }, { name: 'Canada', flag: '🇨🇦' }, { name: 'United Kingdom', flag: '🇬🇧' },
  { name: 'Australia', flag: '🇦🇺' }, { name: 'Germany', flag: '🇩🇪' }, { name: 'United States', flag: '🇺🇸' },
];

async function load() {
  if (!hasSupabase) return { colleges: [], hostels: [], jobs: [], articles: [] };
  const sb = supabasePublic();
  const [c, h, j, a] = await Promise.all([
    sb.from('colleges').select('*').eq('is_published', true).order('is_featured', { ascending: false }).order('ranking', { ascending: true, nullsFirst: false }).limit(8),
    sb.from('hostels').select('*, colleges(name, slug)').eq('is_published', true).order('created_at', { ascending: false }).limit(4),
    sb.from('jobs').select('*').eq('is_published', true).eq('status', 'open').order('created_at', { ascending: false }).limit(6),
    sb.from('articles').select('id, slug, title, excerpt, category, cover_url, published_at').eq('is_published', true).order('published_at', { ascending: false }).limit(3),
  ]);
  return {
    colleges: (c.data || []) as College[], hostels: (h.data || []) as Hostel[],
    jobs: (j.data || []) as Job[], articles: (a.data || []) as Article[],
  };
}

export default async function HomePage() {
  const [{ colleges, hostels, jobs, articles }, stats, { t }] = await Promise.all([load(), counters(), getT()]);
  const ratings = await ratingsFor(colleges.map((c) => c.id));

  const statItems = [
    { icon: GraduationCap, label: t('home.stat.colleges'), value: stats.colleges },
    { icon: Globe2, label: t('home.stat.countries'), value: stats.countries },
    { icon: Home, label: t('home.stat.hostels'), value: stats.hostels },
    { icon: Briefcase, label: t('home.stat.jobs'), value: stats.jobs },
    { icon: Users, label: t('home.stat.students'), value: stats.students },
    { icon: Star, label: t('home.stat.reviews'), value: stats.reviews },
  ];
  const tools = [
    { href: '/predictor', icon: Target, title: t('home.tool.predictor'), text: t('home.tool.predictor.d') },
    { href: '/compare', icon: Scale, title: t('home.tool.compare'), text: t('home.tool.compare.d') },
    { href: '/apply', icon: FilePlus2, title: t('home.tool.apply'), text: t('home.tool.apply.d') },
    { href: '/study-abroad/calculator', icon: Calculator, title: t('home.tool.calc'), text: t('home.tool.calc.d') },
  ];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 pb-24 pt-16 text-white sm:pt-24">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="container-x relative text-center">
          <span className="chip mb-5 bg-white/10 text-brand-100">{t('home.badge')}</span>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {t('home.title1')} <span className="text-accent-400">{t('home.title2')}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-brand-100/90">{t('home.subtitle')}</p>
          <div className="mt-10"><HeroSearch /></div>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
            {STREAMS.slice(0, 6).map((s) => (
              <Link key={s} href={`/colleges?stream=${s}`} className="rounded-full border border-white/20 px-3 py-1 text-brand-100 hover:bg-white/10">{s}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="container-x relative z-10 -mt-12">
        <div className="card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-slate-100">
          {statItems.map((s) => (
            <div key={s.label} className="flex flex-col items-center p-5 text-center">
              <s.icon className="text-brand-600" size={22} />
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{s.value.toLocaleString()}</p>
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TOOLS */}
      <section className="container-x mt-14">
        <h2 className="section-title">{t('home.tools')}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((x) => (
            <Link key={x.href} href={x.href} className="card group flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white"><x.icon size={20} /></span>
              <div><p className="font-bold text-slate-900">{x.title}</p><p className="mt-0.5 text-sm text-slate-500">{x.text}</p></div>
            </Link>
          ))}
        </div>
      </section>

      {/* TOP COLLEGES */}
      <section className="container-x mt-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="section-title">{t('home.topColleges')}</h2>
            <p className="mt-1 text-slate-500">{t('home.topColleges.sub')}</p>
          </div>
          <Link href="/colleges" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline sm:flex">{t('home.viewAll')} <ArrowRight size={16} /></Link>
        </div>
        {colleges.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {colleges.map((c) => <CollegeCard key={c.id} c={c} rating={ratings[c.id]} />)}
          </div>
        ) : <SetupNotice />}
      </section>

      {/* COUNTRIES */}
      <section className="container-x mt-16">
        <h2 className="section-title">{t('home.world')}</h2>
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

      {/* STREAMS + COUNSELLING */}
      <section className="container-x mt-16 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <h2 className="section-title">{t('home.streams')}</h2>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {STREAMS.map((s) => (
              <Link key={s} href={`/colleges?stream=${s}`} className="card flex items-center justify-between p-4 font-semibold text-slate-800 hover:border-brand-300 hover:text-brand-700">
                {s}<ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </div>
        <EnquiryForm kind="counselling" />
      </section>

      {/* HOSTELS */}
      {hostels.length > 0 && (
        <section className="container-x mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="section-title">{t('home.hostels')}</h2>
              <p className="mt-1 text-slate-500">{t('home.hostels.sub')}</p>
            </div>
            <Link href="/hostels" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">{t('home.viewAll')} <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{hostels.map((h) => <HostelCard key={h.id} h={h} />)}</div>
        </section>
      )}

      {/* JOBS */}
      {jobs.length > 0 && (
        <section className="container-x mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="section-title">{t('home.jobs')}</h2>
              <p className="mt-1 text-slate-500">{t('home.jobs.sub')}</p>
            </div>
            <Link href="/jobs" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">{t('home.viewAll')} <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{jobs.map((j) => <JobCard key={j.id} j={j} />)}</div>
        </section>
      )}

      {/* OWNERS / EMPLOYERS */}
      <section className="container-x mt-16">
        <div className="card flex flex-col items-start justify-between gap-4 border-accent-400/40 bg-amber-50 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{t('home.owner.title')}</h3>
            <p className="text-sm text-slate-600">{t('home.owner.text')}</p>
          </div>
          <Link href="/post" className="btn-accent shrink-0"><PlusCircle size={16} />{t('home.owner.button')}</Link>
        </div>
      </section>

      {/* NEWS */}
      {articles.length > 0 && (
        <section className="container-x mt-16">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="section-title">{t('home.news')}</h2>
            <Link href="/news" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">{t('home.viewAll')} <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {articles.map((a) => (
              <Link key={a.id} href={`/news/${a.slug}`} className="card group overflow-hidden transition hover:shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.cover_url || FALLBACK_IMG} alt="" className="aspect-[16/8] w-full object-cover" loading="lazy" />
                <div className="p-4">
                  <span className="chip-brand capitalize">{a.category}</span>
                  <h3 className="mt-2 font-bold text-slate-900 group-hover:text-brand-700">{a.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{timeAgo(a.published_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container-x mt-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 to-brand-900 p-8 text-white sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold">{t('home.cta.title')}</h2>
              <p className="mt-3 text-brand-100">{t('home.cta.text')}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/login?mode=register" className="btn-accent">{t('home.cta.button')}</Link>
                <Link href="/near-me" className="btn border border-white/30 text-white hover:bg-white/10"><MapPin size={16} />{t('home.cta.near')}</Link>
              </div>
            </div>
            <ul className="grid gap-3 text-sm">
              {([t('home.cta.p1'), t('home.cta.p2'), t('home.cta.p3'), t('home.cta.p4')]).map((x) => (
                <li key={x} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3"><ShieldCheck size={18} className="text-accent-400" />{x}</li>
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
        {hasSupabase ? 'Add your first college from the Admin panel.' : 'Add your Supabase keys to web/.env.local and run the SQL files in supabase/.'}
      </p>
    </div>
  );
}
