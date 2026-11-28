'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useList, toggleItem, readList, type ListItem } from '@/lib/localList';

// Search box to add colleges + chips to remove them. Keeps URL (?c=) and localStorage in sync.
export default function CompareClient({ selected }: { selected: ListItem[] }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const list = useList('compare');
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<ListItem[]>([]);

  // First visit via a shared link: put the URL's colleges into the compare list
  useEffect(() => {
    const stored = readList('compare');
    selected.forEach((s) => { if (!stored.some((x) => x.id === s.id)) toggleItem('compare', s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const urlSlugs = selected.map((s) => s.slug).join(',');
    const listSlugs = list.map((s) => s.slug).join(',');
    if (list.length && listSlugs !== urlSlugs) router.replace(`/compare?c=${listSlugs}`);
    if (!list.length && selected.length && typeof window !== 'undefined' && localStorage.getItem('ses_compare') === '[]') router.replace('/compare');
  }, [list, selected, router]);

  useEffect(() => {
    if (q.trim().length < 2) { setOpts([]); return; }
    const term = q.replace(/[%,()*]/g, ' ').trim();
    const t = setTimeout(async () => {
      const { data } = await supabase.from('colleges').select('id, slug, name, city').eq('is_published', true)
        .or(`name.ilike.%${term}%,short_name.ilike.%${term}%,city.ilike.%${term}%`).limit(8);
      setOpts((data || []) as ListItem[]);
    }, 250);
    return () => clearTimeout(t);
  }, [q, supabase]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {list.map((c) => (
        <span key={c.id} className="chip-brand py-1.5 text-sm">{c.name}
          <button onClick={() => toggleItem('compare', c)} aria-label="Remove"><X size={14} /></button></span>
      ))}
      {list.length < 4 && (
        <div className="relative w-full sm:w-72">
          <Plus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Add a college…" value={q} onChange={(e) => setQ(e.target.value)} />
          {opts.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {opts.filter((o) => !list.some((l) => l.id === o.id)).map((o) => (
                <li key={o.id}><button className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => { toggleItem('compare', o); setQ(''); setOpts([]); }}>{o.name} <span className="text-slate-400">· {o.city}</span></button></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
