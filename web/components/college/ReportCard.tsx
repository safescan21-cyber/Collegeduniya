import { GraduationCap } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

type Row = { category: string; grade: string; score: number; percentile: number; reviews: number };
const tone = (g: string) => (g.startsWith('A') ? 'bg-emerald-600' : g.startsWith('B') ? 'bg-sky-600' : g.startsWith('C') ? 'bg-amber-500' : 'bg-rose-500');

// Letter grades from students' own review ratings, compared with every other college that has at least 3 reviews.
export default async function ReportCard({ collegeId }: { collegeId: string }) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().rpc('college_report_card', { p_college: collegeId });
  const rows = (data || []) as Row[];
  if (!rows.length) return null;
  const overall = rows.find((r) => r.category === 'Overall');
  return (
    <div className="card mb-6 p-5">
      <div className="flex flex-wrap items-center gap-4">
        {overall && <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-extrabold text-white ${tone(overall.grade)}`}>{overall.grade}</span>}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-bold text-slate-900"><GraduationCap size={17} className="text-brand-600" />Student report card</p>
          <p className="text-xs text-slate-500">From {rows[0].reviews} student review{rows[0].reviews > 1 ? 's' : ''}{overall && Number(overall.percentile) > 0 ? ` · rated higher than ${Number(overall.percentile)}% of reviewed colleges` : ''}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {rows.filter((r) => r.category !== 'Overall').map((r) => (
          <div key={r.category} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold text-white ${tone(r.grade)}`}>{r.grade}</span>
            <span className="min-w-0"><b className="block truncate text-sm text-slate-800">{r.category}</b><span className="text-[11px] text-slate-500">{Number(r.score).toFixed(1)} / 5</span></span>
          </div>))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">Grades compare this college’s average student ratings with all colleges that have 3 or more reviews. They change as new reviews come in.</p>
    </div>
  );
}
