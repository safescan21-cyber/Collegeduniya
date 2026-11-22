import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CityView, { type CityInfo } from '@/components/CityView';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n-server';

export const dynamic = 'force-dynamic';

async function getCity(slug: string) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().from('cities').select('*').eq('slug', slug).maybeSingle();
  return data as (CityInfo & { seo_ok?: boolean }) | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCity((await params).slug);
  if (!c) return { title: 'City not found' };
  const { lang } = await getT();
  let local: string | null = null;
  if (lang !== 'en' && c.geoname_id) {
    const { data } = await supabasePublic().rpc('city_local_name', { gid: c.geoname_id, p_lang: lang });
    if (typeof data === 'string' && data !== c.name) local = data;
  }
  return {
    title: `${(c as any).colleges_count ? `${(c as any).colleges_count} colleges in ` : 'Colleges in '}${local ? `${local} (${c.name})` : c.name}, ${c.country} — PG & part-time jobs`,
    description: `Find colleges and universities in ${c.name}, PGs and hostels nearby, hospitals, and part-time jobs for students — Collegeolo.`,
    alternates: { canonical: `/city/${c.slug}` },
    // a town page goes to Google only when it lists something real (3+ colleges, or a PG / job) — migration 018
    robots: c.seo_ok ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getCity((await params).slug);
  if (!c) notFound();
  return <CityView city={c} />;
}
