import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import QuotaSeatCard from '@/components/QuotaSeatCard';
import { CurrencyPicker } from '@/components/HomeCurrency';
import { EmptyState } from '@/components/Cards';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm } from '@/lib/data';
import { getT } from '@/lib/i18n-server';
import type { QuotaSeat } from '@/lib/types';

export const dynamic = 'force-dynamic';
const PER_PAGE = 18;
type SP = Record<string, string | undefined>;
const QUOTAS = ['Management', 'NRI', 'NRI Sponsored', 'Institutional', 'Foreign National', 'International', 'Direct admission', 'Self-financed', 'Private / fee-paying', 'Scholarship'];
const CONTINENTS = [{ value: 'AS', label: 'Asia' }, { value: 'EU', label: 'Europe' }, { value: 'NA', label: 'North America' }, { value: 'SA', label: 'South America' }, { value: 'AF', label: 'Africa' }, { value: 'OC', label: 'Oceania' }];

async function countryList() {
  if (!hasSupabase) return [] as { country_code: string; country: string; seats: number }[];
  const { data } = await supabasePublic().rpc('quota_countries');
  return (data || []) as { country_code: string; country: string; seats: number }[];
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const countries = await countryList();
  const cname = countries.find((c) => c.country_code === sp.country?.toUpperCase())?.country;
  const where = sp.city || sp.state || cname;
  const isIndia = sp.country?.toUpperCase() === 'IN';
  return {
    title: where
      ? `${isIndia ? 'Management quota' : 'Direct admission'} ${new Date().getFullYear()} in ${where} — seats, fees & deadlines`
      : `Direct admission & management quota seats worldwide — official fees & deadlines`,
    description: `Open ${isIndia ? 'management and NRI quota' : 'direct-admission, international and management quota'} seats${where ? ` in ${where}` : ' in every country'}: official fee, seats left, eligibility and last date. Apply online free through StudyEarnstay.`,
    alternates: { canonical: `/management-quota${sp.country ? `?country=${sp.country.toUpperCase()}` : ''}` },
  };
}

export default async function ManagementQuotaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { t, dict, lang } = await getT();
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  let seats: QuotaSeat[] = [];
  let total = 0;
  let regions: string[] = [];
  const countries = await countryList();
  const cc = sp.country?.toUpperCase();

  if (hasSupabase) {
    const db = supabasePublic();
    let q = db.from('quota_seats_public').select('*', { count: 'exact' });
    const term = cleanTerm(sp.q);
    if (term) q = q.or(`course.ilike.%${term}%,college_name.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`);
    if (cc) q = q.eq('country_code', cc);
    if (sp.continent) q = q.eq('continent', sp.continent);
    if (sp.level) q = q.eq('level', sp.level);
    if (sp.quota) q = q.eq('quota_type', sp.quota);
    if (sp.state) q = q.eq('state', sp.state);
    if (sp.city) q = q.ilike('city', cleanTerm(sp.city));
    if (sp.intl === 'yes') q = q.neq('open_to', 'domestic');
    if (sp.open !== 'all') q = q.eq('status', 'open');
    q = sp.sort === 'fee' ? q.order('fee_per_year', { ascending: true, nullsFirst: false })
      : sp.sort === 'deadline' ? q.order('last_date', { ascending: true, nullsFirst: false })
      : q.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
    const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    seats = (data || []) as QuotaSeat[];
    total = count || 0;
    if (cc) {
      const { data: st } = await db.from('quota_seats_public').select('state').eq('country_code', cc).limit(2000);
      regions = Array.from(new Set((st || []).map((r: any) => r.state).filter(Boolean))).sort() as string[];
    }
  }
  const cname = countries.find((c) => c.country_code === cc)?.country;
  const where = sp.city || sp.state || cname;
  const chip = (code: string | null, label: string, n?: number) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !['country', 'state', 'page'].includes(k)) as [string, string][]);
    if (code) p.set('country', code);
    const active = (code || '') === (cc || '');
    return (
      <Link key={code || 'all'} href={`/management-quota${p.toString() ? `?${p}` : ''}`}
        className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'}`}>
        {label}{n != null && <span className={active ? 'text-white/70' : 'text-slate-400'}> {n}</span>}
      </Link>
    );
  };

  return (
    <div className="container-x py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{where ? t('quota.titleIn').replace('{place}', where) : t('quota.titleWorld')}</h1>
          <p className="mt-1 text-slate-500">{total.toLocaleString(lang)} {t('quota.listings')} · {t('quota.subtitle')}</p>
        </div>
        <CurrencyPicker label={t('quota.yourCurrency')} />
      </div>
      {countries.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {chip(null, t('quota.allCountries'))}
          {countries.slice(0, 30).map((c) => chip(c.country_code, c.country, Number(c.seats)))}
        </div>
      )}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <ShieldCheck className="mt-0.5 shrink-0" size={18} />
        <p>{t('quota.safe')}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <FilterBar action="/management-quota" values={sp} fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'Course, college or country' },
            { name: 'country', label: 'Country', type: 'select', options: countries.map((c) => ({ value: c.country_code, label: c.country })) },
            { name: 'continent', label: 'Continent', type: 'select', options: CONTINENTS },
            ...(regions.length ? [{ name: 'state', label: 'State / region', type: 'select' as const, options: regions }] : []),
            { name: 'city', label: 'City', type: 'city', placeholder: 'Any city' },
            { name: 'level', label: 'Level', type: 'select', options: ['Foundation', 'UG', 'PG', 'Diploma', 'PhD', 'Certificate', 'Language'] },
            { name: 'quota', label: 'Admission route', type: 'select', options: QUOTAS },
            { name: 'intl', label: 'Applicant', type: 'select', options: [{ value: 'yes', label: 'Open to international students' }] },
            { name: 'open', label: 'Show', type: 'select', options: [{ value: 'all', label: 'Open and closed' }] },
            { name: 'sort', label: 'Sort by', type: 'select', options: [{ value: 'fee', label: 'Lowest fee' }, { value: 'deadline', label: 'Closing soon' }] },
          ]} />
        </aside>
        <section>
          {seats.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{seats.map((s) => <QuotaSeatCard key={s.id} s={s} d={dict} lang={lang} />)}</div>
          ) : (
            <EmptyState icon={<GraduationCap size={28} />} title={t('quota.none')} text={t('quota.noneText')} />
          )}
          <Pagination page={page} total={total} perPage={PER_PAGE} basePath="/management-quota" params={sp} />
          <p className="mt-8 text-center text-sm text-slate-500">{t('quota.cantFind')} <Link href="/counselling" className="font-semibold text-brand-700 underline">{t('quota.counselling')}</Link></p>
        </section>
      </div>
    </div>
  );
}
