import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, CalendarDays, Users, BadgeIndianRupee, FileText, GraduationCap, ClipboardCheck, ShieldCheck, ArrowLeft } from 'lucide-react';
import QuotaApplyForm from '@/components/QuotaApplyForm';
import QuotaSeatCard, { SeatStatus, seatIsOpen, daysLeft } from '@/components/QuotaSeatCard';
import { ShareButtons } from '@/components/ActionButtons';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { money, SITE_URL, FALLBACK_IMG } from '@/lib/format';
import type { QuotaSeat } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getSeat(id: string) {
  if (!hasSupabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabasePublic().from('quota_seats_public').select('*').eq('id', id).maybeSingle();
  return data as QuotaSeat | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const s = await getSeat((await params).id);
  if (!s) return { title: 'Seat not found' };
  return {
    title: `${s.course} ${s.quota_type.toLowerCase()} quota at ${s.college_short_name || s.college_name}${s.academic_year ? ` ${s.academic_year}` : ''}`,
    description: `${s.quota_type} quota admission for ${s.course} at ${s.college_name}, ${s.city}. ${s.fee_per_year != null ? `Fee ${money(s.fee_per_year, s.currency)}/year. ` : ''}${s.seats_available != null ? `${s.seats_available} seats left. ` : ''}Apply online free.`,
    openGraph: { images: s.cover_url ? [s.cover_url] : [] },
  };
}

export default async function SeatPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSeat((await params).id);
  if (!s) notFound();
  const open = seatIsOpen(s);
  const left = daysLeft(s.last_date);
  const { data: more } = await supabasePublic().from('quota_seats_public').select('*').eq('college_id', s.college_id).neq('id', s.id).eq('status', 'open').limit(4);

  const facts: [any, string, string][] = [
    [BadgeIndianRupee, 'Fee per year', s.fee_per_year != null ? money(s.fee_per_year, s.currency) : 'On request'],
    [BadgeIndianRupee, 'Total course fee', s.total_fee != null ? money(s.total_fee, s.currency) : '—'],
    [Users, 'Seats left', s.seats_available != null ? `${s.seats_available}${s.seats_total ? ` of ${s.seats_total}` : ''}` : '—'],
    [CalendarDays, 'Last date', s.last_date ? `${new Date(s.last_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}${left != null && left >= 0 ? ` (${left} days left)` : ''}` : 'Rolling admission'],
  ];
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'EducationalOccupationalProgram', name: s.course,
    provider: { '@type': 'CollegeOrUniversity', name: s.college_name, address: { '@type': 'PostalAddress', addressLocality: s.city, addressRegion: s.state, addressCountry: s.country } },
    ...(s.fee_per_year != null ? { offers: { '@type': 'Offer', category: `${s.quota_type} quota`, price: s.fee_per_year, priceCurrency: s.currency } } : {}),
    ...(s.last_date ? { applicationDeadline: s.last_date } : {}),
    url: `${SITE_URL}/management-quota/${s.id}`,
  };

  return (
    <div className="container-x py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/management-quota" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} />All management quota seats</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="relative h-40 bg-brand-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.cover_url || FALLBACK_IMG} alt="" className="h-full w-full object-cover opacity-40" />
              <div className="absolute inset-0 flex items-end gap-4 p-5">
                {s.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo_url} alt="" className="h-16 w-16 rounded-xl border-2 border-white bg-white object-contain" />
                )}
                <div className="text-white">
                  <Link href={`/colleges/${s.college_slug}`} className="text-lg font-bold hover:underline">{s.college_name}</Link>
                  <p className="flex items-center gap-1 text-sm text-white/80"><MapPin size={14} />{[s.city, s.state, s.country].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-2xl font-extrabold text-slate-900">{s.course}</h1>
                <SeatStatus s={s} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip">{s.quota_type} quota</span>{s.level && <span className="chip">{s.level}</span>}
                {s.academic_year && <span className="chip">Session {s.academic_year}</span>}{s.accreditation && <span className="chip">{s.accreditation}</span>}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {facts.map(([Icon, label, value]) => (
                  <div key={label} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <Icon size={18} className="mt-0.5 text-brand-600" />
                    <div><p className="text-xs text-slate-500">{label}</p><p className="font-semibold text-slate-900">{value}</p></div>
                  </div>
                ))}
              </div>
              {s.fee_note && <p className="mt-3 text-sm text-slate-600"><b>Fee details:</b> {s.fee_note}</p>}
            </div>
          </div>

          {(s.eligibility || s.min_percentage || s.exams_accepted?.length) && (
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><GraduationCap size={18} />Eligibility</h2>
              {s.eligibility && <p className="mt-2 whitespace-pre-line text-slate-600">{s.eligibility}</p>}
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {s.min_percentage != null && <li>Minimum marks: <b>{s.min_percentage}%</b></li>}
                {!!s.exams_accepted?.length && <li>Exams accepted: <b>{s.exams_accepted.join(', ')}</b></li>}
              </ul>
            </section>
          )}

          {!!s.documents_required?.length && (
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FileText size={18} />Documents needed</h2>
              <ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">{s.documents_required.map((d) => <li key={d} className="flex items-center gap-2"><ClipboardCheck size={14} className="text-emerald-600" />{d}</li>)}</ul>
            </section>
          )}

          {s.description && <section className="card p-6"><h2 className="text-lg font-bold text-slate-900">About this admission</h2><p className="mt-2 whitespace-pre-line text-slate-600">{s.description}</p></section>}

          <section className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">How it works</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-600">
              <li><b>1.</b> Submit the form with your marks and documents. It&apos;s free.</li>
              <li><b>2.</b> Our admissions team checks eligibility and calls you within 2 working days.</li>
              <li><b>3.</b> Shortlisted students get the college&apos;s official offer and fee schedule.</li>
              <li><b>4.</b> You pay fees directly to the college, against an official receipt, and confirm your seat.</li>
            </ol>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900"><ShieldCheck size={16} className="shrink-0" />StudyEarnstay never collects admission fees and never asks for donation or capitation money. Report anyone who does to hello@studyearnstay.com.</p>
          </section>

          {!!more?.length && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-slate-900">More quota seats at {s.college_short_name || s.college_name}</h2>
              <div className="grid gap-4 md:grid-cols-2">{(more as QuotaSeat[]).map((m) => <QuotaSeatCard key={m.id} s={m} showCollege={false} />)}</div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <QuotaApplyForm seatId={s.id} course={s.course} college={s.college_name} open={open} documents={s.documents_required || []} minPercentage={s.min_percentage} />
          <ShareButtons title={`${s.course} — ${s.quota_type} quota at ${s.college_name}`} path={`/management-quota/${s.id}`} />
        </aside>
      </div>
    </div>
  );
}
