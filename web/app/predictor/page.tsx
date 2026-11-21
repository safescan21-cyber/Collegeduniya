import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Target } from 'lucide-react';
import Predictor from './Predictor';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'College predictor — JEE, NEET, CUET, state CETs and more',
  description: 'Free college predictors for JEE, NEET, CUET and other entrance exams: enter your rank, category and home state to see colleges where you have a high, medium or low chance, based on last year’s closing ranks.',
};

export default async function PredictorPage() {
  let exams: { slug: string; short_name: string; full_name: string | null; stream: string | null; has: boolean }[] = [];
  let categories: string[] = ['General']; let quotas: string[] = []; let states: string[] = [];
  if (hasSupabase) {
    const sb = supabasePublic();
    const { data } = await sb.from('cutoffs').select('exam_slug, category, quota, home_state').limit(5000);
    const withData = new Set((data || []).map((x: any) => x.exam_slug));
    categories = Array.from(new Set(['General', ...(data || []).map((x: any) => x.category)]));
    quotas = Array.from(new Set((data || []).map((x: any) => x.quota).filter(Boolean)));
    states = Array.from(new Set((data || []).map((x: any) => x.home_state).filter(Boolean))).sort() as string[];
    const { data: ex } = await sb.from('exams').select('slug, short_name, full_name, stream, level').eq('is_published', true).neq('level', 'Abroad').order('short_name');
    exams = (ex || []).map((e: any) => ({ ...e, has: withData.has(e.slug) }));
  }
  const ready = exams.filter((e) => e.has);
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Target className="text-brand-600" />College predictors</h1>
      <p className="mt-1 text-slate-500">Pick your exam for a dedicated predictor with home-state quota and category.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {exams.map((e) => (
          <Link key={e.slug} href={`/predictor/${e.slug}`} className="card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="font-bold text-slate-900">{e.short_name} predictor</p>
            <p className="truncate text-xs text-slate-500">{e.stream}</p>
            <span className={`mt-2 inline-block ${e.has ? 'chip-green' : 'chip'}`}>{e.has ? 'Cutoffs available' : 'Coming soon'}</span>
          </Link>
        ))}
      </div>
      {ready.length > 0 && (
        <div className="mt-10">
          <Suspense fallback={<div className="card h-64 animate-pulse" />}>
            <Predictor title="Quick predictor" exams={ready} categories={categories} quotas={quotas} states={states} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
