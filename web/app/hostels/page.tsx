import type { Metadata } from 'next';
import { Home } from 'lucide-react';
import { HostelCard, EmptyState } from '@/components/Cards';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm, distinctValues } from '@/lib/data';
import type { Hostel } from '@/lib/types';

export const dynamic = 'force-dynamic';
const PER_PAGE = 12;
type SP = Record<string, string | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const where = sp.city || sp.country;
  return {
    title: where ? `PG & hostels in ${where} for students` : 'PG & hostels near colleges',
    description: `Find ${sp.gender ? sp.gender.toLowerCase() + ' ' : ''}PG, hostels and flats${where ? ` in ${where}` : ''} near your college with rent, food and amenities.`,
  };
}

export default async function HostelsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  let hostels: Hostel[] = [];
  let total = 0;

  if (hasSupabase) {
    let q = supabasePublic().from('hostels').select('*, colleges(name, slug)', { count: 'exact' }).eq('is_published', true);
    const term = cleanTerm(sp.q);
    if (term) q = q.or(`name.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%`);
    if (sp.country) q = q.eq('country', sp.country);
    if (sp.city) q = q.ilike('city', cleanTerm(sp.city));
    if (sp.type) q = q.eq('type', sp.type);
    if (sp.gender) q = q.eq('gender', sp.gender);
    if (sp.amenity) q = q.contains('amenities', [sp.amenity]);
    if (sp.rent_max) q = q.lte('rent_min', Number(sp.rent_max));
    q = sp.sort === 'rent_low' ? q.order('rent_min', { ascending: true, nullsFirst: false })
      : sp.sort === 'rent_high' ? q.order('rent_max', { ascending: false, nullsFirst: false })
      : q.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
    const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    hostels = (data || []) as Hostel[];
    total = count || 0;
  }
  const countries = await distinctValues('hostels', 'country');

  return (
    <div className="container-x py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">PG & Hostels{sp.city ? ` in ${sp.city}` : ''}</h1>
        <p className="mt-1 text-slate-500">{total.toLocaleString()} places to stay near colleges</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <FilterBar action="/hostels" values={sp} fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'Area, city or name' },
            { name: 'country', label: 'Country', type: 'select', options: countries },
            { name: 'city', label: 'City', type: 'text', placeholder: 'e.g. Bengaluru' },
            { name: 'type', label: 'Type', type: 'select', options: ['PG', 'Hostel', 'Flat', 'Homestay'] },
            { name: 'gender', label: 'For', type: 'select', options: ['Boys', 'Girls', 'Co-ed'] },
            { name: 'amenity', label: 'Must have', type: 'select', options: ['Food', 'Wi-Fi', 'AC', 'Laundry', 'Gym', 'CCTV', 'Transport'] },
            { name: 'rent_max', label: 'Max rent', type: 'text', placeholder: 'e.g. 12000' },
            { name: 'sort', label: 'Sort by', type: 'select', options: [{ value: 'rent_low', label: 'Rent: low to high' }, { value: 'rent_high', label: 'Rent: high to low' }] },
          ]} />
        </aside>
        <section>
          {hostels.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{hostels.map((h) => <HostelCard key={h.id} h={h} />)}</div>
          ) : <EmptyState icon={<Home size={28} />} title="No stays found" text="Try another city or remove some filters." />}
          <Pagination page={page} total={total} perPage={PER_PAGE} basePath="/hostels" params={sp} />
        </section>
      </div>
    </div>
  );
}
