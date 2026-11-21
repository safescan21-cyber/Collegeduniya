'use client';
import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

type C = { id: string; name: string; city: string | null; state: string | null };

export default function CollegePicker({ value, onChange }: { value: string | null; onChange: (id: string | null, c?: C) => void }) {
  const [q, setQ] = useState(''); const [list, setList] = useState<C[]>([]); const [sel, setSel] = useState<C | null>(null);
  useEffect(() => {
    if (!value) { setSel(null); return; }
    if (sel?.id === value) return;
    supabaseBrowser().from('colleges').select('id, name, city, state').eq('id', value).maybeSingle().then(({ data }: { data: C | null }) => setSel(data));
  }, [value, sel?.id]);
  useEffect(() => {
    const t = q.trim(); if (t.length < 2) { setList([]); return; }
    const h = setTimeout(() => supabaseBrowser().from('colleges').select('id, name, city, state').ilike('name', `%${t.replace(/[%_,()]/g, ' ')}%`)
      .eq('is_published', true).order('name').limit(8).then(({ data }: { data: C[] | null }) => setList(data || [])), 250);
    return () => clearTimeout(h);
  }, [q]);
  if (sel) return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <span><b>{sel.name}</b>{sel.city ? <span className="text-slate-500"> · {sel.city}</span> : null}</span>
      <button type="button" onClick={() => { setSel(null); onChange(null); }} aria-label="Change college" className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
    </div>);
  return (
    <div className="relative">
      <Search size={15} className="absolute start-3 top-3 text-slate-400" />
      <input className="input ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your college…" />
      {list.length > 0 && <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{list.map((c) => (
        <li key={c.id}><button type="button" onClick={() => { setSel(c); setQ(''); setList([]); onChange(c.id, c); }} className="block w-full px-3 py-2 text-start text-sm hover:bg-slate-50">
          {c.name}<span className="text-slate-500">{c.city ? ` · ${c.city}` : ''}{c.state ? `, ${c.state}` : ''}</span></button></li>))}</ul>}
    </div>);
}
