import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CityView, { type CityInfo } from '@/components/CityView';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getCity(slug: string) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().from('cities').select('*').eq('slug', slug).maybeSingle();
  return data as CityInfo | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCity((await params).slug);
  if (!c) return { title: 'City not found' };
  return {
    title: `Colleges, PG & part-time jobs in ${c.name}, ${c.country}`,
    description: `Find colleges and universities in ${c.name}, PGs and hostels nearby, hospitals, and part-time jobs for students — StudyEarnstay.`,
    alternates: { canonical: `/city/${c.slug}` },
  };
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getCity((await params).slug);
  if (!c) notFound();
  return <CityView city={c} />;
}
