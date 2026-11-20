import Link from 'next/link';
import { CalendarDays, Users, MapPin, Wallet, Globe2 } from 'lucide-react';
import { ApproxFee } from '@/components/HomeCurrency';
import { money } from '@/lib/format';
import { EN, type Dict } from '@/lib/i18n';
import type { QuotaSeat } from '@/lib/types';

export function daysLeft(d: string | null) {
  if (!d) return null;
  const end = new Date(`${String(d).slice(0, 10)}T23:59:59`).getTime();
  return Number.isFinite(end) ? Math.ceil((end - Date.now()) / 864e5) : null;
}

export const fmtDate = (d: string, lang = 'en', long = false) => {
  try { return new Date(String(d).slice(0, 10)).toLocaleDateString(lang, long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' }); }
  catch { return String(d).slice(0, 10); }
};

export function SeatStatus({ s, d = EN }: { s: Pick<QuotaSeat, 'status' | 'seats_available' | 'last_date'>; d?: Dict }) {
  const left = daysLeft(s.last_date);
  if (s.status === 'filled' || s.seats_available === 0) return <span className="chip-red">{d['quota.filled']}</span>;
  if (s.status === 'closed' || (left != null && left < 0)) return <span className="chip">{d['quota.closed']}</span>;
  if (left != null && left <= 7) return <span className="chip-amber whitespace-nowrap">{d['quota.closesIn']} {left} {d['quota.days']}</span>;
  return <span className="chip-green">{d['quota.open']}</span>;
}

export const seatIsOpen = (s: Pick<QuotaSeat, 'status' | 'seats_available' | 'last_date'>) =>
  s.status === 'open' && s.seats_available !== 0 && (daysLeft(s.last_date) ?? 1) >= 0;

export const perLabel = (s: Pick<QuotaSeat, 'fee_period'>, d: Dict = EN) => d[`quota.per.${s.fee_period || 'year'}` as keyof Dict] || '';

export default function QuotaSeatCard({ s, showCollege = true, d = EN, lang = 'en' }: { s: QuotaSeat; showCollege?: boolean; d?: Dict; lang?: string }) {
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
            {showCollege && <p className="flex items-center gap-1 text-xs text-slate-400"><MapPin size={12} />{[s.city, s.state, s.country].filter(Boolean).join(', ')}</p>}
          </div>
        </div>
        <SeatStatus s={s} d={d} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="chip">{s.quota_type}</span>
        {s.level && <span className="chip">{s.level}</span>}
        {(s.intake || s.academic_year) && <span className="chip">{s.intake || s.academic_year}</span>}
        {s.open_to === 'international' && <span className="chip-green"><Globe2 size={11} />{d['quota.openTo.international']}</span>}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-sm">
        <div>
          <p className="flex items-center gap-1 text-xs text-slate-400"><Wallet size={12} />{d['quota.fee']} · {perLabel(s, d)}</p>
          <p className="font-semibold text-slate-900">{s.fee_per_year != null ? money(s.fee_per_year, s.currency) : d['quota.onRequest']}</p>
          <ApproxFee amount={s.fee_per_year} currency={s.currency} />
        </div>
        <div><p className="flex items-center gap-1 text-xs text-slate-400"><Users size={12} />{d['quota.seatsLeft']}</p><p className="font-semibold text-slate-900">{s.seats_available ?? '—'}{s.seats_total ? <span className="font-normal text-slate-400"> / {s.seats_total}</span> : null}</p></div>
        <div><p className="flex items-center gap-1 text-xs text-slate-400"><CalendarDays size={12} />{d['quota.lastDate']}</p><p className="font-semibold text-slate-900">{s.last_date ? fmtDate(s.last_date, lang) : d['quota.rolling']}</p></div>
      </div>
    </Link>
  );
}
