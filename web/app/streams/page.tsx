import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { STREAMS } from '@/lib/streams';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts
export const metadata: Metadata = {
  title: 'Choose your stream — colleges, courses and exams by stream',
  description: 'Engineering, MBA, medical, law, design, commerce, science, arts and more: top colleges, courses, entrance exams and predictors for each stream.',
  alternates: { canonical: '/streams' },
};

export default async function StreamsPage() {
  let ov: Record<string, { colleges: number; exams: number; courses: number }> = {};
  if (hasSupabase) { const { data } = await supabasePublic().rpc('stream_overview'); ov = Object.fromEntries(((data || []) as any[]).map((r) => [r.stream, r])); }
  return (
    <div className="container-x py-10">
      <h1 className="text-3xl font-extrabold text-slate-900">Choose your stream</h1>
      <p className="mt-1 text-slate-500">Everything for one field in one place: colleges, courses, entrance exams, predictors and news.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STREAMS.map((s) => (
          <Link key={s.slug} href={`/streams/${s.slug}`} className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="flex items-center justify-between text-lg font-bold text-slate-900">{s.label}<ArrowRight size={18} className="text-slate-300 group-hover:text-brand-600" /></p>
            <p className="mt-1 text-sm text-slate-500">{s.blurb}</p>
            <p className="mt-3 text-xs font-medium text-slate-600">{(ov[s.name]?.colleges || 0).toLocaleString('en-IN')} colleges · {ov[s.name]?.courses || 0} courses · {ov[s.name]?.exams || 0} exams</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
