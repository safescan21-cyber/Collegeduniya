'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Users, UserPlus, GraduationCap, Home, Briefcase, Star, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type Stats = {
  totals: Record<string, number>;
  visits: { today: number; last7: number; last30: number; allTime: number; uniqueToday: number; unique30: number };
  daily: { date: string; visits: number; visitors: number }[];
  topPages: { path: string; views: number }[];
};

function Tile({ icon: Icon, label, value, sub, href }: { icon: any; label: string; value: number | string; sub?: string; href?: string }) {
  const inner = (
    <div className="card h-full p-5">
      <div className="flex items-center justify-between text-slate-500"><span className="text-xs font-semibold uppercase">{label}</span><Icon size={18} /></div>
      <p className="mt-2 text-3xl font-extrabold text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block transition hover:-translate-y-0.5">{inner}</Link> : inner;
}

function VisitsChart({ daily }: { daily: Stats['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.visits));
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Visits — last 30 days</h3>
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />Page views</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-accent-400" />Unique visitors</span>
        </div>
      </div>
      <div className="flex h-48 items-end gap-1">
        {daily.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end justify-center gap-px">
            <div className="w-1/2 rounded-t bg-brand-500" style={{ height: `${(d.visits / max) * 100}%` }} />
            <div className="w-1/2 rounded-t bg-accent-400" style={{ height: `${(d.visitors / max) * 100}%` }} />
            <div className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
              {d.date}: {d.visits} views · {d.visitors} visitors
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400"><span>{daily[0]?.date}</span><span>{daily[daily.length - 1]?.date}</span></div>
    </div>
  );
}

export default function AdminHome() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<Stats>('/api/admin/stats').then(setS).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="card p-6 text-rose-600">Could not load stats: {err}<p className="mt-2 text-sm text-slate-500">Is the Node API running at NEXT_PUBLIC_API_URL?</p></div>;
  if (!s) return <div className="card grid h-64 place-items-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={Eye} label="Visitors today" value={s.visits.uniqueToday} sub={`${s.visits.today} page views`} />
        <Tile icon={Users} label="Visitors (30 days)" value={s.visits.unique30} sub={`${s.visits.last30} views · ${s.visits.last7} in 7 days`} />
        <Tile icon={Eye} label="All-time page views" value={s.visits.allTime} />
        <Tile icon={UserPlus} label="Registered students" value={s.totals.users} sub={`+${s.totals.signups7} this week`} href="/admin/users" />
      </div>
      <VisitsChart daily={s.daily} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Tile icon={GraduationCap} label="Colleges" value={s.totals.colleges} href="/admin/colleges" />
        <Tile icon={Home} label="PG & Hostels" value={s.totals.hostels} href="/admin/hostels" />
        <Tile icon={Briefcase} label="Jobs" value={s.totals.jobs} sub={`${s.totals.openJobs} open`} href="/admin/jobs" />
        <Tile icon={FileText} label="Applications" value={s.totals.applications} sub={`${s.totals.pendingApps} pending`} href="/admin/applications" />
        <Tile icon={Star} label="Reviews" value={s.totals.reviews} sub={`${s.totals.pendingReviews} pending`} href="/admin/reviews" />
      </div>
      <div className="card p-5">
        <h3 className="mb-3 font-semibold text-slate-900">Top pages (30 days)</h3>
        {s.topPages.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {s.topPages.map((p) => (
              <li key={p.path} className="flex justify-between py-2"><a href={p.path} target="_blank" className="truncate text-brand-700 hover:underline">{p.path}</a><span className="font-semibold">{p.views}</span></li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-400">No visits recorded yet.</p>}
      </div>
    </div>
  );
}
