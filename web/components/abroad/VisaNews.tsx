import Link from 'next/link';
import { ExternalLink, Landmark, Newspaper } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

type N = { id: string; country_code: string; title: string; url: string; source: string | null; official: boolean; topic: string; published_at: string };
const TOPIC: Record<string, [string, string]> = {
  rules: ['Rule change', 'bg-rose-50 text-rose-700'], fees: ['Fees & money', 'bg-amber-50 text-amber-800'], work: ['Work rights', 'bg-emerald-50 text-emerald-700'],
  processing: ['Processing', 'bg-sky-50 text-sky-700'], family: ['Family', 'bg-violet-50 text-violet-700'], news: ['News', 'bg-slate-100 text-slate-600'],
};
const NAME: Record<string, string> = { GB: 'UK', US: 'USA', CA: 'Canada', AU: 'Australia', IE: 'Ireland', NZ: 'New Zealand', DE: 'Germany', FR: 'France', NL: 'Netherlands', SG: 'Singapore', AE: 'UAE', JP: 'Japan' };
const flag = (cc: string) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
const when = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 864e5;
  return d < 1 ? 'today' : d < 2 ? 'yesterday' : d < 7 ? `${Math.floor(d)} days ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Latest student-visa news — collected every 6 hours from governments' own news feeds and news headlines
// (server/src/services/visaNews.js). Official government items first within the last 30 days; each opens the original page.
export default async function VisaNews({ country, limit = 8, title }: { country?: string; limit?: number; title?: string }) {
  if (!hasSupabase) return null;
  let q = supabasePublic().from('visa_news').select('id, country_code, title, url, source, official, topic, published_at')
    .eq('is_hidden', false).gte('published_at', new Date(Date.now() - 120 * 864e5).toISOString()).order('published_at', { ascending: false }).limit(60);
  if (country) q = q.eq('country_code', country.toUpperCase());
  const { data } = await q;
  const all = (data || []) as N[];
  if (!all.length) return null;
  const recent = Date.now() - 30 * 864e5;
  // official items from the last 30 days on top, then everything else by date
  const rows = [...all.filter((n) => n.official && Date.parse(n.published_at) > recent), ...all.filter((n) => !(n.official && Date.parse(n.published_at) > recent))].slice(0, limit);
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Newspaper size={20} className="text-brand-600" />{title || (country ? `Latest ${NAME[country.toUpperCase()] || country.toUpperCase()} student visa news` : 'Latest student visa news')}</h2>
      <p className="mt-1 text-sm text-slate-500">Updated every few hours from the government’s own announcements and the news. Always check the official website before you apply.</p>
      <ul className="card mt-4 divide-y divide-slate-100">
        {rows.map((n) => { const [t, c] = TOPIC[n.topic] || TOPIC.news; return (
          <li key={n.id} className="p-4">
            <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="group block">
              <p className="font-semibold text-slate-900 group-hover:text-brand-700">{!country && <span className="me-1">{flag(n.country_code)}</span>}{n.title} <ExternalLink size={12} className="inline text-slate-400" /></p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {n.official && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"><Landmark size={11} />Official</span>}
                <span className={`rounded-full px-2 py-0.5 font-medium ${c}`}>{t}</span>
                <span>{n.source}</span><span>·</span><time dateTime={n.published_at}>{when(n.published_at)}</time>
              </p>
            </a>
          </li>); })}
      </ul>
      {!country && <p className="mt-2 text-xs text-slate-400">News headlines found with the GDELT Project; official items from UK Visas and Immigration (GOV.UK), USCIS, IRCC Canada and the Irish Immigration Service. Collegeolo is not linked to any government.</p>}
      {country && <p className="mt-2 text-xs text-slate-400">Headlines link to the original publisher. <Link href="/study-abroad/visa" className="underline">News for all countries</Link></p>}
    </section>
  );
}
