import type { Metadata } from 'next';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { EmptyState } from '@/components/Cards';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { money } from '@/lib/format';

export const revalidate = 21600;
type SP = Record<string, string | undefined>;
type T = { year: number; colleges: number; median_package: number | null; avg_package: number | null; highest_package: number | null; currency: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const what = sp.stream ? `${sp.stream} ` : '';
  return {
    title: `${what}Salary & placement trends — median package by year`,
    description: `How ${what.toLowerCase() || ''}placement packages changed year by year, and the colleges with the highest median salary — from data colleges publish.`,
    alternates: { canonical: sp.stream ? `/trends?stream=${encodeURIComponent(sp.stream)}` : '/trends' },
  };
}

const short = (n: number | null, cur: string) => {
  if (n == null) return '—';
  if (cur === 'INR') return n >= 1e7 ? `₹${(n / 1e7).toFixed(1)} Cr` : `₹${(n / 1e5).toFixed(1)} L`;
  return money(n, cur);
};

export default async function Trends({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const country = (sp.country || 'IN').toUpperCase();
  let trend: T[] = []; let top: any[] = []; let streams: string[] = [];
  if (hasSupabase) {
    const sb = supabasePublic();
    const [t, tp, s] = await Promise.all([
      sb.rpc('placement_trends', { p_stream: sp.stream || null, p_country: country }),
      sb.rpc('top_placements', { p_stream: sp.stream || null, p_country: country, p_year: sp.year ? Number(sp.year) : null, p_lim: 25 }),
      sb.rpc('stream_place_counts', { p_min: 1 }).eq('place_type', 'country').limit(500),
    ]);
    trend = ((t.data || []) as T[]).filter((x) => x.median_package != null).slice(-8);
    top = (tp.data || []) as any[];
    streams = Array.from(new Set(((s.data || []) as any[]).map((x) => x.stream))).sort();
  }
  const cur = trend[0]?.currency || top[0]?.currency || 'INR';
  const max = Math.max(1, ...trend.map((x) => Number(x.median_package)));
  const first = trend[0]; const last = trend[trend.length - 1];
  const growth = first && last && first !== last && first.median_package ? ((Number(last.median_package) / Number(first.median_package)) ** (1 / (last.year - first.year)) - 1) * 100 : null;
  const W = 640, H = 240, bw = trend.length ? Math.min(64, (W - 40) / trend.length - 12) : 0;

  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><TrendingUp className="text-brand-600" />{sp.stream ? `${sp.stream} salary` : 'Salary'} & placement trends</h1>
      <p className="mt-1 text-slate-500">Median package across colleges that publish placement reports{country === 'IN' ? ' (India)' : ` (${country})`}. Numbers are only as good as each college’s own report.</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside><FilterBar action="/trends" values={sp} fields={[
          { name: 'stream', label: 'Stream', type: 'select', options: streams },
          { name: 'country', label: 'Country code', type: 'text', placeholder: 'IN' },
          { name: 'year', label: 'Top-colleges year', type: 'select', options: trend.map((t) => String(t.year)).reverse() },
        ]} /></aside>
        <section className="min-w-0 space-y-8">
          {trend.length ? (
            <div className="card p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-sm text-slate-500">Median package, {last.year}</p><p className="text-3xl font-extrabold text-slate-900">{short(Number(last.median_package), cur)}</p></div>
                {growth != null && <p className={`text-sm font-semibold ${growth >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}% a year since {first.year}</p>}
              </div>
              <svg viewBox={`0 -24 ${W} ${H + 64}`} className="mt-4 w-full" role="img" aria-label="Median package by year">
                {trend.map((t, i) => {
                  const h = (Number(t.median_package) / max) * H;
                  const x = 20 + i * ((W - 40) / trend.length) + 6;
                  return (
                    <g key={t.year}>
                      <rect x={x} y={H - h + 10} width={bw} height={h} rx={6} className="fill-brand-500" />
                      <text x={x + bw / 2} y={H - h + 2} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">{short(Number(t.median_package), cur)}</text>
                      <text x={x + bw / 2} y={H + 26} textAnchor="middle" className="fill-slate-500 text-[11px]">{t.year}</text>
                      <title>{`${t.year}: median ${short(Number(t.median_package), cur)} · average ${short(Number(t.avg_package), cur)} · highest ${short(Number(t.highest_package), cur)} · ${t.colleges} colleges`}</title>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Year</th><th>Colleges</th><th>Median</th><th>Average</th><th>Highest</th></tr></thead>
                  <tbody>{trend.slice().reverse().map((t) => (
                    <tr key={t.year} className="border-t border-slate-100"><td className="py-2 font-medium">{t.year}</td><td>{t.colleges}</td><td>{short(Number(t.median_package), cur)}</td><td>{short(Number(t.avg_package), cur)}</td><td>{short(Number(t.highest_package), cur)}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          ) : <EmptyState icon={<TrendingUp size={28} />} title="No placement data for this filter yet" text="Trends appear once colleges’ placement reports are added." />}

          {top.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900">Highest median package{sp.stream ? ` — ${sp.stream}` : ''}{sp.year ? ` (${sp.year})` : ' (latest year per college)'}</h2>
              <div className="card mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">#</th><th className="px-4 py-2">College</th><th className="px-4 py-2">Year</th><th className="px-4 py-2">Median</th><th className="px-4 py-2">Highest</th><th className="px-4 py-2">Placed</th></tr></thead>
                  <tbody>{top.map((c, i) => (
                    <tr key={c.slug} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2"><Link href={`/colleges/${c.slug}#placements`} className="font-medium text-brand-700 hover:underline">{c.name}</Link><p className="text-xs text-slate-500">{c.city}{c.course && c.course !== 'All' ? ` · ${c.course}` : ''}</p></td>
                      <td className="px-4 py-2">{c.year}</td>
                      <td className="px-4 py-2 font-semibold">{short(Number(c.median_package ?? c.avg_package), c.currency)}{c.median_package == null ? <span className="text-xs font-normal text-slate-400"> avg</span> : null}</td>
                      <td className="px-4 py-2">{short(c.highest_package == null ? null : Number(c.highest_package), c.currency)}</td>
                      <td className="px-4 py-2">{c.placement_rate != null ? `${c.placement_rate}%` : '—'}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
