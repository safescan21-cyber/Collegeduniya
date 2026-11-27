'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { api } from '@/lib/api';

// When no state is chosen: offer the visitor's own state (approximate, from their network) plus the full state list.
export default function MyStateLink({ states, country, hrefFor }: { states: string[]; country: string; hrefFor: Record<string, string> }) {
  const [mine, setMine] = useState<string | null>(null);
  useEffect(() => {
    api('/api/geo/me').then((g: any) => {
      if (!g?.region || (g.country && g.country !== country)) return;
      const hit = states.find((s) => s.toLowerCase() === String(g.region).toLowerCase());
      if (hit) setMine(hit);
    }).catch(() => {});
  }, [states, country]);
  return (
    <div className="card p-4">
      {mine ? (
        <Link href={hrefFor[mine]} className="btn-primary mb-3 inline-flex items-center gap-1.5"><MapPin size={14} /> Show {mine}</Link>
      ) : null}
      <p className="mb-2 text-sm text-slate-500">Pick a state to see its list:</p>
      <div className="flex flex-wrap gap-1.5">
        {states.map((s) => <Link key={s} href={hrefFor[s]} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:border-brand-400 hover:text-brand-700">{s}</Link>)}
      </div>
    </div>
  );
}
