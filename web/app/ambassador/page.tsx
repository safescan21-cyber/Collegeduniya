import type { Metadata } from 'next';
import Ambassador from './Ambassador';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Campus ambassador programme — earn rewards, certificate & internship experience',
  description: 'Represent StudyEarnstay at your college: help juniors find colleges, PGs and part-time jobs, earn points for every student you bring and climb the monthly leaderboard.',
  alternates: { canonical: '/ambassador' },
};

export default async function AmbassadorPage() {
  const board = hasSupabase ? ((await supabasePublic().rpc('referral_leaderboard', { p_days: 30 })).data || []) : [];
  return <Ambassador board={board as any[]} />;
}
