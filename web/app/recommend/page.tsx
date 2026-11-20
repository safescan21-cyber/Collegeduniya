import type { Metadata } from 'next';
import { Suspense } from 'react';
import Recommend from './Recommend';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Which college should I choose? Personalised college recommendations',
  description: 'Tell us your exam rank, budget, home state and stream — get a ranked list of colleges with the reasons why, from real cutoffs, NIRF rankings and student reviews.',
};

export default async function RecommendPage() {
  let exams: { slug: string; short_name: string }[] = [];
  if (hasSupabase) {
    const { data } = await supabasePublic().from('exams').select('slug, short_name').eq('is_published', true).neq('level', 'Abroad').order('short_name');
    exams = data || [];
  }
  return <div className="container-x py-10"><Suspense fallback={<div className="card h-64 animate-pulse" />}><Recommend exams={exams} /></Suspense></div>;
}
