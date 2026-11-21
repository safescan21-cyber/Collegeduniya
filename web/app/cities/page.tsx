import { Flag } from '@/components/Flag';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Globe2 } from 'lucide-react';
import CityInput from '@/components/CityInput';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Study in any city worldwide — colleges, PGs and jobs by city',
  description: 'Pick any city in the world to see colleges, PG & hostels, hospitals and part-time jobs for students.',
};
type SP = Record<string, string | undefined>;

export default async function CitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  let countries: { code: string; name: string; continent: string | null }[] = [];
  let cities: { name: string; slug: string; admin1: string | null; population: number }[] = [];
  let collegeCities = new Set<string>();
  let countryName = '';
  if (hasSupabase) {
    const sb = supabasePublic();
    const { data } = await sb.from('countries').select('code, name, continent').order('name');
    countries = data || [];
    if (sp.country) {
      countryName = countries.find((c) => c.code === sp.country!.toUpperCase())?.name || '';
      const [{ data: cs }, { data: col }] = await Promise.all([
        sb.from('cities').select('name, slug, admin1, population').eq('country_code', sp.country.toUpperCase()).order('population', { ascending: false }).limit(300),
        sb.from('colleges').select('city').eq('is_published', true).eq('country', countryName).limit(5000),
      ]);
      cities = cs || [];
      collegeCities = new Set((col || []).map((c: any) => String(c.city).toLowerCase()));
    }
  }
  const continents: Record<string, string> = { AS: 'Asia', EU: 'Europe', AF: 'Africa', NA: 'North America', SA: 'South America', OC: 'Oceania', AN: 'Antarctica' };
  const grouped = countries.reduce<Record<string, typeof countries>>((acc, c) => { (acc[c.continent || '—'] ||= []).push(c); return acc; }, {});

  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900">{sp.country && countryName ? <Flag code={sp.country} country={countryName} className="h-7 w-10 rounded" /> : <Globe2 className="text-brand-600" />}{countryName ? `Cities in ${countryName}` : 'Study anywhere in the world'}</h1>
      <div className="mt-5 max-w-xl"><CityInput mode="navigate" country={sp.country} /></div>

      {sp.country ? (
        <>
          <Link href="/cities" className="mt-4 inline-block text-sm text-brand-700 hover:underline">← All countries</Link>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {cities.map((c) => (
              <Link key={c.slug} href={`/city/${c.slug}`} className="card flex items-center justify-between p-3 hover:border-brand-300">
                <span className="min-w-0"><span className="block truncate font-medium text-slate-900">{c.name}</span><span className="block truncate text-xs text-slate-500">{c.admin1}</span></span>
                {collegeCities.has(c.name.toLowerCase()) && <span className="chip-brand shrink-0">colleges</span>}
              </Link>
            ))}
          </div>
          {!cities.length && <p className="mt-6 text-slate-500">No cities imported for this country yet.</p>}
        </>
      ) : (
        <div className="mt-8 space-y-8">
          {Object.entries(grouped).sort().map(([cont, list]) => (
            <section key={cont}>
              <h2 className="mb-3 text-lg font-bold text-slate-900">{continents[cont] || cont}</h2>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {list.map((c) => <Link key={c.code} href={`/cities?country=${c.code}`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white hover:shadow-sm"><Flag code={c.code} country={c.name} className="h-4 w-6" />{c.name}</Link>)}
              </div>
            </section>
          ))}
          {!countries.length && <p className="text-slate-500">Run <code>npm run import:cities</code> in the server folder to load every country and city.</p>}
        </div>
      )}
      <p className="mt-10 text-xs text-slate-400">City data: <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer" className="underline">GeoNames</a> (CC BY 4.0) and OpenStreetMap.</p>
    </div>
  );
}
