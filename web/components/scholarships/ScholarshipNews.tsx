import { ExternalLink, Landmark, Newspaper } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { newsDate, seenDate, sourceName } from '@/lib/newsDate';

// Latest scholarship news: official notices (National Scholarship Portal, UGC, AICTE) first, then news headlines
export default async function ScholarshipNews({ limit = 10 }: { limit?: number }) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().from('study_news').select('id, title, url, source, published_at, official, date_known')
    .eq('category', 'scholarships').eq('is_hidden', false).gte('published_at', new Date(Date.now() - 90 * 864e5).toISOString())
    .order('published_at', { ascending: false }).limit(40);
  const all = (data || []) as any[];
  if (!all.length) return null;
  const rows = [...all.filter((n) => n.official), ...all.filter((n) => !n.official)].slice(0, limit);
  return (
    <section className="mb-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Newspaper size={19} className="text-brand-600" />Latest scholarship news</h2>
      <ul className="card mt-3 divide-y divide-slate-100">{rows.map((n) => (
        <li key={n.id} className="p-3.5"><a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="group block">
          <p className="font-semibold text-slate-900 group-hover:text-brand-700">{n.title} <ExternalLink size={11} className="inline text-slate-400" /></p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {n.official && <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 font-semibold text-emerald-700"><Landmark size={10} />Official</span>}
            <span>Source: <b className="font-medium text-slate-600">{sourceName(n.source)}</b></span><span>·</span>
            <time dateTime={n.published_at} className="text-slate-600">{n.date_known === false ? seenDate(n.published_at) : newsDate(n.published_at)}</time></p>
        </a></li>))}</ul>
      <p className="mt-1.5 text-xs text-slate-400">Updated every few hours from the government’s scholarship portals and the news. Each item opens the original page.</p>
    </section>
  );
}
