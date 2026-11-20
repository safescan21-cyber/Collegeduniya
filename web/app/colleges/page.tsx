import type { Metadata } from 'next';
import { GraduationCap } from 'lucide-react';
import { CollegeCard, EmptyState } from '@/components/Cards';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm, distinctValues, ratingsFor } from '@/lib/data';
import type { College } from '@/lib/types';

export const dynamic = 'force-dynamic';
const PER_PAGE = 12;

type SP = Record<string, string | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const where = sp.city || sp.country;
  const what = sp.stream ? `${sp.stream} colleges` : 'Colleges';
  return {
    title: where ? `${what} in ${where} — fees, courses & reviews` : `${what} worldwide — fees, courses & reviews`,
    description: `Compare ${what.toLowerCase()}${where ? ` in ${where}` : ''} by fees, ranking, courses and student reviews on StudyEarnstay.`,
  };
}

export default async function CollegesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  let colleges: College[] = [];
  let total = 0;

  if (hasSupabase) {
    const sb = supabasePublic();
    const select = sp.level ? '*, courses!inner(level)' : '*';
    let q = sb.from('colleges').select(select, { count: 'exact' }).eq('is_published', true);
    const term = cleanTerm(sp.q);
    if (term) q = q.or(`name.ilike.%${term}%,short_name.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`);
    if (sp.country) q = q.eq('country', sp.country);
    if (sp.city) q = q.ilike('city', cleanTerm(sp.city));
    if (sp.type) q = q.eq('type', sp.type);
    if (sp.stream) q = q.contains('streams', [sp.stream]);
    if (sp.level) q = q.eq('courses.level', sp.level);
    if (sp.fees_max) q = q.lte('fees_min', Number(sp.fees_max));
    const sort = sp.sort || 'rank';
    q = sort === 'fees_low' ? q.order('fees_min', { ascending: true, nullsFirst: false })
      : sort === 'fees_high' ? q.order('fees_max', { ascending: false, nullsFirst: false })
      : sort === 'newest' ? q.order('created_at', { ascending: false })
      : sort === 'name' ? q.order('name')
      : q.order('ranking', { ascending: true, nullsFirst: false });
    const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    colleges = (data || []) as unknown as College[];
    total = count || 0;
  }

  const [countries, ratings] = await Promise.all([distinctValues('colleges', 'country'), ratingsFor(colleges.map((c) => c.id))]);

  return (
    <div className="container-x py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {sp.stream ? `${sp.stream} ` : ''}Colleges{sp.city ? ` in ${sp.city}` : sp.country ? ` in ${sp.country}` : ' worldwide'}
        </h1>
        <p className="mt-1 text-slate-500">{total.toLocaleString()} colleges found{sp.q ? ` for “${sp.q}”` : ''}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <FilterBar action="/colleges" values={sp} fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'College name or city' },
            { name: 'country', label: 'Country', type: 'select', options: countries },
            { name: 'city', label: 'City', type: 'city', placeholder: 'Any city worldwide' },
            { name: 'stream', label: 'Stream', type: 'select', options: ['Engineering', 'Management', 'Medical', 'Commerce', 'Arts', 'Science', 'Law', 'Design', 'Media'] },
            { name: 'level', label: 'Course level', type: 'select', options: ['UG', 'PG', 'Diploma', 'PhD', 'Certificate'] },
            { name: 'type', label: 'Ownership', type: 'select', options: ['Public', 'Private', 'Deemed', 'Autonomous'] },
            { name: 'fees_max', label: 'Max fees / year', type: 'text', placeholder: 'e.g. 200000' },
            { name: 'sort', label: 'Sort by', type: 'select', options: [
              { value: 'rank', label: 'Ranking' }, { value: 'fees_low', label: 'Fees: low to high' },
              { value: 'fees_high', label: 'Fees: high to low' }, { value: 'name', label: 'Name A–Z' }, { value: 'newest', label: 'Newest' }] },
          ]} />
        </aside>
        <section>
          {colleges.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {colleges.map((c) => <CollegeCard key={c.id} c={c} rating={ratings[c.id]} />)}
            </div>
          ) : (
            <EmptyState icon={<GraduationCap size={28} />} title="No colleges match these filters" text="Try removing a filter or searching a nearby city." />
          )}
          <Pagination page={page} total={total} perPage={PER_PAGE} basePath="/colleges" params={sp} />
        </section>
      </div>
    </div>
  );
}
