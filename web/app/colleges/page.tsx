import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { EmptyState } from '@/components/Cards';
import CollegeRow, { type RowFacts } from '@/components/CollegeRow';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm, distinctValues } from '@/lib/data';
import type { College } from '@/lib/types';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts
const PER_PAGE = 15;
const APPROVALS = ['UGC', 'AICTE', 'NAAC A++', 'NAAC A+', 'NAAC A', 'NBA', 'NMC', 'BCI', 'PCI', 'COA', 'INC', 'NCTE'];

type SP = Record<string, string | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const where = sp.city || sp.state || sp.country;
  const what = sp.course_name || (sp.stream ? `${sp.stream} colleges` : 'Colleges');
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
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  let colleges: (College & { brochure_url?: string | null })[] = [];
  let facts: Record<string, RowFacts> = {};
  let total = 0;
  let examNames: Record<string, string> = {};
  let courseOpts: { value: string; label: string }[] = [];

  if (hasSupabase) {
    const sb = supabasePublic();
    const [{ data: ex }, { data: cat }] = await Promise.all([
      sb.from('exams').select('slug, short_name').eq('is_published', true).order('short_name').limit(400),
      sb.from('course_catalog').select('slug, name').order('sort'),
    ]);
    examNames = Object.fromEntries((ex || []).map((e: any) => [e.slug, e.short_name]));
    courseOpts = (cat || []).map((c: any) => ({ value: c.slug, label: c.name }));

    let q = sb.from('colleges_public').select('*', { count: 'exact' });
    const restrictIds = async (ids: string[]) => { q = q.in('id', Array.from(new Set(ids)).slice(0, 1000).concat(['00000000-0000-0000-0000-000000000000'])); };
    if (sp.level) { const { data } = await sb.from('courses').select('college_id').eq('level', sp.level).limit(5000); await restrictIds((data || []).map((x: any) => x.college_id)); }
    if (sp.course) { const { data } = await sb.from('courses').select('college_id').eq('catalog_slug', sp.course).limit(5000); await restrictIds((data || []).map((x: any) => x.college_id)); }
    let term = cleanTerm(sp.q);
    // searching a country name ("Japan", "USA", "UK") filters by country — fast (indexed) instead of scanning every college
    let country = sp.country || '';
    if (term && !country) {
      const alias: Record<string, string> = { usa: 'United States', us: 'United States', america: 'United States', uk: 'United Kingdom', britain: 'United Kingdom', england: 'United Kingdom', uae: 'United Arab Emirates', korea: 'South Korea', holland: 'Netherlands' };
      const want = alias[term.toLowerCase()] || term;
      const { data: c } = await sb.from('countries').select('name').ilike('name', want).limit(1);
      if (c?.[0]?.name) { country = c[0].name; term = ''; }
    }
    if (term) q = q.or(`name.ilike.%${term}%,short_name.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%,district.ilike.%${term}%,country.ilike.%${term}%`);
    if (country) q = q.eq('country', country);
    if (sp.state) q = q.eq('state', sp.state);
    if (sp.city) q = q.ilike('city', cleanTerm(sp.city));
    if (sp.type) q = q.eq('type', sp.type);
    if (sp.inst) q = q.eq('facts->>institution', sp.inst);
    if (sp.stream) q = q.contains('streams', [sp.stream]);
    if (sp.exam) q = q.contains('exams_accepted', [sp.exam]);
    if (sp.approval) q = q.contains('approvals', [sp.approval]);
    if (sp.fees_max) q = q.lte('fees_min', Number(sp.fees_max));
    const sort = sp.sort || 'rank';
    q = sort === 'fees_low' ? q.order('fees_min', { ascending: true, nullsFirst: false })
      : sort === 'fees_high' ? q.order('fees_max', { ascending: false, nullsFirst: false })
      : sort === 'newest' ? q.order('created_at', { ascending: false })
      : sort === 'name' ? q.order('name')
      : q.order('ranking', { ascending: true, nullsFirst: false }).order('name');
    const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    colleges = (data || []) as any[];
    total = count || 0;
    if (colleges.length) {
      const { data: rows } = await sb.rpc('college_rows', { p_ids: colleges.map((c) => c.id) });
      facts = Object.fromEntries(((rows || []) as any[]).map((r) => [r.id, r]));
    }
  }

  const [countries, states] = await Promise.all([
    distinctValues('colleges', 'country'),
    distinctValues('colleges', 'state', { country: sp.country || 'India' }),
  ]);
  const where = sp.city || sp.state || sp.country;
  const courseLabel = courseOpts.find((c) => c.value === sp.course)?.label;

  return (
    <div className="container-x py-8">
      <nav className="text-sm text-slate-500"><Link href="/" className="hover:underline">Home</Link> / <Link href="/colleges" className="hover:underline">Colleges</Link>{where ? <> / {where}</> : null}</nav>
      <div className="mb-6 mt-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {courseLabel ? `${courseLabel} colleges` : `${sp.stream ? `${sp.stream} ` : ''}Colleges`}{where ? ` in ${where}` : sp.country ? '' : ''}
        </h1>
        <p className="mt-1 text-slate-500">{total.toLocaleString('en-IN')} colleges{sp.q ? ` matching “${sp.q}”` : ''} · fees, placements, ranks and student reviews side by side</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[270px_1fr]">
        <aside>
          <FilterBar action="/colleges" values={sp} fields={[
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
