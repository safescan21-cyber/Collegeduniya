import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const revalidate = 3600;
type SP = Record<string, string | undefined>;
type Row = { rank: number | null; rank_band: string | null; name: string; city: string | null; state: string | null; college_id: string | null };

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
  const rows = (list || []) as Row[];
  const ids = rows.map((r) => r.college_id).filter(Boolean) as string[];
  const { data: cols } = ids.length ? await sb.from('colleges_public').select('id, slug, logo_url').in('id', ids) : { data: [] };
  const slug = new Map((cols || []).map((c: any) => [c.id, c]));
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
  const Inst = ({ r }: { r: Row }) => { const c = r.college_id ? slug.get(r.college_id) : null; return c ? <Link href={`/colleges/${c.slug}`} className="font-semibold text-slate-900 hover:text-brand-700">{r.name}</Link> : <span className="font-semibold text-slate-900">{r.name}</span>; };

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
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2.5">Rank</th><th className="px-4 py-2.5">Institution</th><th className="px-4 py-2.5">{world ? 'Country' : 'City'}</th>{!world && <th className="px-4 py-2.5">State</th>}<th className="px-4 py-2.5">vs {year - 1}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r) => { const p = prevRank(r); const d = p && r.rank ? p - r.rank : null; return (
              <tr key={`${r.name}|${r.city}`} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5"><b className="text-base text-slate-900">{r.rank ? `#${r.rank}` : r.rank_band}</b></td>
                <td className="px-4 py-2.5"><Inst r={r} /></td>
                <td className="px-4 py-2.5 text-slate-600">{r.city}</td>
                {!world && <td className="px-4 py-2.5 text-slate-600">{r.state}</td>}
                <td className="px-4 py-2.5 text-xs">{d == null ? <span className="text-slate-400">{(prev || []).length ? 'new' : '—'}</span> : d > 0 ? <span className="font-semibold text-emerald-700">▲ {d}</span> : d < 0 ? <span className="font-semibold text-rose-700">▼ {-d}</span> : <span className="text-slate-500">=</span>}</td>
              </tr>); })}</tbody>
          </table>
        </div>
        {world ? <p className="mt-4 text-xs text-slate-400">Source: <a href="https://open.leidenranking.com/" target="_blank" rel="noopener noreferrer" className="underline">CWTS Leiden Ranking Open Edition {year}</a>, Centre for Science and Technology Studies, Leiden University — open data (CC0) based on OpenAlex. Top 500 shown; ranks are by publications in the latest period. Collegeolo links each university to its profile where we have one.</p>
        : <p className="mt-4 text-xs text-slate-400">Source: <a href={`https://www.nirfindia.org/Rankings/${year}/Ranking.html`} target="_blank" rel="noopener noreferrer" className="underline">NIRF India Rankings {year}</a>, Ministry of Education, Government of India. Equal ranks are shared as published. Collegeolo links each institution to its profile where we have one.</p>}
      </>}
    </div>
  );
}
