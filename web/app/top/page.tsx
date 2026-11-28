import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { EmptyState } from '@/components/Cards';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { topPath } from '@/lib/top';

export const revalidate = 21600;
export const metadata: Metadata = {
  title: 'Top colleges by stream, state and city',
  description: 'Engineering, medical, management, law, arts and science colleges by state and city, in order of their official rank (NIRF where available), with fees and student reviews where we have them.',
  alternates: { canonical: '/top' },
};

export default async function TopIndex() {
  let rows: any[] = [];
  if (hasSupabase) rows = ((await supabasePublic().rpc('stream_place_counts', { p_min: 3 }).limit(5000)).data || []) as any[];
  const streams = new Map<string, { slug: string; places: any[] }>(); // stream → places
  for (const r of rows) {
    const s = streams.get(r.stream) || { slug: r.stream_slug as string, places: [] as any[] };
    if (r.place_type !== 'country') s.places.push(r);
    streams.set(r.stream, s);
  }
  const list = Array.from(streams.entries()).sort((a, b) => b[1].places.length - a[1].places.length);
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><Trophy className="text-amber-500" />Top colleges</h1>
      <p className="mt-1 text-slate-500">Pick a stream and a place. Lists are ranked by official ranking first.</p>
      {list.length ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {list.map(([name, s]) => (
            <section key={name} className="card p-5">
              <Link href={topPath(s.slug)} className="text-lg font-bold text-brand-700 hover:underline">Top {name} colleges</Link>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.places.sort((a, b) => (a.place_type === b.place_type ? b.colleges - a.colleges : a.place_type === 'state' ? -1 : 1)).slice(0, 24).map((p) => (
                  <Link key={p.place_type + p.place_slug} href={topPath(s.slug, p.place_slug)} className="chip hover:bg-brand-50">{p.place}</Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : <EmptyState title="Lists appear once colleges are added" />}
    </div>
  );
}
