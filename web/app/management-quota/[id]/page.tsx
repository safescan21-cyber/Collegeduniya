import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, CalendarDays, Users, Wallet, FileText, GraduationCap, ClipboardCheck, ShieldCheck, ArrowLeft, Languages, Award, Globe2 } from 'lucide-react';
import QuotaApplyForm from '@/components/QuotaApplyForm';
import QuotaSeatCard, { SeatStatus, seatIsOpen, daysLeft, fmtDate, perLabel } from '@/components/QuotaSeatCard';
import { ApproxFee } from '@/components/HomeCurrency';
import TranslateText from '@/components/TranslateText';
import { ShareButtons } from '@/components/ActionButtons';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n-server';
import { money, SITE_URL, FALLBACK_IMG } from '@/lib/format';
import type { QuotaSeat } from '@/lib/types';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts

async function getSeat(id: string) {
  if (!hasSupabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabasePublic().from('quota_seats_public').select('*').eq('id', id).maybeSingle();
  return data as QuotaSeat | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const s = await getSeat((await params).id);
  if (!s) return { title: 'Seat not found' };
  const route = s.country_code === 'IN' ? `${s.quota_type.toLowerCase()} quota` : s.quota_type.toLowerCase();
  return {
    title: `${s.course} — ${route} admission at ${s.college_short_name || s.college_name}, ${s.country}${s.intake ? ` (${s.intake})` : s.academic_year ? ` ${s.academic_year}` : ''}`,
    description: `${s.quota_type} admission for ${s.course} at ${s.college_name}, ${s.city}, ${s.country}. ${s.fee_per_year != null ? `Fee ${money(s.fee_per_year, s.currency)} ${s.fee_period === 'total' ? 'total' : `per ${s.fee_period}`}. ` : ''}${s.seats_available != null ? `${s.seats_available} seats left. ` : ''}Apply online free.`,
    openGraph: { images: s.cover_url ? [s.cover_url] : [] },
  };
}

export default async function SeatPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSeat((await params).id);
  if (!s) notFound();
  const { t, dict, lang } = await getT();
  const open = seatIsOpen(s);
  const left = daysLeft(s.last_date);
  const { data: moreRaw } = await supabasePublic().from('quota_seats_public').select('*').eq('college_id', s.college_id).neq('id', s.id).eq('status', 'open').limit(4);

  const more = ((moreRaw || []) as QuotaSeat[]).filter((m) => m.id !== s.id);
  const facts: [any, string, React.ReactNode][] = [
    [Wallet, `${t('quota.fee')} · ${perLabel(s, dict)}`, s.fee_per_year != null ? <>{money(s.fee_per_year, s.currency)} <ApproxFee amount={s.fee_per_year} currency={s.currency} className="block text-xs font-normal text-slate-500" /></> : t('quota.onRequest')],
    [Wallet, t('quota.totalFee'), s.total_fee != null ? <>{money(s.total_fee, s.currency)} <ApproxFee amount={s.total_fee} currency={s.currency} className="block text-xs font-normal text-slate-500" /></> : '—'],
    [Users, t('quota.seatsLeft'), s.seats_available != null ? `${s.seats_available}${s.seats_total ? ` / ${s.seats_total}` : ''}` : '—'],
    [CalendarDays, t('quota.lastDate'), s.last_date ? `${fmtDate(s.last_date, lang, true)}${left != null && left >= 0 ? ` (${left} ${t('quota.days')})` : ''}` : t('quota.rolling')],
    ...(s.intake ? [[CalendarDays, t('quota.intake'), s.intake] as [any, string, React.ReactNode]] : []),
  ];
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'EducationalOccupationalProgram', name: s.course,
    provider: { '@type': 'CollegeOrUniversity', name: s.college_name, address: { '@type': 'PostalAddress', addressLocality: s.city, addressRegion: s.state, addressCountry: s.country_code || s.country } },
    ...(s.fee_per_year != null ? { offers: { '@type': 'Offer', category: s.quota_type, price: s.fee_per_year, priceCurrency: s.currency } } : {}),
    ...(s.last_date ? { applicationDeadline: String(s.last_date).slice(0, 10) } : {}),
    ...(s.intake ? { startDate: s.intake } : {}),
    url: `${SITE_URL}/management-quota/${s.id}`,
  };

  return (
    <div className="container-x py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href={`/management-quota${s.country_code ? `?country=${s.country_code}` : ''}`} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} />{t('quota.back')} · {s.country}</Link>
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
                <SeatStatus s={s} d={dict} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip">{s.quota_type}</span>{s.level && <span className="chip">{s.level}</span>}
                {s.academic_year && <span className="chip">{s.academic_year}</span>}{s.accreditation && <span className="chip">{s.accreditation}</span>}
                {s.open_to !== 'all' && <span className={s.open_to === 'international' ? 'chip-green' : 'chip-amber'}><Globe2 size={11} />{t(`quota.openTo.${s.open_to}` as any)}</span>}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {facts.map(([Icon, label, value]) => (
                  <div key={label} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <Icon size={18} className="mt-0.5 text-brand-600" />
                    <div><p className="text-xs text-slate-500">{label}</p><div className="font-semibold text-slate-900">{value}</div></div>
                  </div>
                ))}
              </div>
              {s.fee_note && <div className="mt-3 text-sm text-slate-600"><b>{t('quota.feeDetails')}:</b> <TranslateText as="span" text={s.fee_note} /></div>}
            </div>
          </div>

          {(s.eligibility || s.min_percentage || s.exams_accepted?.length) && (
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><GraduationCap size={18} />{t('quota.eligibility')}</h2>
              {s.eligibility && <TranslateText text={s.eligibility} className="mt-2 whitespace-pre-line text-slate-600" />}
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {s.min_percentage != null && <li>{t('quota.minMarks')}: <b>{s.min_percentage}%</b></li>}
                {!!s.exams_accepted?.length && <li>{t('quota.exams')}: <b>{s.exams_accepted.join(', ')}</b></li>}
              </ul>
            </section>
          )}

          {s.english_requirement && (
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Languages size={18} />{t('quota.english')}</h2>
              <TranslateText text={s.english_requirement} className="mt-2 text-slate-600" />
            </section>
          )}

          {s.scholarship_note && (
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Award size={18} />{t('quota.scholarship')}</h2>
              <TranslateText text={s.scholarship_note} className="mt-2 whitespace-pre-line text-slate-600" />
            </section>
          )}

          {!!s.documents_required?.length && (
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FileText size={18} />{t('quota.documents')}</h2>
              <ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">{s.documents_required.map((d) => <li key={d} className="flex items-center gap-2"><ClipboardCheck size={14} className="text-emerald-600" />{d}</li>)}</ul>
            </section>
          )}

          {s.description && <section className="card p-6"><h2 className="text-lg font-bold text-slate-900">{t('quota.about')}</h2><TranslateText text={s.description} className="mt-2 whitespace-pre-line text-slate-600" /></section>}

          <section className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">{t('quota.how')}</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-600">
              {(['quota.how1', 'quota.how2', 'quota.how3', 'quota.how4'] as const).map((k, i) => <li key={k}><b>{i + 1}.</b> {t(k)}</li>)}
            </ol>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900"><ShieldCheck size={16} className="shrink-0" />{t('quota.report')}</p>
          </section>

          {!!more?.length && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-slate-900">{t('quota.more')} {s.college_short_name || s.college_name}</h2>
              <div className="grid gap-4 md:grid-cols-2">{more.map((m) => <QuotaSeatCard key={m.id} s={m} showCollege={false} d={dict} lang={lang} />)}</div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <QuotaApplyForm seatId={s.id} course={s.course} college={s.college_name} open={open} documents={s.documents_required || []}
            minPercentage={s.min_percentage} countryCode={s.country_code} openTo={s.open_to} />
          <ShareButtons title={`${s.course} — ${s.quota_type} · ${s.college_name}, ${s.country}`} path={`/management-quota/${s.id}`} />
        </aside>
      </div>
    </div>
  );
}
