import type { Metadata } from 'next';
import Link from 'next/link';
import { Calculator } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const YEAR = new Date().getFullYear();
export const metadata: Metadata = {
  title: `Rank predictor ${YEAR} — marks or percentile to rank for JEE, NEET, CUET, CAT`,
  description: 'Estimate your rank from your marks or percentile using official result figures and real results shared by students. See the source and year behind every estimate.',
  alternates: { canonical: '/rank-predictor' },
};

type Row = { slug: string; short_name: string; full_name: string | null; stream: string | null; bands: number; stats: number; reports: number; latest_year: number | null };

export default async function RankPredictorList() {
  let rows: Row[] = [];
  if (hasSupabase) { const { data } = await supabasePublic().rpc('rank_predictor_exams'); rows = (data || []) as Row[]; }
  const ready = rows.filter((r) => r.bands || r.stats || r.reports >= 3);
  const rest = rows.filter((r) => !(r.bands || r.stats || r.reports >= 3));
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Calculator className="text-brand-600" />Rank predictor</h1>
      <p className="mt-1 max-w-2xl text-slate-500">Turn your marks or percentile into an expected rank, then see which colleges you can get. Every estimate shows the year and the source it comes from.</p>
      {ready.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ready.map((e) => (
            <Link key={e.slug} href={`/rank-predictor/${e.slug}`} className="card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="font-bold text-slate-900">{e.short_name} rank predictor</p>
              <p className="truncate text-xs text-slate-500">{e.stream}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {e.bands > 0 && <span className="chip-green">Marks → rank</span>}
                {e.stats > 0 && <span className="chip-green">Percentile → rank</span>}
                {e.reports > 0 && <span className="chip">{e.reports} real results</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="mt-10">
          <h2 className="font-bold text-slate-900">Help build these predictors</h2>
          <p className="text-sm text-slate-500">No official figures added yet. If you have your result, share your marks and rank — it takes 30 seconds.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {rest.map((e) => <Link key={e.slug} href={`/rank-predictor/${e.slug}#share`} className="chip hover:bg-slate-200">{e.short_name}</Link>)}
          </div>
        </div>
      )}
    </div>
  );
}
