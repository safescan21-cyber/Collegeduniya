'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, GraduationCap, Home, Briefcase, BookOpen } from 'lucide-react';
import { useLang } from './LangProvider';

const TABS = [
  { key: 'colleges', label: 'home.tab.colleges', icon: GraduationCap, placeholder: 'home.ph.colleges' },
  { key: 'courses', label: 'home.tab.courses', icon: BookOpen, placeholder: 'home.ph.courses' },
  { key: 'hostels', label: 'home.tab.hostels', icon: Home, placeholder: 'home.ph.hostels' },
  { key: 'jobs', label: 'home.tab.jobs', icon: Briefcase, placeholder: 'home.ph.jobs' },
] as const;

const POPULAR = ['Computer Science', 'Data Science', 'MBA', 'Medicine', 'Mechanical Engineering', 'Nursing', 'Economics', 'Psychology'];

export default function HeroSearch() {
  const router = useRouter();
  const { t } = useLang();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('colleges');
  const [q, setQ] = useState('');
  const current = TABS.find((x) => x.key === tab)!;
  // courses → the course search (country rank, then world, then state, with fees)
  const go = (text: string) => router.push(tab === 'courses' ? `/courses/search${text ? `?q=${encodeURIComponent(text)}` : ''}` : `/${tab}${text ? `?q=${encodeURIComponent(text)}` : ''}`);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex justify-center gap-2">
        {TABS.map((x) => (
          <button key={x.key} type="button" onClick={() => setTab(x.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === x.key ? 'bg-white text-brand-800' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <x.icon size={16} />{t(x.label)}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); go(q); }}
        className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-brand-950/40">
        <Search className="ml-2 shrink-0 text-slate-400" size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(current.placeholder)}
          className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-slate-800 outline-none placeholder:text-slate-400" />
        <button className="btn-accent px-6">{t('home.search')}</button>
      </form>
      {tab === 'courses' && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {POPULAR.map((c) => <button key={c} type="button" onClick={() => go(c)} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20">{c}</button>)}
        </div>
      )}
    </div>
  );
}
