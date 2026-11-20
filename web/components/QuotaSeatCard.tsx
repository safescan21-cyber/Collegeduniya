import Link from 'next/link';
import { CalendarDays, Users, MapPin, BadgeIndianRupee } from 'lucide-react';
import { money } from '@/lib/format';
import type { QuotaSeat } from '@/lib/types';

export function daysLeft(d: string | null) {
  if (!d) return null;
  const end = new Date(`${String(d).slice(0, 10)}T23:59:59`).getTime();
  return Number.isFinite(end) ? Math.ceil((end - Date.now()) / 864e5) : null;
}

export function SeatStatus({ s }: { s: Pick<QuotaSeat, 'status' | 'seats_available' | 'last_date'> }) {
  const left = daysLeft(s.last_date);
  if (s.status === 'filled' || s.seats_available === 0) return <span className="chip-red">Seats filled</span>;
  if (s.status === 'closed' || (left != null && left < 0)) return <span className="chip">Closed</span>;
  if (left != null && left <= 7) return <span className="chip-amber">Closes in {left} day{left === 1 ? '' : 's'}</span>;
  return <span className="chip-green">Open</span>;
}

export const seatIsOpen = (s: Pick<QuotaSeat, 'status' | 'seats_available' | 'last_date'>) =>
  s.status === 'open' && s.seats_available !== 0 && (daysLeft(s.last_date) ?? 1) >= 0;

export default function QuotaSeatCard({ s, showCollege = true }: { s: QuotaSeat; showCollege?: boolean }) {
  return (
    <Link href={`/management-quota/${s.id}`} className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {showCollege && (s.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={s.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-lg border bg-white object-contain p-0.5" />
            : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 font-bold text-brand-700">{(s.college_short_name || s.college_name)[0]}</span>)}
          <div className="min-w-0">
            <p className="font-bold text-slate-900 group-hover:text-brand-700">{s.course}</p>
            {showCollege && <p className="truncate text-sm text-slate-600">{s.college_name}</p>}
            {showCollege && <p className="flex items-center gap-1 text-xs text-slate-400"><MapPin size={12} />{[s.city, s.state].filter(Boolean).join(', ')}</p>}
          </div>
        </div>
        <SeatStatus s={s} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="chip">{s.quota_type} quota</span>
        {s.level && <span className="chip">{s.level}</span>}
        {s.academic_year && <span className="chip">{s.academic_year}</span>}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-sm">
        <div><p className="flex items-center gap-1 text-xs text-slate-400"><BadgeIndianRupee size={12} />Fee / year</p><p className="font-semibold text-slate-900">{s.fee_per_year != null ? money(s.fee_per_year, s.currency) : 'On request'}</p></div>
        <div><p className="flex items-center gap-1 text-xs text-slate-400"><Users size={12} />Seats left</p><p className="font-semibold text-slate-900">{s.seats_available ?? '—'}{s.seats_total ? <span className="font-normal text-slate-400"> / {s.seats_total}</span> : null}</p></div>
        <div><p className="flex items-center gap-1 text-xs text-slate-400"><CalendarDays size={12} />Last date</p><p className="font-semibold text-slate-900">{s.last_date ? new Date(String(s.last_date).slice(0, 10)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Rolling'}</p></div>
      </div>
    </Link>
  );
}
