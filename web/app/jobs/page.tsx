import type { Metadata } from 'next';
import { Briefcase } from 'lucide-react';
import { JobCard, EmptyState } from '@/components/Cards';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm, distinctValues } from '@/lib/data';
import type { Job } from '@/lib/types';

export const dynamic = 'force-dynamic';
const PER_PAGE = 15;
type SP = Record<string, string | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const kind = sp.type ? `${sp.type} jobs` : 'Part-time jobs';
  return {
    title: `${kind} for students${sp.city ? ` in ${sp.city}` : ''}`,
    description: `Apply to ${kind.toLowerCase()}${sp.city ? ` in ${sp.city}` : ''} near your college — tutoring, cafés, internships, remote work and more.`,
  };
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  let jobs: Job[] = [];
  let total = 0;

  if (hasSupabase) {
    let q = supabasePublic().from('jobs').select('*', { count: 'exact' }).eq('is_published', true).eq('status', 'open');
    const term = cleanTerm(sp.q);
    if (term) q = q.or(`title.ilike.%${term}%,company.ilike.%${term}%,city.ilike.%${term}%`);
    if (sp.country) q = q.eq('country', sp.country);
    if (sp.city) q = q.ilike('city', cleanTerm(sp.city));
    if (sp.type) q = q.eq('job_type', sp.type);
    if (sp.remote === 'yes') q = q.eq('is_remote', true);
    if (sp.remote === 'no') q = q.eq('is_remote', false);
    q = sp.sort === 'pay' ? q.order('pay_max', { ascending: false, nullsFirst: false }) : q.order('created_at', { ascending: false });
    const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    jobs = (data || []) as Job[];
    total = count || 0;
  }
  const countries = await distinctValues('jobs', 'country');

  return (
    <div className="container-x py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{sp.type || 'Part-time'} jobs for students{sp.city ? ` in ${sp.city}` : ''}</h1>
        <p className="mt-1 text-slate-500">{total.toLocaleString()} open positions · register free and apply in one click</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <FilterBar action="/jobs" values={sp} fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'Job title or company' },
            { name: 'country', label: 'Country', type: 'select', options: countries },
            { name: 'city', label: 'City', type: 'text', placeholder: 'e.g. Delhi' },
            { name: 'type', label: 'Job type', type: 'select', options: ['Part-time', 'Internship', 'Weekend', 'Freelance', 'Full-time'] },
            { name: 'remote', label: 'Work mode', type: 'select', options: [{ value: 'yes', label: 'Remote' }, { value: 'no', label: 'On-site' }] },
            { name: 'sort', label: 'Sort by', type: 'select', options: [{ value: 'pay', label: 'Highest pay' }] },
          ]} />
        </aside>
        <section>
          {jobs.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{jobs.map((j) => <JobCard key={j.id} j={j} />)}</div>
          ) : <EmptyState icon={<Briefcase size={28} />} title="No open jobs match" text="New student jobs are added daily — try a nearby city." />}
          <Pagination page={page} total={total} perPage={PER_PAGE} basePath="/jobs" params={sp} />
        </section>
      </div>
    </div>
  );
}
