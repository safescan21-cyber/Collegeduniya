import { Flag } from '@/components/Flag';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Globe2 } from 'lucide-react';
import CityInput from '@/components/CityInput';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Colleges by city — every city in the world with colleges',
  description: 'Pick any city in the world to see colleges, PG & hostels, hospitals and part-time jobs for students.',
};
type SP = Record<string, string | undefined>;

export default async function CitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  let countries: { code: string; name: string; continent: string | null }[] = [];
  let cities: { name: string; slug: string; admin1: string | null; colleges_count: number }[] = [];
  let total = 0; let countryName = '';
  const counts = new Map<string, { cities: number; colleges: number }>();
  const PER = 200; const page = Math.max(1, Number(sp.page) || 1); const q = (sp.q || '').trim().slice(0, 60);
  if (hasSupabase) {
    const sb = supabasePublic();
    const [{ data }, { data: cc }] = await Promise.all([
      sb.from('countries').select('code, name, continent').order('name'),
      sb.rpc('country_college_counts'),
    ]);
    countries = data || [];
    for (const r of (cc || []) as any[]) counts.set(r.code, { cities: r.cities, colleges: Number(r.colleges) });
    if (sp.country) {
      countryName = countries.find((c) => c.code === sp.country!.toUpperCase())?.name || '';
      const { data: cs } = await sb.rpc('cities_with_colleges', { p_country: sp.country, p_q: q || null, p_offset: (page - 1) * PER, p_lim: PER });
      cities = (cs || []) as any[]; total = Number((cs as any[])?.[0]?.total || 0);
    }
  }
  const continents: Record<string, string> = { AS: 'Asia', EU: 'Europe', AF: 'Africa', NA: 'North America', SA: 'South America', OC: 'Oceania', AN: 'Antarctica' };
  // countries with colleges first, by number of colleges
  const grouped = [...countries].sort((a, b) => (counts.get(b.code)?.colleges || 0) - (counts.get(a.code)?.colleges || 0) || a.name.localeCompare(b.name))
    .reduce<Record<string, typeof countries>>((acc, c) => { (acc[c.continent || '—'] ||= []).push(c); return acc; }, {});
  const pages = Math.ceil(total / PER);
  const href = (p: number) => `/cities?${new URLSearchParams(Object.entries({ country: sp.country, q: q || undefined, page: p > 1 ? String(p) : undefined }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900">{sp.country && countryName ? <Flag code={sp.country} country={countryName} className="h-7 w-10 rounded" /> : <Globe2 className="text-brand-600" />}{countryName ? `Cities in ${countryName}` : 'Study anywhere in the world'}</h1>
      <div className="mt-5 max-w-xl"><CityInput mode="navigate" country={sp.country} /></div>

      {sp.country ? (
        <>
          <Link href="/cities" className="mt-4 inline-block text-sm text-brand-700 hover:underline">← All countries</Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <p className="text-slate-600"><b>{total.toLocaleString('en-IN')}</b> {q ? `cities matching “${q}”` : 'cities with colleges'}{counts.get(sp.country.toUpperCase()) ? ` · ${counts.get(sp.country.toUpperCase())!.colleges.toLocaleString('en-IN')} colleges` : ''}</p>
            <form className="flex gap-2"><input type="hidden" name="country" value={sp.country} /><input name="q" defaultValue={q} className="input w-56 py-1.5" placeholder="Find a city or state" /><button className="btn-ghost py-1.5">Search</button></form>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {cities.map((c) => (
              <Link key={c.slug} href={`/city/${c.slug}`} className="card flex items-center justify-between gap-2 p-3 hover:border-brand-300">
                <span className="min-w-0"><span className="block truncate font-medium text-slate-900">{c.name}</span><span className="block truncate text-xs text-slate-500">{c.admin1}</span></span>
                <span className="chip-brand shrink-0">{c.colleges_count} {c.colleges_count === 1 ? 'college' : 'colleges'}</span>
              </Link>
            ))}
          </div>
          {pages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
              {page > 1 && <Link href={href(page - 1)} className="btn-ghost py-1.5">← Previous</Link>}
              <span className="text-slate-500">Page {page} of {pages}</span>
              {page < pages && <Link href={href(page + 1)} className="btn-ghost py-1.5">Next →</Link>}
            </div>
          )}
          {!cities.length && <p className="mt-6 text-slate-500">{q ? 'No city with colleges matches that — try another spelling.' : 'No colleges placed in a city of this country yet.'}</p>}
        </>
      ) : (
        <div className="mt-8 space-y-8">
          {Object.entries(grouped).sort().map(([cont, list]) => (
            <section key={cont}>
              <h2 className="mb-3 text-lg font-bold text-slate-900">{continents[cont] || cont}</h2>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {list.map((c) => { const k = counts.get(c.code); return (
                  <Link key={c.code} href={`/cities?country=${c.code}`} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white hover:shadow-sm ${k ? '' : 'opacity-60'}`}>
                    <Flag code={c.code} country={c.name} className="h-4 w-6" /><span className="min-w-0"><span className="block truncate">{c.name}</span>{k && <span className="block text-[11px] text-slate-500">{k.cities.toLocaleString('en-IN')} cities · {k.colleges.toLocaleString('en-IN')} colleges</span>}</span>
                  </Link>); })}
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
