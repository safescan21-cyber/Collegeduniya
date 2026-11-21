import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import CityView from '@/components/CityView';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false } };
type SP = Record<string, string | undefined>;

// For towns found through OpenStreetMap that are not in the GeoNames table
export default async function CitySearch({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const lat = Number(sp.lat); const lng = Number(sp.lng);
  if (!sp.name || !Number.isFinite(lat) || !Number.isFinite(lng)) notFound();
  if (hasSupabase) {
    const { data } = await supabasePublic().from('cities').select('slug').ilike('name', sp.name).eq('country_code', (sp.country || '').toUpperCase()).order('population', { ascending: false }).limit(1);
    if (data?.[0]?.slug) redirect(`/city/${data[0].slug}`);
  }
  let country: string | null = null;
  if (hasSupabase && sp.country) {
    const { data } = await supabasePublic().from('countries').select('name').eq('code', sp.country.toUpperCase()).maybeSingle();
    country = data?.name || null;
  }
  return <CityView city={{ geoname_id: null, name: sp.name, admin1: null, country, country_code: sp.country?.toUpperCase() || null, latitude: lat, longitude: lng, population: null }} />;
}
