import { Flag } from '@/components/Flag';
import Link from 'next/link';
import {
  GraduationCap, Home, Briefcase, Users, Globe2, Star, MapPin, ArrowRight, ShieldCheck, Target, Scale, FilePlus2, Calculator, PlusCircle, Flame, Play, Clapperboard, Heart, CalendarDays, Landmark,
} from 'lucide-react';
import { mediaUrl } from '@/lib/mediaUrl';
import HeroSearch from '@/components/HeroSearch';
import CityInput from '@/components/CityInput';
import { CollegeCard, HostelCard, JobCard } from '@/components/Cards';
import TopCollegesTable, { type TopRow } from '@/components/home/TopCollegesTable';
import EnquiryForm from '@/components/EnquiryForm';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { counters, ratingsFor } from '@/lib/data';
import { getT } from '@/lib/i18n-server';
import { STREAMS } from '@/lib/streams';
import { FALLBACK_IMG, timeAgo } from '@/lib/format';
import type { Article, College, Hostel, Job } from '@/lib/types';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts

const COUNTRIES = [
  { name: 'India', code: 'IN' }, { name: 'Canada', code: 'CA' }, { name: 'United Kingdom', code: 'GB' },
  { name: 'Australia', code: 'AU' }, { name: 'Germany', code: 'DE' }, { name: 'United States', code: 'US' },
  { name: 'Japan', code: 'JP' },
  { name: 'France', code: 'FR' }, { name: 'Ireland', code: 'IE' }, { name: 'Netherlands', code: 'NL' },
  { name: 'Italy', code: 'IT' }, { name: 'New Zealand', code: 'NZ' }, { name: 'Singapore', code: 'SG' },
  { name: 'United Arab Emirates', code: 'AE' }, { name: 'Russia', code: 'RU' }, { name: 'South Korea', code: 'KR' },
  { name: 'Spain', code: 'ES' }, { name: 'Sweden', code: 'SE' },
];

async function load() {
  if (!hasSupabase) return { colleges: [], hostels: [], jobs: [], articles: [], top: [], exams: [], courses: [], cities: [], streams: {} as Record<string, any>, trending: [] as any[], shots: [] as any[] };
  const sb = supabasePublic();
  const [c, h, j, a, top, ex, cat, cnt, cities, sov, tr, sh] = await Promise.all([
    sb.from('colleges_public').select('*').eq('is_published', true).order('is_featured', { ascending: false }).order('ranking', { ascending: true, nullsFirst: false }).limit(8),
    sb.from('hostels').select('*, colleges(name, slug)').eq('is_published', true).order('created_at', { ascending: false }).limit(4),
    sb.from('jobs').select('*').eq('is_published', true).eq('status', 'open').order('created_at', { ascending: false }).limit(6),
    sb.from('articles').select('id, slug, title, excerpt, category, cover_url, published_at').eq('is_published', true).order('published_at', { ascending: false }).limit(3),
    sb.rpc('top_colleges_table_v2', { p_stream: null, p_country: 'India', p_lim: 10 }),
    sb.from('exams').select('slug, short_name, stream, level, country').eq('is_published', true).order('short_name').limit(400),
    sb.from('course_catalog').select('slug, name, level, stream').order('sort'),
    sb.rpc('course_catalog_counts'),
    sb.rpc('top_study_cities', { p_country: 'India', p_lim: 12 }),
    sb.rpc('stream_overview'),
    sb.rpc('trending_courses', { p_lim: 8 }),
    sb.rpc('feed', { p_kind: 'shot', p_sort: 'trending', p_lim: 10 }),
  ]);
  const counts = Object.fromEntries(((cnt.data || []) as any[]).map((r) => [r.slug, Number(r.colleges)]));
  return {
    colleges: (c.data || []) as College[], hostels: (h.data || []) as Hostel[],
    jobs: (j.data || []) as Job[], articles: (a.data || []) as Article[],
    top: (top.data || []) as TopRow[], exams: (ex.data || []) as any[],
    courses: ((cat.data || []) as any[]).map((k) => ({ ...k, colleges: counts[k.slug] || 0 })),
    cities: (cities.data || []) as { city: string; state: string | null; colleges: number }[],
    trending: (tr.data || []) as { slug: string; name: string; full_name: string; level: string; stream: string; visitors: number; colleges: number }[],
    shots: (sh.data || []) as any[],
    streams: Object.fromEntries(((sov.data || []) as any[]).map((r) => [r.stream, r])) as Record<string, { colleges: number; exams: number; courses: number }>,
  };
}

