import type { Metadata } from 'next';
import { Suspense } from 'react';
import Predictor from './Predictor';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'College predictor — find colleges you can get with your rank',
  description: 'Enter your entrance exam rank and category to see colleges and courses where you have a high, medium or low chance, based on last year’s closing ranks.',
};

export default async function PredictorPage() {
  let exams: { slug: string; short_name: string }[] = [];
  let categories: string[] = ['General'];
  let quotas: string[] = [];
  if (hasSupabase) {
    const sb = supabasePublic();
    const { data } = await sb.from('cutoffs').select('exam_slug, category, quota').limit(5000);
    const slugs = Array.from(new Set((data || []).map((x: any) => x.exam_slug)));
    categories = Array.from(new Set(['General', ...(data || []).map((x: any) => x.category)]));
    quotas = Array.from(new Set((data || []).map((x: any) => x.quota).filter(Boolean)));
    if (slugs.length) {
      const { data: ex } = await sb.from('exams').select('slug, short_name').in('slug', slugs).order('short_name');
      exams = ex || [];
    }
  }
  return (
    <div className="container-x py-10">
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <Predictor exams={exams} categories={categories} quotas={quotas} />
      </Suspense>
    </div>
  );
}
