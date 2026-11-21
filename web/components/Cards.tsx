import Link from 'next/link';
import { MapPin, Star, BadgeCheck, Clock, Building2, Wifi, Utensils, Briefcase, Home } from 'lucide-react';
import type { College, Hostel, Job } from '@/lib/types';
import { FALLBACK_IMG, range, timeAgo } from '@/lib/format';
import { SaveButton, CompareButton } from './ActionButtons';

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? 'fill-accent-400 text-accent-400' : 'text-slate-300'} />
      ))}
    </span>
  );
}

export function CollegeCard({ c, rating }: { c: Partial<College> & { slug: string; name: string }; rating?: { avg_rating: number; review_count: number } }) {
  return (
    <Link href={`/colleges/${c.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden bg-brand-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.cover_url || FALLBACK_IMG} alt={c.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        {c.ranking ? <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold text-brand-700">#{c.ranking} Rank</span> : null}
        {c.is_featured ? <span className="absolute right-3 top-3 rounded-lg bg-accent-500 px-2 py-1 text-[11px] font-bold text-slate-900" title="Chosen by Collegeolo; may include partner colleges">Featured</span> : null}
        {c.type ? <span className="absolute bottom-3 left-3 rounded-lg bg-brand-950/80 px-2 py-1 text-xs font-medium text-white">{c.type}</span> : null}
        {c.id && (
          <div className="absolute right-3 top-3 flex gap-1.5">
            <CompareButton item={{ id: c.id, slug: c.slug, name: c.name, city: c.city }} />
            <SaveButton type="college" id={c.id} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-bold text-slate-900 group-hover:text-brand-700">{c.name}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{c.city}, {c.country}</p>
        {c.streams && c.streams.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">{c.streams.slice(0, 3).map((s) => <span key={s} className="chip">{s}</span>)}</div>
        )}
        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <p className="text-xs text-slate-500">Fees / year</p>
            <p className="font-semibold text-slate-900">{range(c.fees_min ?? null, c.fees_max ?? null, c.currency)}</p>
          </div>
          {rating ? (
            <div className="text-right">
              <Stars value={rating.avg_rating} />
              <p className="text-xs text-slate-500">{rating.avg_rating} · {rating.review_count} reviews</p>
            </div>
          ) : <span className="text-xs text-slate-400">No reviews yet</span>}
        </div>
      </div>
    </Link>
  );
}

const amenityIcon = (a: string) => (/wi-?fi/i.test(a) ? <Wifi size={12} /> : /food|meal/i.test(a) ? <Utensils size={12} /> : null);

export function HostelCard({ h }: { h: Partial<Hostel> & { id: string; name: string }; }) {
  return (
    <Link href={`/hostels/${h.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={h.photos?.[0] || FALLBACK_IMG} alt={h.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold text-slate-800">{h.type} · {h.gender}</span>
        <div className="absolute right-3 top-3"><SaveButton type="hostel" id={h.id} /></div>
        {Array.isArray((h as any).hostel_rooms) && (h as any).hostel_rooms.length > 0 && (() => {
          const beds = (h as any).hostel_rooms.reduce((n: number, r: any) => n + (r.beds_available || 0), 0);
          return <span className={`absolute bottom-3 right-3 rounded-lg px-2 py-1 text-xs font-bold ${beds ? 'bg-emerald-500 text-white' : 'bg-slate-800/80 text-white'}`}>{beds ? `${beds} bed${beds > 1 ? 's' : ''} free` : 'Full'}</span>;
        })()}
        {'distance' in h && (h as any).distance != null && (
          <span className="absolute bottom-3 left-3 rounded-lg bg-brand-950/80 px-2 py-1 text-xs text-white">{(h as any).distance} km away</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="flex items-center gap-1 font-bold text-slate-900 group-hover:text-brand-700">
          {h.name}{h.is_verified && <BadgeCheck size={16} className="text-emerald-600" />}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{h.address ? `${h.address}, ` : ''}{h.city}</p>
        {h.colleges?.name && <p className="mt-1 text-xs text-brand-700">Near {h.colleges.name}</p>}
        <div className="mt-3 flex flex-wrap gap-1">
          {(h.amenities || []).slice(0, 4).map((a) => <span key={a} className="chip">{amenityIcon(a)}{a}</span>)}
        </div>
        <p className="mt-auto pt-4 font-semibold text-slate-900">
          {range(h.rent_min ?? null, h.rent_max ?? null, h.currency)}<span className="text-sm font-normal text-slate-500"> / {h.rent_period || 'month'}</span>
        </p>
      </div>
    </Link>
  );
}

export function JobCard({ j }: { j: Partial<Job> & { id: string; title: string; company: string } }) {
  return (
    <Link href={`/jobs/${j.id}`} className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          {j.company_logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={j.company_logo} alt="" className="h-full w-full rounded-xl object-cover" />
            : <Building2 size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900 group-hover:text-brand-700">{j.title}</h3>
          <p className="text-sm text-slate-500">{j.company}</p>
        </div>
        <SaveButton type="job" id={j.id} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="chip-brand"><Briefcase size={12} />{j.job_type}</span>
        <span className="chip"><MapPin size={12} />{j.is_remote ? 'Remote' : j.city}</span>
        {j.hours_per_week ? <span className="chip"><Clock size={12} />{j.hours_per_week} hrs/week</span> : null}
        {'distance' in j && (j as any).distance != null && <span className="chip-amber">{(j as any).distance} km</span>}
      </div>
      <div className="mt-auto flex items-end justify-between pt-4">
        <p className="font-semibold text-emerald-700">
          {range(j.pay_min ?? null, j.pay_max ?? null, j.currency)}<span className="text-sm font-normal text-slate-500"> / {j.pay_unit}</span>
        </p>
        {j.created_at && <span className="text-xs text-slate-400">{timeAgo(j.created_at)}</span>}
      </div>
    </Link>
  );
}

export function EmptyState({ title, text, icon = <Home size={28} /> }: { title: string; text?: string; icon?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</span>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
    </div>
  );
}