export default async function HomePage() {
  const [{ colleges, hostels, jobs, articles, top, exams, courses, cities, streams, trending, shots }, stats, { t }] = await Promise.all([load(), counters(), getT()]);
  const examNames: Record<string, string> = Object.fromEntries(exams.map((e: any) => [e.slug, e.short_name]));
  const POPULAR_EXAMS = ['jee-main', 'neet-ug', 'cuet-ug', 'cat', 'gate', 'jee-advanced', 'clat', 'mht-cet', 'xat', 'upsc-cse-prelims', 'ssc-cgl', 'ibps-po'];
  const popularExams = POPULAR_EXAMS.map((s) => exams.find((e: any) => e.slug === s)).filter(Boolean) as any[];
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
    { href: '/rank-predictor', icon: Calculator, title: t('home.tool.rank'), text: t('home.tool.rank.d') },
    { href: '/exams/calendar', icon: CalendarDays, title: 'Exam calendar', text: 'Every upcoming last date, admit card, exam and result — with reminders' },
    { href: '/education-loan', icon: Landmark, title: 'Education loan EMI', text: 'Your EMI and total interest, including the study period' },
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
          <div className="mx-auto mt-4 flex max-w-3xl flex-col items-center gap-2 text-sm sm:flex-row">
            <span className="shrink-0 text-brand-100">or explore a city:</span>
            <CityInput mode="navigate" className="w-full text-slate-800" />
            <Link href="/cities" className="shrink-0 text-brand-100 underline">All countries</Link>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
            {STREAMS.slice(0, 8).map((s) => (
              <Link key={s.slug} href={`/streams/${s.slug}`} className="rounded-full border border-white/20 px-3 py-1 text-brand-100 hover:bg-white/10">{s.label}</Link>
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((x) => (
            <Link key={x.href} href={x.href} className="card group flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white"><x.icon size={20} /></span>
              <div><p className="font-bold text-slate-900">{x.title}</p><p className="mt-0.5 text-sm text-slate-500">{x.text}</p></div>
            </Link>
          ))}
        </div>
      </section>

      {/* TRENDING SHOTS */}
      {(
        <section className="mt-14 bg-slate-950 py-8 text-white">
          <div className="container-x">
            <div className="mb-4 flex items-end justify-between">
              <div><h2 className="flex items-center gap-2 text-2xl font-extrabold"><Clapperboard size={24} className="text-fuchsia-400" />Trending shots</h2><p className="mt-1 text-sm text-slate-400">Short campus videos by students — fests, hostels, campus tours</p></div>
              <Link href="/community/shots" className="flex items-center gap-1 text-sm font-semibold text-fuchsia-300 hover:underline">Watch all <ArrowRight size={16} /></Link>
            </div>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
              {shots.map((s: any) => {
                const m = s.media?.[0];
                return (
                  <Link key={s.id} href={`/community/shots?start=${s.id}`} className="group relative aspect-[9/16] w-36 shrink-0 snap-start overflow-hidden rounded-2xl bg-slate-800 sm:w-44">
                    {m?.type === 'video'
                      ? <video src={`${mediaUrl(m.path)}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover transition group-hover:scale-105" />
                      // eslint-disable-next-line @next/next/no-img-element
                      : m && <img src={mediaUrl(m.path)} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover transition group-hover:scale-105" />}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                    {m?.type === 'video' && <Play size={30} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 fill-white/90 text-white/90 drop-shadow" />}
                    <span className="absolute inset-x-0 bottom-0 p-2.5 text-xs">
                      <b className="block truncate">@{s.author_username || s.author_name}</b>
                      {s.body && <span className="line-clamp-2 text-white/80">{s.body}</span>}
                      <span className="mt-1 flex items-center gap-1 text-white/80"><Heart size={11} className="fill-rose-500 text-rose-500" />{s.likes}</span>
                    </span>
                  </Link>);
              })}
              <Link href="/community/shots?new=1" className="grid aspect-[9/16] w-36 shrink-0 snap-start place-items-center rounded-2xl border-2 border-dashed border-white/20 text-center text-sm text-slate-300 hover:border-fuchsia-400 hover:text-white sm:w-44">
                <span><PlusCircle size={28} className="mx-auto mb-1" />{shots.length ? 'Post your shot' : 'Post the first shot'}</span>
              </Link>
              {shots.length === 0 && ['🎓 Campus tour', '🎉 Fest moments', '🏠 Hostel room', '🍜 Canteen food', '📚 Exam-day vibes'].map((idea) => (
                <Link key={idea} href="/community/shots?new=1" className="relative grid aspect-[9/16] w-36 shrink-0 snap-start place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-700/60 via-slate-800 to-brand-800/60 p-3 text-center sm:w-44">
                  <span className="text-sm font-semibold">{idea}<span className="mt-1 block text-[11px] font-normal text-white/60">Film it in 60 s and post it here</span></span>
                  <Play size={22} className="absolute bottom-3 end-3 fill-white/40 text-white/40" />
                </Link>))}
            </div>
          </div>
        </section>)}

      {/* TOP COLLEGES */}
      <section className="container-x mt-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="section-title">{t('home.topColleges')}</h2>
            <p className="mt-1 text-slate-500">{top.length ? `By NIRF ${(top[0] as any)?.rank_year || ''} rank — with other rankings, reviews and fees where published` : t('home.topColleges.sub')}</p>
          </div>
          <Link href="/colleges" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline sm:flex">{t('home.viewAll')} <ArrowRight size={16} /></Link>
        </div>
        {top.length ? <TopCollegesTable initial={top} examNames={examNames} />
          : colleges.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {colleges.map((c) => <CollegeCard key={c.id} c={c} rating={ratings[c.id]} />)}
          </div>
        ) : <SetupNotice />}
      </section>

      {/* TRENDING COURSES */}
      {trending.length > 0 && (
        <section className="container-x mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div><h2 className="section-title flex items-center gap-2"><Flame size={24} className="text-orange-500" />{trending.some((k) => Number(k.visitors) > 0) ? 'Trending courses this week' : 'Popular courses'}</h2>
              <p className="mt-1 text-slate-500">What students are checking out most right now</p></div>
            <Link href="/courses" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline sm:flex">All courses <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trending.map((k, i) => (
              <Link key={k.slug} href={`/courses/${k.slug}`} className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-extrabold ${i < 3 ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'}`}>{i + 1}</span>
                <span className="min-w-0">
                  <b className="block truncate text-slate-900 group-hover:text-orange-700">{k.name}</b>
                  <span className="block truncate text-xs text-slate-500">{k.full_name}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-orange-600">
                    {Number(k.visitors) > 0 ? `🔥 ${Number(k.visitors).toLocaleString('en-IN')} student${Number(k.visitors) > 1 ? 's' : ''} this week` : `${Number(k.colleges).toLocaleString('en-IN')} colleges`}
                  </span>
                </span>
              </Link>))}
          </div>
        </section>)}

      {/* COURSES */}
      {courses.length > 0 && (
        <section className="container-x mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div><h2 className="section-title">Explore courses</h2><p className="mt-1 text-slate-500">Fees, eligibility, entrance exams and the colleges that offer each course</p></div>
            <Link href="/courses" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline sm:flex">All courses <ArrowRight size={16} /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {courses.slice(0, 12).map((k: any) => (
              <Link key={k.slug} href={`/courses/${k.slug}`} className="card p-4 transition hover:border-brand-300 hover:shadow-md">
                <p className="font-bold text-slate-900">{k.name}</p>
                <p className="text-xs text-slate-500">{k.stream} · {k.level}</p>
                {k.colleges > 0 && <p className="mt-2 text-xs font-semibold text-brand-700">{k.colleges.toLocaleString('en-IN')} college{k.colleges > 1 ? 's' : ''}</p>}
              </Link>))}
          </div>
        </section>)}

      {/* EXAMS + CITIES */}
      {(popularExams.length > 0 || cities.length > 0) && (
        <section className="container-x mt-16 grid gap-8 lg:grid-cols-2">
          {popularExams.length > 0 && <div>
            <div className="mb-4 flex items-end justify-between"><h2 className="section-title">Popular entrance exams</h2><Link href="/exams" className="text-sm font-semibold text-brand-700 hover:underline">All exams</Link></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{popularExams.map((e) => (
              <Link key={e.slug} href={`/exams/${e.slug}`} className="card px-3 py-2.5 hover:border-brand-300"><p className="font-semibold text-slate-900">{e.short_name}</p><p className="text-xs text-slate-500">{e.stream || e.level}</p></Link>))}</div>
          </div>}
          {cities.length > 0 && <div>
            <div className="mb-4 flex items-end justify-between"><h2 className="section-title">Study in these cities</h2><Link href="/cities" className="text-sm font-semibold text-brand-700 hover:underline">All cities</Link></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{cities.map((c) => (
              <Link key={c.city} href={`/colleges?city=${encodeURIComponent(c.city)}`} className="card px-3 py-2.5 hover:border-brand-300"><p className="font-semibold text-slate-900">{c.city}</p><p className="text-xs text-slate-500">{Number(c.colleges).toLocaleString('en-IN')} college{Number(c.colleges) > 1 ? 's' : ''}</p></Link>))}</div>
          </div>}
        </section>)}

      {/* COUNTRIES */}
      <section className="container-x mt-16">
        <div className="flex items-end justify-between"><h2 className="section-title">{t('home.world')}</h2><Link href="/cities" className="text-sm font-semibold text-brand-700 hover:underline">All countries</Link></div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {COUNTRIES.map((c) => (
            <Link key={c.name} href={`/colleges?country=${encodeURIComponent(c.name)}`}
              className="card flex flex-col items-center p-5 text-center transition hover:border-brand-300 hover:shadow-md">
              <Flag code={c.code} country={c.name} className="h-10 w-14 rounded-md" />
              <span className="mt-2 text-sm font-semibold text-slate-800">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* STREAMS + COUNSELLING */}
      <section className="container-x mt-16 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="flex items-end justify-between"><h2 className="section-title">{t('home.streams')}</h2><Link href="/streams" className="text-sm font-semibold text-brand-700 hover:underline">All streams</Link></div>
          <p className="mt-1 text-slate-500">Colleges, courses, entrance exams and predictors for each field.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STREAMS.slice(0, 9).map((s) => (
              <Link key={s.slug} href={`/streams/${s.slug}`} className="card group p-4 transition hover:-translate-y-0.5 hover:border-brand-300">
                <p className="flex items-center justify-between font-semibold text-slate-800 group-hover:text-brand-700">{s.label}<ArrowRight size={15} className="text-slate-300 group-hover:text-brand-600" /></p>
                <p className="mt-1 text-xs text-slate-500">{(streams[s.name]?.colleges || 0).toLocaleString('en-IN')} colleges · {streams[s.name]?.exams || 0} exams</p>
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
