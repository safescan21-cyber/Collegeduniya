'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio, MapPin, Monitor } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

export default function OnlineNow({ full = false }: { full?: boolean }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    const load = () => api('/api/admin/online').then(setD).catch(() => undefined);
    load(); const t = setInterval(load, 15000); return () => clearInterval(t);
  }, []);
  if (!d) return <div className="card h-28 animate-pulse" />;
  const list = full ? d.list : d.list.slice(0, 6);
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-bold text-slate-900"><span className="relative flex h-2.5 w-2.5"><span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>Online now</p>
        <p className="text-xs text-slate-400">updates every 15 s · {d.sessions_24h.toLocaleString()} sessions in 24 h</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-6">
        <div><p className="text-3xl font-extrabold text-slate-900">{d.online}</p><p className="text-xs text-slate-500">people online</p></div>
        <div><p className="text-3xl font-extrabold text-brand-700">{d.users}</p><p className="text-xs text-slate-500">logged-in students</p></div>
        <div><p className="text-3xl font-extrabold text-slate-500">{d.guests}</p><p className="text-xs text-slate-500">guests</p></div>
        {d.cities.length > 0 && <div className="min-w-40 text-xs text-slate-600"><p className="mb-1 font-semibold text-slate-500">Top cities</p>{d.cities.slice(0, 4).map(([c, n]: [string, number]) => <p key={c}>{c} · {n}</p>)}</div>}
        {d.pages.length > 0 && <div className="min-w-40 text-xs text-slate-600"><p className="mb-1 font-semibold text-slate-500">Top pages</p>{d.pages.slice(0, 4).map(([p, n]: [string, number]) => <p key={p} className="truncate">{p} · {n}</p>)}</div>}
      </div>
      {list.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm"><tbody>{list.map((r: any) => (
            <tr key={r.session_id} className="border-t border-slate-100">
              <td className="py-1.5 pe-3">{r.profiles ? <><p className="font-medium">{r.profiles.full_name || r.profiles.email}</p><p className="text-xs text-slate-400">{r.profiles.email}{r.profiles.account_type && r.profiles.account_type !== 'student' ? ` · ${r.profiles.account_type}` : ''}</p></> : <span className="text-slate-400">Guest</span>}</td>
              <td className="py-1.5 pe-3 text-xs">{r.city || r.country ? <span className="flex items-center gap-1"><MapPin size={11} />{[r.city, r.region, r.country].filter(Boolean).join(', ')}</span> : '—'}</td>
              <td className="py-1.5 pe-3 text-xs text-slate-500"><span className="flex items-center gap-1"><Monitor size={11} />{r.device}</span></td>
              <td className="max-w-48 truncate py-1.5 pe-3 text-xs"><code>{r.path}</code></td>
              <td className="py-1.5 text-right text-xs text-slate-400">on for {timeAgo(r.first_seen).replace(' ago', '')}</td>
            </tr>))}</tbody></table>
        </div>
      )}
      {!full && d.list.length > 6 && <Link href="/admin/online" className="mt-2 inline-flex items-center gap-1 text-sm text-brand-700 underline"><Radio size={13} />See all {d.list.length}</Link>}
      {d.online > 0 && !d.list.some((r: any) => r.city) && <p className="mt-3 text-xs text-amber-700">No locations yet — turn on Cloudflare “Add visitor location headers” (or Nginx GeoIP2) to see cities.</p>}
    </section>
  );
}
