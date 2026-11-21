import { ExternalLink } from 'lucide-react';
import { timeAgo } from '@/lib/format';

export type ExamNewsItem = { id: string; title: string; url: string; source: string | null; published_at: string; official: boolean };

export default function ExamNewsList({ items, name }: { items: ExamNewsItem[]; name: string }) {
  return (
    <section id="news" className="card scroll-mt-24 p-6">
      <h2 className="text-lg font-bold text-slate-900">{name} in the news</h2>
      {items.length ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((n) => (
            <li key={n.id} className="py-2.5">
              <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="group font-medium text-slate-900 hover:text-brand-700">
                {n.title} <ExternalLink size={12} className="inline text-slate-400 group-hover:text-brand-600" />
              </a>
              <p className="mt-0.5 text-xs text-slate-500">
                {n.official && <span className="mr-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">Official</span>}
                {n.source} · {timeAgo(n.published_at)}
              </p>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-slate-500">No news in the last few days. Follow the exam to get an email when there is.</p>}
      <p className="mt-3 text-xs text-slate-400">Headlines found with the <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer" className="underline">GDELT Project</a>. Each link opens the original publisher. Always confirm dates on the official website.</p>
    </section>
  );
}
