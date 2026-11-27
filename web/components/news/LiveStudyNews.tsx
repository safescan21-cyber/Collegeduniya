import Link from 'next/link';
import { ExternalLink, Landmark, Radio } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

// Live study news on /news: education headlines (services/studyNews.js) + student visa news (services/visaNews.js),
// collected every few hours. Each item opens the original publisher; only headline, source and link are stored.
const CATS = [
  { key: '', label: 'All' }, { key: 'admissions', label: 'Admissions' }, { key: 'scholarships', label: 'Scholarships' },
  { key: 'colleges', label: 'Universities & colleges' }, { key: 'policy', label: 'Education policy' }, { key: 'abroad', label: 'Study abroad' },
  { key: 'visa', label: 'Visa' }, { key: 'skills', label: 'Skills & jobs' },
];
type Item = { id: string; cat: string; title: string; url: string; source: string | null; published_at: string; official?: boolean; cc?: string; college?: { name: string; slug: string } };
const flag = (cc: string) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
const when = (iso: string) => {
  const h = (Date.now() - new Date(iso).getTime()) / 3600e3;
  return h < 1 ? 'just now' : h < 24 ? `${Math.floor(h)} h ago` : h < 48 ? 'yesterday' : `${Math.floor(h / 24)} days ago`;
};

export default async function LiveStudyNews({ live, limit = 12 }: { live?: string; limit?: number }) {
  if (!hasSupabase) return null;
  const sb = supabasePublic();
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const cat = CATS.some((c) => c.key === live) ? live || '' : '';
  const studyQ = () => {
    let q = sb.from('study_news').select('id, category, title, url, source, published_at').eq('is_hidden', false).gte('published_at', since).order('published_at', { ascending: false }).limit(40);
    if (cat) q = q.eq('category', cat);
    return q;
  };
  const visaQ = () => sb.from('visa_news').select('id, country_code, title, url, source, official, published_at').eq('is_hidden', false).gte('published_at', since)
    .order('published_at', { ascending: false }).limit(cat === 'visa' ? 40 : 8);
  // news naming a specific college joins "All" and "Universities & colleges", with a link to that college
  const collegeQ = () => sb.from('college_news').select('id, title, url, source, published_at, college:colleges(name, short_name, slug)').eq('is_hidden', false)
    .gte('published_at', since).order('published_at', { ascending: false }).limit(cat === 'colleges' ? 30 : 10);
  const [study, visa, coll] = await Promise.all([
    cat === 'visa' ? Promise.resolve({ data: [] as any[] }) : studyQ(),
    cat && cat !== 'visa' && cat !== 'abroad' ? Promise.resolve({ data: [] as any[] }) : visaQ(),
    cat && cat !== 'colleges' ? Promise.resolve({ data: [] as any[] }) : collegeQ(),
  ]);
  const items: Item[] = [
    ...((study.data || []) as any[]).map((n) => ({ id: n.id, cat: n.category, title: n.title, url: n.url, source: n.source, published_at: n.published_at })),
    ...((visa.data || []) as any[]).map((n) => ({ id: n.id, cat: 'visa', title: n.title, url: n.url, source: n.source, published_at: n.published_at, official: n.official, cc: n.country_code })),
    ...((coll.data || []) as any[]).filter((n) => n.college).map((n) => ({ id: n.id, cat: 'colleges', title: n.title, url: n.url, source: n.source, published_at: n.published_at,
      college: { name: n.college.short_name || n.college.name, slug: n.college.slug } })),
  ].filter((n, i, all) => all.findIndex((x) => x.url === n.url) === i)   // same story as study + college news: once.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, limit);
  const label = (k: string) => CATS.find((c) => c.key === k)?.label || k;

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Radio size={20} className="text-rose-500" />Latest study news</h2>
        <p className="text-xs text-slate-500">Updated every few hours</p>
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">{CATS.map((c) => (
        <Link key={c.key} href={c.key ? `/news?live=${c.key}#live` : '/news#live'} scroll={false} className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${cat === c.key ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{c.label}</Link>))}</div>
      {items.length === 0 ? <p className="card mt-3 p-5 text-sm text-slate-500">No {cat ? label(cat).toLowerCase() : ''} news in the last two weeks yet — it’s collected every few hours.</p> : (
        <ul id="live" className="card mt-3 grid scroll-mt-28 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0">
          {items.map((n) => (
            <li key={n.id} className="border-slate-100 p-4 md:border-b md:odd:border-e">
              {n.college && <Link href={`/colleges/${n.college.slug}#news`} className="mb-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">{n.college.name}</Link>}
              <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="group block">
                <p className="line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-700">{n.cc && <span className="me-1">{flag(n.cc)}</span>}{n.title} <ExternalLink size={11} className="inline text-slate-400" /></p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  {n.official && <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 font-semibold text-emerald-700"><Landmark size={10} />Official</span>}
                  <span className="rounded-full bg-slate-100 px-1.5 font-medium text-slate-600">{label(n.cat)}</span><span>{n.source}</span><span>·</span><time dateTime={n.published_at}>{when(n.published_at)}</time>
                </p>
              </a>
            </li>))}
        </ul>)}
      <p className="mt-2 text-xs text-slate-400">Headlines link to the original publishers (found with the GDELT Project); official visa items come from the governments’ own news. <Link href="/study-abroad/visa" className="underline">Visa news by country</Link></p>
    </section>
  );
}
