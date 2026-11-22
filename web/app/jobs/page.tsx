import type { Metadata } from 'next';
import { Briefcase } from 'lucide-react';
import { JobCard, EmptyState } from '@/components/Cards';
import FilterBar from '@/components/FilterBar';
import { CreateAlertButton } from '@/components/JobAlerts';
import { LiveJobs } from '@/components/LiveData';
import Pagination from '@/components/Pagination';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm, distinctValues } from '@/lib/data';
import type { Job } from '@/lib/types';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts
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
  let sponsored: any[] = [];
  let jobs: Job[] = [];
  let total = 0;

  if (hasSupabase) {
    const sb = supabasePublic();
    const filters = (q: any) => {
      const term = cleanTerm(sp.q);
      if (term) q = q.or(`title.ilike.%${term}%,company.ilike.%${term}%,city.ilike.%${term}%`);
      if (sp.country) q = q.eq('country', sp.country);
      if (sp.city) q = q.ilike('city', cleanTerm(sp.city));
      if (sp.type) q = q.eq('job_type', sp.type);
      if (sp.remote === 'yes') q = q.eq('is_remote', true);
      if (sp.remote === 'no') q = q.eq('is_remote', false);
      // student-visa friendly: most student visas cap term-time work at about 20 hours a week
      if (sp.hours === '20') q = q.lte('hours_per_week', 20);
      if (sp.hours === '10') q = q.lte('hours_per_week', 10);
      return q;
    };
    let q = sb.from('jobs').select('*', { count: 'exact' }).eq('is_published', true).eq('status', 'open');
    q = filters(q);
    q = sp.sort === 'pay' ? q.order('pay_max', { ascending: false, nullsFirst: false }) : q.order('created_at', { ascending: false });
    const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    if (page === 1) {
      const { data: promo } = await sb.from('promotions').select('item_id').eq('item_type', 'job').lte('starts_at', new Date().toISOString()).gt('ends_at', new Date().toISOString()).limit(200);
      const ids = Array.from(new Set((promo || []).map((p: any) => p.item_id)));
      if (ids.length) {
        const { data: sp2 } = await filters(sb.from('jobs').select('*').in('id', ids).eq('is_published', true).eq('status', 'open')).limit(3);
        sponsored = (sp2 || []) as any[];
      }
    }
    jobs = (data || []) as Job[];
    total = count || 0;
  }
  const countries = await distinctValues('jobs', 'country');
  // country code for the external job feed (Adzuna / Jooble): from ?country= or the city's record
  let cc: string | null = null;
  if (hasSupabase && sp.city) {
    const sb = supabasePublic();
    if (sp.country) cc = ((await sb.from('countries').select('code').ilike('name', sp.country).maybeSingle()).data as any)?.code || null;
    if (!cc) cc = ((await sb.from('cities').select('country_code').ilike('name', cleanTerm(sp.city)).order('population', { ascending: false }).limit(1).maybeSingle()).data as any)?.country_code || null;
  }

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
            { name: 'city', label: 'City', type: 'city', placeholder: 'Any city worldwide' },
            { name: 'type', label: 'Job type', type: 'select', options: ['Part-time', 'Internship', 'Weekend', 'Freelance', 'Full-time'] },
            { name: 'remote', label: 'Work mode', type: 'select', options: [{ value: 'yes', label: 'Work from home' }, { value: 'no', label: 'On-site' }] },
            { name: 'hours', label: 'Hours per week', type: 'select', options: [{ value: '20', label: 'Up to 20 (student-visa friendly)' }, { value: '10', label: 'Up to 10' }] },
            { name: 'sort', label: 'Sort by', type: 'select', options: [{ value: 'pay', label: 'Highest pay' }] },
          ]} />
          <div className="mt-4"><CreateAlertButton preset={{ keywords: sp.q || null, city: sp.city || null, country: sp.country || null, job_type: sp.type || null, remote_ok: sp.remote !== 'no' }} /></div>
          <a href="/resume" className="mt-2 block text-center text-sm text-brand-700 underline">Build your resume free</a>
        </aside>
        <section>
          {jobs.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{sponsored.map((x) => <div key={`sp-${x.id}`} className="relative"><JobCard j={x} /><span className="chip-amber absolute end-3 top-3 z-10">Sponsored</span></div>)}{jobs.filter((x) => !sponsored.some((y) => y.id === x.id)).map((j) => <JobCard key={j.id} j={j} />)}</div>
          ) : <EmptyState icon={<Briefcase size={28} />} title="No open jobs match" text="New student jobs are added daily — try a nearby city." />}
          <Pagination page={page} total={total} perPage={PER_PAGE} basePath="/jobs" params={sp} />
          {sp.city && <div className="mt-8"><LiveJobs city={sp.city} country={cc} query={sp.q || (sp.type ? sp.type.toLowerCase() : 'part time')} /></div>}
        </section>
      </div>
    </div>
  );
}
