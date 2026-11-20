import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import QuotaSeatCard from '@/components/QuotaSeatCard';
import { EmptyState } from '@/components/Cards';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm } from '@/lib/data';
import type { QuotaSeat } from '@/lib/types';

export const dynamic = 'force-dynamic';
const PER_PAGE = 18;
type SP = Record<string, string | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const where = sp.city || sp.state;
  return {
    title: `Management quota admission ${new Date().getFullYear()}${where ? ` in ${where}` : ''} — seats, fees & last dates`,
    description: `Verified management quota and NRI quota seats${where ? ` in ${where}` : ''}: official fees, seats left, eligibility and last date. Apply online free through StudyEarnstay.`,
  };
}

export default async function ManagementQuotaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  let seats: QuotaSeat[] = [];
  let total = 0;
  let states: string[] = [];

  if (hasSupabase) {
    const db = supabasePublic();
    let q = db.from('quota_seats_public').select('*', { count: 'exact' });
    const term = cleanTerm(sp.q);
    if (term) q = q.or(`course.ilike.%${term}%,college_name.ilike.%${term}%,city.ilike.%${term}%`);
    if (sp.level) q = q.eq('level', sp.level);
    if (sp.quota) q = q.eq('quota_type', sp.quota);
    if (sp.state) q = q.eq('state', sp.state);
    if (sp.city) q = q.ilike('city', cleanTerm(sp.city));
    if (sp.open !== 'all') q = q.eq('status', 'open');
    q = sp.sort === 'fee' ? q.order('fee_per_year', { ascending: true, nullsFirst: false })
      : sp.sort === 'deadline' ? q.order('last_date', { ascending: true, nullsFirst: false })
      : q.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
    const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    seats = (data || []) as QuotaSeat[];
    total = count || 0;
    const { data: st } = await db.from('quota_seats_public').select('state').limit(2000);
    states = Array.from(new Set((st || []).map((r: any) => r.state).filter(Boolean))).sort() as string[];
  }

  return (
    <div className="container-x py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Management quota admission{sp.city ? ` in ${sp.city}` : sp.state ? ` in ${sp.state}` : ''}</h1>
        <p className="mt-1 text-slate-500">{total.toLocaleString()} {sp.open === 'all' ? '' : 'open '}listings · official fee, seats left and last date · apply free</p>
      </div>
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <ShieldCheck className="mt-0.5 shrink-0" size={18} />
        <p>Seats are listed with each college&apos;s official fee. Applying through StudyEarnstay is free. Pay fees only to the college&apos;s own bank account, against an official receipt. We never ask for donation or capitation money, and nobody should ask you for it in our name.</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <FilterBar action="/management-quota" values={sp} fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'Course or college' },
            { name: 'level', label: 'Level', type: 'select', options: ['UG', 'PG', 'Diploma', 'PhD', 'Certificate'] },
            { name: 'quota', label: 'Quota', type: 'select', options: ['Management', 'NRI', 'NRI Sponsored', 'Institutional', 'Foreign National'] },
            { name: 'state', label: 'State', type: 'select', options: states },
            { name: 'city', label: 'City', type: 'city', placeholder: 'Any city' },
            { name: 'open', label: 'Show', type: 'select', options: [{ value: 'all', label: 'Open and closed' }] },
            { name: 'sort', label: 'Sort by', type: 'select', options: [{ value: 'fee', label: 'Lowest fee' }, { value: 'deadline', label: 'Closing soon' }] },
          ]} />
        </aside>
        <section>
          {seats.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{seats.map((s) => <QuotaSeatCard key={s.id} s={s} />)}</div>
          ) : (
            <EmptyState icon={<GraduationCap size={28} />} title="No management quota seats match" text="New seats are added as colleges open admissions. Try another course or state, or ask a counsellor." />
          )}
          <Pagination page={page} total={total} perPage={PER_PAGE} basePath="/management-quota" params={sp} />
          <p className="mt-8 text-center text-sm text-slate-500">Can&apos;t find your course? <Link href="/counselling" className="font-semibold text-brand-700 underline">Get free counselling</Link></p>
        </section>
      </div>
    </div>
  );
}
