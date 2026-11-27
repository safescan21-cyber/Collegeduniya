import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, TrendingUp, TrendingDown, Sparkles, Globe2, Flame, ArrowRight, BookOpen, Briefcase, Wallet } from 'lucide-react';
import { short, lpa, money } from '@/lib/format';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const revalidate = 3600;
type SP = Record<string, string | undefined>;
type Row = { rank: number | null; rank_band: string | null; name: string; city: string | null; state: string | null; college_id: string | null };
type Facts = { id: string; slug: string; city: string | null; state: string | null; country: string | null; photo: string | null; logo: string | null; courses: number;
  fee_min: number | null; fee_currency: string | null; fee_min_inr: number | null; placement: number | null; placement_kind: string | null; placement_currency: string | null;
  placement_year: number | null; median_earnings: number | null; top_courses: { name: string; level: string | null; fees: number | null; currency: string }[] };
type Trend = { slug: string; name: string; full_name: string | null; visitors: number; colleges: number };

// fee in the college's own currency, with rupees alongside for foreign fees
const feeText = (f?: Facts) => !f?.fee_min ? null : f.fee_currency && f.fee_currency !== 'INR'
  ? `${money(f.fee_min, f.fee_currency)}${f.fee_min_inr ? ` (≈${short(f.fee_min_inr)})` : ''}` : short(f.fee_min);
const placeText = (f?: Facts) => f?.placement ? `${lpa(f.placement, f.placement_currency || 'INR')} ${f.placement_kind || ''}`.trim()
  : f?.median_earnings ? `${money(f.median_earnings, 'USD')} earnings` : null;
