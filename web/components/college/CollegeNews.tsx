import { ExternalLink, Newspaper } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { newsDate, sourceName } from '@/lib/newsDate';

// "In the news" on a college page — headlines that name this college (server/src/services/collegeNews.js).
export default async function CollegeNews({ collegeId, name }: { collegeId: string; name: string }) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().from('college_news').select('id, title, url, source, published_at')
    .eq('college_id', collegeId).eq('is_hidden', false).gte('published_at', new Date(Date.now() - 180 * 864e5).toISOString())
    .order('published_at', { ascending: false }).limit(6);
  if (!data?.length) return null;
  return (
    <section id="news" className="scroll-mt-32">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-slate-900"><Newspaper size={20} className="text-brand-600" />{name} in the news</h2>
      <ul className="card divide-y divide-slate-100">{data.map((n: any) => (
        <li key={n.id} className="p-4"><a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="group block">
          <p className="font-semibold text-slate-900 group-hover:text-brand-700">{n.title} <ExternalLink size={11} className="inline text-slate-400" /></p>
          <p className="mt-1 text-xs text-slate-500">Source: <b className="font-medium text-slate-600">{sourceName(n.source)}</b> · <time dateTime={n.published_at} className="text-slate-600">{newsDate(n.published_at)}</time></p></a></li>))}
      </ul>
      <p className="mt-2 text-xs text-slate-400">Headlines from news websites, found automatically — each opens the original article. Collegeolo doesn’t write or check these stories.</p>
    </section>
  );
}
