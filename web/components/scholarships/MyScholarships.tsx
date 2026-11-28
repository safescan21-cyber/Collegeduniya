'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, ExternalLink } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

type M = { scholarship_id: string; slug: string; name: string; provider: string | null; deadline: string | null; official_url: string; status: string };
const LABEL: Record<string, [string, string]> = { planning: ['Planning', 'bg-amber-50 text-amber-800'], applied: ['Applied', 'bg-sky-50 text-sky-700'], won: ['Won', 'bg-emerald-50 text-emerald-700'], not_selected: ['Not selected', 'bg-slate-100 text-slate-600'] };

// The scholarships a student is tracking, on top of /scholarships
export default function MyScholarships() {
  const { user } = useAuth();
  const [rows, setRows] = useState<M[] | null>(null);
  useEffect(() => {
    if (!user || (user as any).is_anonymous) return;
    supabaseBrowser().rpc('my_scholarships').then(({ data }: { data: M[] | null }) => setRows(data || []));
  }, [user]);
  if (!rows?.length) return null;
  const days = (d: string) => Math.ceil((Date.parse(`${d}T23:59:59+05:30`) - Date.now()) / 864e5);
  return (
    <section id="mine" className="card mb-6 scroll-mt-28 p-4">
      <p className="flex items-center gap-2 font-bold text-slate-900"><Bookmark size={17} className="text-brand-600" />My scholarships ({rows.length})</p>
      <ul className="mt-3 divide-y divide-slate-100">{rows.map((r) => { const [l, c] = LABEL[r.status] || LABEL.planning; const d = r.deadline ? days(r.deadline) : null; return (
        <li key={r.scholarship_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
          <Link href={`/scholarships/${r.slug}`} className="min-w-0 flex-1 font-semibold text-slate-900 hover:text-brand-700">{r.name}</Link>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{l}</span>
          {r.deadline && <span className={`text-xs ${d !== null && d >= 0 && d <= 7 && r.status === 'planning' ? 'font-semibold text-rose-700' : 'text-slate-500'}`}>
            {d !== null && d < 0 ? 'Closed' : d === 0 ? 'Closes today' : `Closes in ${d} day${d === 1 ? '' : 's'}`}</span>}
          {r.status === 'planning' && <a href={r.official_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">Apply<ExternalLink size={11} /></a>}
        </li>); })}</ul>
    </section>
  );
}
