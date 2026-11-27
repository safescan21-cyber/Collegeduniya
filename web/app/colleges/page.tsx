import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { EmptyState } from '@/components/Cards';
import CollegeRow, { type RowFacts } from '@/components/CollegeRow';
import FilterBar from '@/components/FilterBar';
import CourseRankLists from './CourseRankLists';
import Pagination from '@/components/Pagination';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm, collegeCountries, collegeStates } from '@/lib/data';
import type { College } from '@/lib/types';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts
const PER_PAGE = 15;
const APPROVALS = ['UGC', 'AICTE', 'NAAC A++', 'NAAC A+', 'NAAC A', 'NBA', 'NMC', 'BCI', 'PCI', 'COA', 'INC', 'NCTE'];

type SP = Record<string, string | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const where = sp.city || sp.state || sp.country;
  const what = (sp.cq ? `${sp.cq} colleges` : '') || sp.course_name || (sp.stream ? `${sp.stream} colleges` : 'Colleges');
  const filtered = Object.keys(sp).some((k) => !['country', 'stream', 'state', 'city'].includes(k));
  return {
    title: `${what}${where ? ` in ${where}` : ''} — fees, placements, rankings & reviews`,
    description: `List of ${what.toLowerCase()}${where ? ` in ${where}` : ''} with fees, placement packages, rank, cutoffs and student reviews. Filter by state, exam, approval and budget.`,
    // filtered/sorted/paged combinations are for visitors; only the main lists go to Google
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function CollegesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (cleanTerm(sp.cq)) return <CourseRankLists sp={sp} />;   // search by course, worldwide → country, world and state lists
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  let colleges: (College & { brochure_url?: string | null })[] = [];
  let facts: Record<string, RowFacts> = {};
  let total = 0;
  let examNames: Record<string, string> = {};
  let courseOpts: { value: string; label: string }[] = [];

  let countries: string[] = []; let states: string[] = [];
  if (hasSupabase) {
    const sb = supabasePublic();
    // everything at once: one indexed search call (filters + total + page of ids) and the dropdown lists in parallel
    const [{ data: ex }, { data: cat }, { data: hits, error }, cs, st] = await Promise.all([
      sb.from('exams').select('slug, short_name').eq('is_published', true).order('short_name').limit(400),
      sb.from('course_catalog').select('slug, name').order('sort'),
      sb.rpc('college_search', {
        p_q: cleanTerm(sp.q) || null, p_country: sp.country || null, p_state: sp.state || null, p_city: sp.city ? cleanTerm(sp.city) : null,
        p_type: sp.type || null, p_inst: sp.inst || null, p_stream: sp.stream || null, p_exam: sp.exam || null, p_approval: sp.approval || null,
        p_fees_max: sp.fees_max ? Number(sp.fees_max) || null : null, p_level: sp.level || null, p_course: sp.course || null,
        p_sort: sp.sort || 'rank', p_offset: (page - 1) * PER_PAGE, p_lim: PER_PAGE,
      }),
      collegeCountries(),
      collegeStates(sp.country || 'India'),
    ]);
    countries = cs; states = st;
    examNames = Object.fromEntries((ex || []).map((e: any) => [e.slug, e.short_name]));
    courseOpts = (cat || []).map((c: any) => ({ value: c.slug, label: c.name }));
    if (error) console.warn('[colleges] search', error.message);
    const list = ((hits || []) as { id: string | null; total: number }[]);
    total = list[0]?.total || 0;
    const ids = list.map((h) => h.id).filter(Boolean) as string[];
    if (ids.length) {
      const [{ data }, { data: rows }] = await Promise.all([
        sb.from('colleges_public').select('*').in('id', ids),
        sb.rpc('college_rows', { p_ids: ids }),
      ]);
      const byId = Object.fromEntries(((data || []) as any[]).map((c) => [c.id, c]));
      colleges = ids.map((id) => byId[id]).filter(Boolean);   // keep the search order
      facts = Object.fromEntries(((rows || []) as any[]).map((r) => [r.id, r]));
    }
  }

  const where = sp.city || sp.state || sp.country;
  const courseLabel = courseOpts.find((c) => c.value === sp.course)?.label;

  return (
    <div className="container-x py-8">
      <nav className="text-sm text-slate-500"><Link href="/" className="hover:underline">Home</Link> / <Link href="/colleges" className="hover:underline">Colleges</Link>{where ? <> / {where}</> : null}</nav>
      <div className="mb-6 mt-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {courseLabel ? `${courseLabel} colleges` : `${sp.stream ? `${sp.stream} ` : ''}Colleges`}{where ? ` in ${where}` : sp.country ? '' : ''}
        </h1>
        <p className="mt-1 text-slate-500">{total > 10000 ? '10,000+' : total.toLocaleString('en-IN')} colleges{sp.q ? ` matching “${sp.q}”` : ''} · fees, placements, ranks and student reviews side by side</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[270px_1fr]">
        <aside>
          <FilterBar action="/colleges" values={sp} fields={[
            { name: 'cq', label: 'Course — any country', type: 'text', placeholder: 'e.g. Computer Science, MBA, Nursing' },
            { name: 'q', label: 'Search', type: 'text', placeholder: 'College name or city' },
            { name: 'course', label: 'Course', type: 'select', options: courseOpts },
            { name: 'stream', label: 'Stream', type: 'select', options: ['Engineering', 'Management', 'Medical', 'Commerce', 'Arts', 'Science', 'Law', 'Design', 'Pharmacy', 'Architecture', 'Media'] },
            { name: 'country', label: 'Country', type: 'select', options: countries },
            { name: 'state', label: 'State', type: 'select', options: states },
            { name: 'city', label: 'City', type: 'city', placeholder: 'Any city' },
            { name: 'exam', label: 'Exam accepted', type: 'select', options: Object.entries(examNames).map(([value, label]) => ({ value, label })) },
            { name: 'type', label: 'Ownership', type: 'select', options: ['Public', 'Private', 'Deemed', 'Autonomous'] },
            { name: 'approval', label: 'Approved / accredited by', type: 'select', options: APPROVALS },
            { name: 'level', label: 'Course level', type: 'select', options: ['UG', 'PG', 'Diploma', 'PhD', 'Certificate'] },
            { name: 'inst', label: 'Institution', type: 'select', options: ['University', 'College', 'Standalone institution'] },
            { name: 'fees_max', label: 'Max fees / year (₹)', type: 'text', placeholder: 'e.g. 200000' },
            { name: 'sort', label: 'Sort by', type: 'select', options: [
              { value: 'rank', label: 'Rank' }, { value: 'fees_low', label: 'Fees: low to high' },
              { value: 'fees_high', label: 'Fees: high to low' }, { value: 'name', label: 'Name A–Z' }, { value: 'newest', label: 'Recently added' }] },
          ]} />
        </aside>
        <section className="min-w-0">
          {colleges.length ? (
            <>
              <div className="mb-2 hidden grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-4 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid">
                <span>College</span><span>Fees / year</span><span>Placement</span><span>Reviews</span><span>Rank / cutoff</span>
              </div>
              <div className="space-y-3">{colleges.map((c) => <CollegeRow key={c.id} c={c} f={facts[c.id]} examNames={examNames} />)}</div>
            </>
          ) : (
            <EmptyState icon={<GraduationCap size={28} />} title="No colleges match these filters" text="Try removing a filter or searching a nearby city." />
          )}
          <Pagination page={page} total={total} perPage={PER_PAGE} basePath="/colleges" params={sp} />
          <p className="mt-6 text-xs text-slate-400">Fees and placements are taken from each college’s official website, prospectus or placement report; ranks from the published ranking (NIRF for India). Always confirm on the official website before applying. <Link href="/editorial-policy" className="underline">How we collect data</Link></p>
        </section>
      </div>
    </div>
  );
}