const initials = (n: string) => n.replace(/\(.*?\)/g, '').split(/[\s,-]+/).filter((w) => w.length > 2 && !/^(of|the|and|for)$/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function Thumb({ f, name, size = 'h-10 w-10' }: { f?: Facts; name: string; size?: string }) {
  const src = f?.logo || f?.photo;
  // the initials sit underneath: a logo that fails to load (alt="") leaves them showing instead of an empty box
  return <span className={`${size} relative grid shrink-0 place-items-center overflow-hidden rounded-lg ${src ? 'border border-slate-100 bg-brand-50 text-brand-700' : 'bg-gradient-to-br from-brand-500 to-indigo-600 text-white'} text-xs font-extrabold`}>
    {initials(name) || '🎓'}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {src && <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full bg-white object-contain p-0.5" />}
  </span>;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const cat = sp.category || 'Overall'; const y = sp.year || '';
  if (sp.src === 'world') return { title: 'World university ranking — research (CWTS Leiden Ranking Open Edition)', description: 'Universities worldwide ordered by scientific publications (CWTS Leiden Ranking Open Edition, open data), with links to each college’s courses and fees.', alternates: { canonical: '/rankings?src=world' } };
  return {
    title: `NIRF ${y ? `${y} ` : ''}ranking — ${cat === 'Overall' ? 'top institutions in India' : `top ${cat.toLowerCase()} institutions`}`,
    description: `Full NIRF India Rankings${y ? ` ${y}` : ''} list for ${cat}, with rank changes from the previous year and links to each college’s fees, courses and reviews.`,
    alternates: { canonical: `/rankings${sp.year || sp.category ? `?${new URLSearchParams(Object.entries({ year: sp.year, category: sp.category }).filter(([, v]) => v) as [string, string][])}` : ''}` },
  };
}

export default async function RankingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (!hasSupabase) return null;
  const sb = supabasePublic({ revalidate: 3600 });
  const world = sp.src === 'world';
  const SRC = world ? 'Leiden' : 'NIRF';
  const { data: idx } = await sb.rpc('ranking_list_index', { p_source: SRC });
  const index = (idx || []) as { year: number; category: string; n: number }[];
  const years = Array.from(new Set(index.map((i) => i.year))).sort((a, b) => b - a);
  const year = Number(sp.year) && years.includes(Number(sp.year)) ? Number(sp.year) : years[0];
  const cats = index.filter((i) => i.year === year).map((i) => i.category);
  const ORDER = ['Overall', 'Universities', 'Colleges', 'Engineering', 'Management', 'Medical', 'Pharmacy', 'Law', 'Dental', 'Architecture & Planning', 'Agriculture', 'Research Institutions', 'State Public Universities', 'Innovation', 'SDGs', 'Open Universities', 'Skill Universities'];
  cats.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  const category = sp.category && cats.includes(sp.category) ? sp.category : cats.includes('Overall') ? 'Overall' : cats[0];

  const [{ data: list }, { data: prev }] = year ? await Promise.all([
    sb.from('ranking_lists').select('rank, rank_band, name, city, state, college_id').eq('source', SRC).eq('year', year).eq('category', category).order('rank', { ascending: true, nullsFirst: false }).limit(world ? 500 : 300),
    sb.from('ranking_lists').select('rank, name, city, college_id').eq('source', SRC).eq('year', year - 1).eq('category', category).limit(300),
  ]) : [{ data: [] }, { data: [] }];
  // two imports sometimes wrote one institution twice at the same rank ("Shiv Nadar University" / "Shiv Nadar", city "University"):
  // keep one row per rank and name — the one linked to a college page, else the longer, fuller name
  const norm = (n: string) => String(n).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
  const rows = ((list || []) as Row[]).reduce<Row[]>((acc, r) => {
    const i = acc.findIndex((a) => a.rank != null && a.rank === r.rank && (norm(a.name).startsWith(norm(r.name)) || norm(r.name).startsWith(norm(a.name))));
    if (i < 0) acc.push(r);
    else if ((!acc[i].college_id && r.college_id) || (!!acc[i].college_id === !!r.college_id && r.name.length > acc[i].name.length && !/^university$/i.test(String(r.city)))) acc[i] = r;
    return acc;
  }, []);
  const ids = rows.map((r) => r.college_id).filter(Boolean) as string[];
  // world ranking under the NIRF list (latest Leiden year), and the courses students are looking at this week
  const worldTop = async (): Promise<Row[]> => {
    if (world) return [];
    const { data: wi } = await sb.rpc('ranking_list_index', { p_source: 'Leiden' });
    const w = ((wi || []) as { year: number; category: string }[]).sort((a, b) => b.year - a.year)[0];
    if (!w) return [];
    const { data } = await sb.from('ranking_lists').select('rank, rank_band, name, city, state, college_id').eq('source', 'Leiden').eq('year', w.year).eq('category', w.category)
      .not('rank', 'is', null).order('rank', { ascending: true }).limit(24);
    return (data || []) as Row[];
  };
  const [wrows, { data: tr }] = await Promise.all([worldTop(), sb.rpc('trending_courses', { p_lim: 8 })]);
  const trending = (tr || []) as Trend[];
  const allIds = [...new Set([...ids, ...wrows.map((r) => r.college_id).filter(Boolean) as string[]])];
  const { data: fx } = allIds.length ? await sb.rpc('rank_card_facts', { p_ids: allIds }) : { data: [] };
  const slug = new Map(((fx || []) as Facts[]).map((c) => [c.id, c]));
  // the reports spell some names differently from year to year ("BITS -Pilani" / "BITS - Pilani"): compare on letters only
  const nk = (name: string, city: string | null) => `${String(name).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')}|${String(city || '').toLowerCase().replace(/[^a-z]/g, '')}`;
  const before = new Map<string, number>();
  for (const p of (prev || []) as any[]) { if (p.rank) { if (p.college_id) before.set(p.college_id, p.rank); before.set(nk(p.name, p.city), p.rank); } }
  const prevRank = (r: Row) => (r.college_id ? before.get(r.college_id) : undefined) ?? before.get(nk(r.name, r.city));
  const moves = rows.filter((r) => r.rank && prevRank(r)).map((r) => ({ r, d: prevRank(r)! - r.rank! }));
  const up = [...moves].sort((a, b) => b.d - a.d).filter((m) => m.d >= 3).slice(0, 5);
  const down = [...moves].sort((a, b) => a.d - b.d).filter((m) => m.d <= -3).slice(0, 5);
  const fresh = (prev || []).length ? rows.filter((r) => r.rank && !prevRank(r)).slice(0, 5) : [];
  const href = (y: number, c: string) => `/rankings?${new URLSearchParams({ ...(world ? { src: 'world' } : {}), year: String(y), category: c })}`;
  // every name opens the full college page (courses, fees, placements, reviews…); not on Collegeolo yet → search for it
  const Inst = ({ r }: { r: Row }) => { const c = r.college_id ? slug.get(r.college_id) : null;
    return <Link href={c ? `/colleges/${c.slug}` : `/colleges?q=${encodeURIComponent(r.name)}`} className="font-semibold text-slate-900 hover:text-brand-700">{r.name}</Link>; };

  return (
    <div className="container-x py-10">
      <div className="mb-4 flex gap-2"><Link href="/rankings" className={world ? 'chip' : 'chip-brand'}>🇮🇳 India (NIRF)</Link><Link href="/rankings?src=world" className={world ? 'chip-brand' : 'chip'}>🌍 World (research)</Link></div>
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Trophy className="text-amber-500" />{world ? `World university ranking ${year || ''} — research` : `NIRF India Rankings ${year || ''}`}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{world
        ? 'Universities worldwide ordered by the number of scientific publications (all sciences, fractional counting) from the CWTS Leiden Ranking Open Edition. It measures research output only — not teaching quality, fees or placements.'
        : 'The Government of India’s official ranking of colleges and universities (National Institutional Ranking Framework, Ministry of Education). Pick a year and a category; rank changes are compared with the year before.'}</p>
      {!years.length ? <p className="mt-8 text-slate-500">Rankings are being loaded — check back shortly.</p> : <>
        <div className="mt-6 flex flex-wrap gap-2">{years.map((y) => <Link key={y} href={href(y, category)} className={y === year ? 'chip-brand' : 'chip'}>{y}</Link>)}</div>
        <div className="mt-3 flex flex-wrap gap-2">{cats.map((c) => <Link key={c} href={href(year, c)} className={c === category ? 'btn-primary py-1.5 text-sm' : 'btn-ghost py-1.5 text-sm'}>{c}</Link>)}</div>

        {(up.length > 0 || down.length > 0 || fresh.length > 0) && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {up.length > 0 && <div className="card p-4"><p className="flex items-center gap-1.5 font-bold text-emerald-700"><TrendingUp size={17} />Biggest climbers</p><ul className="mt-2 space-y-1.5 text-sm">{up.map(({ r, d }) => <li key={r.name}><Inst r={r} /> <span className="text-emerald-700">▲{d}</span> <span className="text-slate-500">#{prevRank(r)} → #{r.rank}</span></li>)}</ul></div>}
            {down.length > 0 && <div className="card p-4"><p className="flex items-center gap-1.5 font-bold text-rose-700"><TrendingDown size={17} />Biggest falls</p><ul className="mt-2 space-y-1.5 text-sm">{down.map(({ r, d }) => <li key={r.name}><Inst r={r} /> <span className="text-rose-700">▼{-d}</span> <span className="text-slate-500">#{prevRank(r)} → #{r.rank}</span></li>)}</ul></div>}
            {fresh.length > 0 && <div className="card p-4"><p className="flex items-center gap-1.5 font-bold text-brand-700"><Sparkles size={17} />New in the list</p><ul className="mt-2 space-y-1.5 text-sm">{fresh.map((r) => <li key={r.name}><Inst r={r} /> <span className="text-slate-500">#{r.rank}</span></li>)}</ul></div>}
          </div>
        )}

        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2.5">Rank</th><th className="px-4 py-2.5">Institution</th><th className="px-4 py-2.5">{world ? 'Country' : 'City'}</th>{!world && <th className="px-4 py-2.5">State</th>}<th className="px-4 py-2.5">Courses</th><th className="px-4 py-2.5">Fees / year</th><th className="px-4 py-2.5">Placement</th><th className="px-4 py-2.5">vs {year - 1}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r) => { const f = r.college_id ? slug.get(r.college_id) : undefined; const p = prevRank(r); const d = p && r.rank ? p - r.rank : null; return (
              <tr key={`${r.name}|${r.city}`} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5"><b className="text-base text-slate-900">{r.rank ? `#${r.rank}` : r.rank_band}</b></td>
                <td className="px-4 py-2.5"><span className="flex items-center gap-2.5"><Thumb f={f} name={r.name} size="h-8 w-8" /><Inst r={r} /></span></td>
                <td className="px-4 py-2.5 text-slate-600">{r.city}</td>
                {!world && <td className="px-4 py-2.5 text-slate-600">{r.state}</td>}
                <td className="px-4 py-2.5 text-slate-600">{f?.courses ? f.courses : <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">{feeText(f) || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">{placeText(f) || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5 text-xs">{d == null ? <span className="text-slate-400">{(prev || []).length ? 'new' : '—'}</span> : d > 0 ? <span className="font-semibold text-emerald-700">▲ {d}</span> : d < 0 ? <span className="font-semibold text-rose-700">▼ {-d}</span> : <span className="text-slate-500">=</span>}</td>
              </tr>); })}</tbody>
          </table>
        </div>
        {world ? <p className="mt-4 text-xs text-slate-400">Source: <a href="https://open.leidenranking.com/" target="_blank" rel="noopener noreferrer" className="underline">CWTS Leiden Ranking Open Edition {year}</a>, Centre for Science and Technology Studies, Leiden University — open data (CC0) based on OpenAlex. Top 500 shown; ranks are by publications in the latest period. Collegeolo links each university to its profile where we have one.</p>
        : <p className="mt-4 text-xs text-slate-400">Source: <a href={`https://www.nirfindia.org/Rankings/${year}/Ranking.html`} target="_blank" rel="noopener noreferrer" className="underline">NIRF India Rankings {year}</a>, Ministry of Education, Government of India. Equal ranks are shared as published. Collegeolo links each institution to its profile where we have one.</p>}
      </>}

      {wrows.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="section-title flex items-center gap-2"><Globe2 size={24} className="text-brand-600" />World university ranking</h2>
              <p className="mt-1 max-w-3xl text-slate-500">The world’s top universities by research output (CWTS Leiden Ranking), with their courses, fees and graduate outcomes.</p></div>
            <Link href="/rankings?src=world" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Full world ranking (500) <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wrows.map((r) => { const f = r.college_id ? slug.get(r.college_id) : undefined; const href = f ? `/colleges/${f.slug}` : `/colleges?q=${encodeURIComponent(r.name)}`;
              const body = (<>
                <div className="relative h-28 overflow-hidden rounded-t-2xl bg-gradient-to-br from-slate-800 via-brand-800 to-indigo-700">
                  {f?.photo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
                  <span className="absolute left-3 top-3 rounded-lg bg-amber-400 px-2 py-0.5 text-sm font-extrabold text-slate-900">#{r.rank}</span>
                  <span className="absolute bottom-3 left-3 rounded bg-black/40 px-2 py-0.5 text-xs font-semibold text-white">{f?.country || r.city}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-3"><Thumb f={f} name={r.name} />
                    <div className="min-w-0"><b className="line-clamp-2 text-slate-900 group-hover:text-brand-700">{r.name}</b>
                      <span className="block truncate text-xs text-slate-500">{[f?.city && f.city !== 'Not specified' ? f.city : null, f?.state].filter(Boolean).join(', ') || f?.country || r.city}</span></div></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <span className="rounded-lg bg-slate-50 p-2"><BookOpen size={13} className="mb-0.5 text-slate-400" /><b className="block text-slate-900">{f?.courses ? f.courses.toLocaleString('en-IN') : '—'}</b>courses</span>
                    <span className="rounded-lg bg-slate-50 p-2"><Wallet size={13} className="mb-0.5 text-slate-400" /><b className="block truncate text-slate-900">{f?.fee_min_inr ? short(f.fee_min_inr) : f?.fee_min ? money(f.fee_min, f.fee_currency || 'INR') : '—'}</b>fees / yr</span>
                    <span className="rounded-lg bg-slate-50 p-2"><Briefcase size={13} className="mb-0.5 text-slate-400" /><b className="block truncate text-slate-900">{f?.placement ? lpa(f.placement, f.placement_currency || 'INR') : f?.median_earnings ? money(f.median_earnings, 'USD') : '—'}</b>{f?.placement ? `${f.placement_kind || ''} package` : f?.median_earnings ? 'earnings (10 yr)' : 'placement'}</span>
                  </div>
                  {f?.top_courses?.length ? <ul className="mt-3 space-y-1 text-xs">{f.top_courses.slice(0, 3).map((k) => (
                    <li key={k.name} className="flex justify-between gap-2"><span className="truncate text-slate-700">{k.name.replace(/^(Bachelor|Master|Doctoral|Associate)['’]s degree — /, (m) => m.startsWith('B') ? 'Bachelor’s — ' : m.startsWith('M') ? 'Master’s — ' : m)}</span>
                      <span className="shrink-0 text-slate-500">{k.fees ? money(k.fees, k.currency) : k.level || ''}</span></li>))}</ul> : null}
                </div></>);
              return href ? <Link key={r.name} href={href} className="card group overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md">{body}</Link>
                : <div key={r.name} className="card overflow-hidden p-0">{body}</div>; })}
          </div>
          <p className="mt-3 text-xs text-slate-400">Ranking: CWTS Leiden Ranking Open Edition (CC0). Fees and outcomes from official sources — U.S. College Scorecard, UK Discover Uni, Australia CRICOS, NIRF and colleges’ own websites. Fees in other currencies are converted to rupees at today’s rate. Always confirm on the official website.</p>
        </section>)}

      {trending.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="section-title flex items-center gap-2"><Flame size={24} className="text-orange-500" />{trending.some((k) => Number(k.visitors) > 0) ? 'Trending courses this week' : 'Popular courses'}</h2>
              <p className="mt-1 text-slate-500">What students are checking out most right now · <Link href="/courses/search" className="font-semibold text-brand-700 hover:underline">search any course worldwide →</Link></p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trending.map((k, i) => (
              <Link key={k.slug} href={`/colleges?cq=${encodeURIComponent(k.name)}`} className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-extrabold ${i < 3 ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'}`}>{i + 1}</span>
                <span className="min-w-0"><b className="block truncate text-slate-900 group-hover:text-orange-700">{k.name}</b>
                  <span className="block truncate text-xs text-slate-500">{k.full_name}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-orange-600">{Number(k.visitors) > 0 ? `🔥 ${Number(k.visitors).toLocaleString('en-IN')} student${Number(k.visitors) > 1 ? 's' : ''} this week` : `${Number(k.colleges).toLocaleString('en-IN')} colleges`} · ranked lists →</span></span>
              </Link>))}
          </div>
        </section>)}
    </div>
  );
}
