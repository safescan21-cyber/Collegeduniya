'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, GraduationCap, Home, Briefcase } from 'lucide-react';

const TABS = [
  { key: 'colleges', label: 'Colleges', icon: GraduationCap, placeholder: 'Search college, course or city…' },
  { key: 'hostels', label: 'PG / Hostel', icon: Home, placeholder: 'Search area, city or college…' },
  { key: 'jobs', label: 'Part-time Jobs', icon: Briefcase, placeholder: 'Search job title, company or city…' },
] as const;

export default function HeroSearch() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('colleges');
  const [q, setQ] = useState('');
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex justify-center gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t.key ? 'bg-white text-brand-800' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <t.icon size={16} />{t.label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); router.push(`/${tab}${q ? `?q=${encodeURIComponent(q)}` : ''}`); }}
        className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-brand-950/40">
        <Search className="ml-2 shrink-0 text-slate-400" size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={current.placeholder}
          className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-slate-800 outline-none placeholder:text-slate-400" />
        <button className="btn-accent px-6">Search</button>
      </form>
    </div>
  );
}
