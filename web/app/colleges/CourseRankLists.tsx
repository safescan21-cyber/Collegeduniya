import Link from 'next/link';
import { GraduationCap, Trophy, Globe2, MapPin, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/Cards';
import CollegeRow, { type RowFacts } from '@/components/CollegeRow';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import MyStateLink from '@/components/college/MyStateLink';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm, collegeCountries, collegeStates } from '@/lib/data';
import { short } from '@/lib/format';
import type { College } from '@/lib/types';

type SP = Record<string, string | undefined>;
type Hit = { id: string; world_rank: number | null; country_rank: number | null; rank_label: string | null; courses: number; course_name: string | null; fee_min_inr: number | null; course_list: { name: string; level: string | null; duration: string | null; fees: number | null; currency: string; mode: string | null }[] | null; total: number };
type Scope = 'country' | 'world' | 'state';
const PREVIEW = 10;
const PER_PAGE = 15;

// /colleges?cq=computer science → three lists: the country's own ranking, the world ranking, then one state.
// "See all" opens one list on its own (&scope=…) with paging.
export default async function CourseRankLists({ sp }: { sp: SP }) {
  const cq = cleanTerm(sp.cq);
  const country = sp.country || 'India';
  const state = sp.state || '';
  const only = (['country', 'world', 'state'] as Scope[]).find((s) => s === sp.scope);
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  const lists: Record<Scope, Hit[]> = { country: [], world: [], state: [] };
  let colleges: Record<string, College & { brochure_url?: string | null }> = {};
  let facts: Record<string, RowFacts> = {};
  let examNames: Record<string, string> = {};
  let countries: string[] = []; let states: string[] = [];

  if (hasSupabase) {
    const sb = supabasePublic();
    const want: Scope[] = only ? [only] : ['country', 'world', 'state'];
    const run = (scope: Scope) => (scope === 'state' && !state) ? Promise.resolve({ data: [] as Hit[] }) :
      sb.rpc('course_rank_lists', {
        p_course: cq, p_scope: scope, p_country: country, p_state: state || null,
        p_offset: only ? (page - 1) * PER_PAGE : 0, p_lim: only ? PER_PAGE : PREVIEW,
      }).then((r) => { if (r.error) console.warn('[colleges] course lists', r.error.message); return { data: (r.data || []) as Hit[] }; });
    const [res, cs, st, { data: ex }] = await Promise.all([
      Promise.all(want.map(run)), collegeCountries(), collegeStates(country),
      sb.from('exams').select('slug, short_name').eq('is_published', true).order('short_name').limit(400),
    ]);
    want.forEach((s, i) => { lists[s] = res[i].data; });
    countries = cs; states = st;
    examNames = Object.fromEntries((ex || []).map((e: any) => [e.slug, e.short_name]));
    const ids = [...new Set(Object.values(lists).flat().map((h) => h.id))];
    if (ids.length) {
      const [{ data }, { data: rows }] = await Promise.all([
        sb.from('colleges_public').select('*').in('id', ids),
        sb.rpc('college_rows', { p_ids: ids }),
      ]);
      colleges = Object.fromEntries(((data || []) as any[]).map((c) => [c.id, c]));
      facts = Object.fromEntries(((rows || []) as any[]).map((r) => [r.id, r]));
    }
  }

  const href = (extra: SP) => {
    const p = new URLSearchParams();
    const all: SP = { cq, country: sp.country, state: sp.state, ...extra };
    Object.entries(all).forEach(([k, v]) => { if (v) p.set(k, v); });
    return `/colleges?${p.toString()}`;
  };
  const stateHref = Object.fromEntries(states.map((s) => [s, href({ state: s, scope: only === 'state' ? 'state' : undefined })]));

  const meta: Record<Scope, { icon: React.ReactNode; title: string; note: string }> = {
    country: { icon: <Trophy size={18} />, title: `Top ${cq} colleges in ${country}`,
      note: country === 'India' ? 'Ranked by NIRF (Government of India). Unranked colleges follow.' : `Ranked by each university’s place among ${country}’s universities in the world research ranking (CWTS Leiden). Unranked colleges follow.` },
    world: { icon: <Globe2 size={18} />, title: `World ranking — ${cq}`, note: 'Every country, ranked by the CWTS Leiden Ranking (scientific research). Only ranked universities are listed.' },
    state: { icon: <MapPin size={18} />, title: state ? `${cq} colleges in ${state}` : `${cq} colleges by state`, note: state ? `Ranked the same way as the ${country} list.` : '' },
  };

  const section = (scope: Scope, n: number) => {
    const hits = lists[scope]; const total = hits[0]?.total || 0; const m = meta[scope];
    return (
      <section key={scope} className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><span className="text-brand-600">{m.icon}</span>{only ? '' : `${n}. `}{m.title}</h2>
            {m.note ? <p className="text-xs text-slate-500">{m.note}{total ? ` · ${total.toLocaleString('en-IN')} colleges` : ''}</p> : null}
          </div>
          {!only && total > hits.length ? <Link href={href({ scope })} className="flex items-center text-sm font-semibold text-brand-700 hover:underline">See all {total.toLocaleString('en-IN')} <ChevronRight size={16} /></Link> : null}
        </div>
        {scope === 'state' && !state ? (
          states.length ? <MyStateLink states={states} country={country} hrefFor={stateHref} /> : <p className="text-sm text-slate-500">No states listed for {country}.</p>
        ) : hits.length ? (
          <div className="space-y-3">
            {hits.map((h) => colleges[h.id] ? (
              <div key={scope + h.id}>
                <div className="mb-1 flex flex-wrap items-center gap-2 px-1 text-xs">
                  {scope === 'world'
                    ? <span className="rounded bg-brand-50 px-2 py-0.5 font-bold text-brand-700">World #{h.world_rank}</span>
                    : h.country_rank ? <span className="rounded bg-brand-50 px-2 py-0.5 font-bold text-brand-700">#{h.country_rank} {h.rank_label === 'NIRF' ? 'NIRF' : `in ${colleges[h.id].country || country}`}</span> : <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-500">Not ranked</span>}
                  {scope !== 'world' && h.world_rank ? <span className="text-slate-500">World #{h.world_rank}</span> : null}
                  {scope === 'world' && h.country_rank ? <span className="text-slate-500">#{h.country_rank} in {colleges[h.id].country}</span> : null}
                  <span className="text-slate-500">· {h.courses} matching course{h.courses > 1 ? 's' : ''}{h.fee_min_inr ? ` · from ${short(h.fee_min_inr)}/yr` : ''}</span>
                </div>
                <CollegeRow c={colleges[h.id]} f={facts[h.id]} examNames={examNames} />
                {h.course_list?.length ? (
                  <div className="-mt-1 rounded-b-xl border border-t-0 border-slate-100 bg-slate-50 px-4 py-2">
                    <table className="w-full text-xs">
                      <thead className="text-left text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="py-1 font-semibold">Course</th><th className="font-semibold">Level</th><th className="hidden font-semibold sm:table-cell">Duration</th><th className="text-right font-semibold">Fees / year</th></tr></thead>
                      <tbody>
                        {h.course_list.map((k, j) => (
                          <tr key={j} className="border-t border-slate-100 text-slate-700">
                            <td className="py-1 pr-2">{k.name}{k.mode ? <span className="text-slate-400"> · {k.mode}</span> : null}</td>
                            <td className="pr-2">{k.level || '—'}</td>
                            <td className="hidden pr-2 sm:table-cell">{k.duration || '—'}</td>
                            <td className="text-right font-semibold">{k.fees ? short(k.fees, k.currency) : <span className="font-normal text-slate-400">Not published</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {h.courses > h.course_list.length ? <Link href={`/colleges/${colleges[h.id].slug}#courses`} className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline">All {h.courses} matching courses →</Link> : null}
                  </div>
                ) : null}
              </div>
            ) : null)}
          </div>
        ) : (
          <EmptyState icon={<GraduationCap size={28} />} title={`No ${scope === 'world' ? 'ranked ' : ''}colleges found for “${cq}”`} text="Try a shorter name, e.g. “Computer” instead of “Computer Science Engineering”." />
        )}
        {only ? <Pagination page={page} total={total} perPage={PER_PAGE} basePath="/colleges" params={{ cq, country: sp.country, state: sp.state, scope }} /> : null}
      </section>
    );
  };

  return (
    <div className="container-x py-8">
      <nav className="text-sm text-slate-500"><Link href="/" className="hover:underline">Home</Link> / <Link href="/colleges" className="hover:underline">Colleges</Link> / {cq}</nav>
      <div className="mb-6 mt-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 first-letter:uppercase">{cq} colleges — {country}, world{state ? ` and ${state}` : ''}</h1>
        <p className="mt-1 text-slate-500">Colleges teaching {cq}, ranked: first in {country}, then the world, then by state.{only ? <> <Link href={href({ scope: undefined })} className="text-brand-700 underline">Back to all three lists</Link></> : null}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[270px_1fr]">
        <aside>
          <FilterBar action="/colleges" values={{ cq, country: sp.country, state: sp.state }} fields={[
            { name: 'cq', label: 'Course — any country', type: 'text', placeholder: 'e.g. Computer Science, MBA, Nursing' },
            { name: 'country', label: 'Your country', type: 'select', options: countries },
            { name: 'state', label: 'State', type: 'select', options: states },
          ]} />
          <p className="mt-3 text-xs text-slate-400"><Link href="/colleges" className="underline">Clear the course</Link> to use all filters (fees, exams, approvals…).</p>
        </aside>
        <div className="min-w-0 space-y-10">
          {only ? section(only, 1) : (['country', 'world', 'state'] as Scope[]).map((s, i) => section(s, i + 1))}
          <p className="text-xs text-slate-400">Ranks: NIRF for India; CWTS Leiden Ranking Open Edition for the world. A college appears when one of its courses matches your words. Always confirm fees on the official website. <Link href="/editorial-policy" className="underline">How we collect data</Link></p>
        </div>
      </div>
    </div>
  );
}
