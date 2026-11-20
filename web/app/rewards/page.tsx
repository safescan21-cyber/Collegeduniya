import type { Metadata } from 'next';
import Rewards from './Rewards';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Rewards — earn points for reviews, applications and referrals',
  description: 'Write a verified college review, apply to colleges or invite friends to StudyEarnstay and redeem points for vouchers.',
  alternates: { canonical: '/rewards' },
};

export default async function RewardsPage() {
  const catalog = hasSupabase ? ((await supabasePublic().from('reward_catalog').select('code, title, points, stock').eq('is_active', true).order('points')).data || []) : [];
  return <Rewards catalog={catalog as any[]} />;
}
