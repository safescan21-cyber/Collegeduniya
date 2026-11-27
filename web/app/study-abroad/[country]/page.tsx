import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, GraduationCap, Wallet, CalendarDays, Lightbulb, School } from 'lucide-react';
import VisaNews from '@/components/abroad/VisaNews';
import EnquiryForm from '@/components/EnquiryForm';
import { GUIDES, CHECKED, type Guide, type Step } from '@/lib/admissionGuides';
import { money } from '@/lib/format';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

const bySlug = (slug: string): Guide | null => Object.values(GUIDES).find((g) => g.slug === slug) || null;
export const generateStaticParams = () => Object.values(GUIDES).map((g) => ({ country: g.slug }));

export async function generateMetadata({ params }: { params: Promise<{ country: string }> }): Promise<Metadata> {
  const g = bySlug((await params).country);
  if (!g) return { title: 'Not found' };
  const year = new Date().getFullYear() + 1;
  return {
    title: `Study in ${g.country} from India ${year}: admission, fees, visa & top universities`,
    description: `How Indian students get admission to universities in ${g.country}: step-by-step for bachelor’s and master’s, tuition and visa costs from official sources, intakes, and top universities with fees.`,
    alternates: { canonical: `/study-abroad/${g.slug}` },
  };
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
          <div><p className="font-semibold text-slate-900">{s.title}</p><p className="text-slate-600">{s.text}</p>
            {s.link && <a href={s.link.href} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">{s.link.label}<ExternalLink size={12} /></a>}</div>
        </li>
      ))}
    </ol>
  );
}

export default async function CountryGuidePage({ params }: { params: Promise<{ country: string }> }) {
  const g = bySlug((await params).country);
  if (!g) notFound();
  let top: any[] = [];
  if (hasSupabase) {
    const { data } = await supabasePublic().rpc('world_top_table', { p_country: g.country, p_lim: 25 });
    top = (data || []) as any[];
  }
  const faq = [
    { q: `Can Indian students study in ${g.country} after Class 12?`, a: g.ugSteps[0].text },
    { q: `How much does it cost to study in ${g.country}?`, a: g.costs.map((c) => `${c.item}: ${c.amount}${c.note ? ` (${c.note})` : ''}`).join(' ') },
    { q: `When are the intakes in ${g.country}?`, a: g.intakes },
  ];
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };

  return (
    <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="min-w-0 space-y-6">
        <div>
          <Link href="/study-abroad/visa" className="text-sm text-slate-500 hover:underline">← Study abroad</Link>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{g.flag} Study in {g.country} from India</h1>
          <p className="mt-2 text-slate-600">{g.intro}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {Object.values(GUIDES).filter((x) => x.slug !== g.slug).map((x) => <Link key={x.slug} href={`/study-abroad/${x.slug}`} className="chip hover:bg-brand-50">{x.flag} {x.country} guide</Link>)}
            <Link href="/study-abroad/visa" className="chip hover:bg-brand-50">Student visa news</Link>
            <Link href="/study-abroad/calculator" className="chip hover:bg-brand-50">Cost calculator</Link>
          </div>
        </div>

        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900"><GraduationCap size={20} className="text-brand-600" />Bachelor’s: how to get admission</h2>
          <Steps steps={g.ugSteps} />
        </section>

        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900"><GraduationCap size={20} className="text-brand-600" />Master’s and PhD</h2>
          <Steps steps={g.pgSteps} />
        </section>

        <section className="card overflow-hidden">
          <h2 className="flex items-center gap-2 p-6 pb-3 text-xl font-bold text-slate-900"><Wallet size={20} className="text-brand-600" />Fees and costs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">What</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Source</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{g.costs.map((c) => (
                <tr key={c.item}><td className="px-4 py-3"><p className="font-medium text-slate-900">{c.item}</p>{c.note && <p className="text-xs text-slate-500">{c.note}</p>}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{c.amount}</td>
                  <td className="px-4 py-3"><a href={c.source.href} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-brand-700 hover:underline">{c.source.label}<ExternalLink size={11} /></a></td></tr>))}</tbody>
            </table>
          </div>
          <p className="p-4 text-xs text-slate-400">Checked {CHECKED}. Fees and visa rules change — confirm on the official pages before paying anything.</p>
        </section>

        {top.length > 0 && (
          <section className="card overflow-hidden">
            <h2 className="flex items-center gap-2 p-6 pb-3 text-xl font-bold text-slate-900"><School size={20} className="text-brand-600" />Top universities in {g.country}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">University</th><th className="px-4 py-3">World rank</th><th className="px-4 py-3">Courses</th><th className="px-4 py-3">Fees / year</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{top.map((u) => (
                  <tr key={u.id}><td className="px-4 py-3"><Link href={`/colleges/${u.slug}`} className="font-medium text-brand-700 hover:underline">{u.name}</Link><span className="block text-xs text-slate-500">{[u.city, u.state].filter(Boolean).join(', ')}</span></td>
                    <td className="px-4 py-3">#{u.world_rank}{u.rank_year ? <span className="block text-xs text-slate-400">Leiden {u.rank_year}</span> : null}</td>
                    <td className="px-4 py-3">{u.courses || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{u.fee_min != null ? <>{money(u.fee_min, u.fee_currency)}{u.fee_currency !== 'INR' && u.fee_min_inr ? <span className="block text-xs font-normal text-slate-500">≈ {money(u.fee_min_inr, 'INR')}</span> : null}</>
                      : g.code === 'DE' ? <span className="text-xs font-normal text-slate-600">See page (public: usually no tuition)</span> : <span className="text-xs font-normal text-slate-500">See official site</span>}</td></tr>))}</tbody>
              </table>
            </div>
            <p className="p-4 text-xs text-slate-400">World rank: CWTS Leiden Ranking (research output). Fees from official university / government data.</p>
          </section>
        )}

        <section className="card space-y-3 p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><CalendarDays size={20} className="text-brand-600" />Intakes and deadlines</h2>
          <p className="text-slate-700">{g.intakes}</p>
          <h3 className="flex items-center gap-2 pt-2 font-bold text-slate-900"><Lightbulb size={17} className="text-amber-500" />Tips</h3>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">{g.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>

        <VisaNews country={g.code} limit={6} />
      </div>

      <aside className="space-y-5">
        <div className="card p-5">
          <p className="font-bold text-slate-900">Official websites</p>
          <ul className="mt-2 space-y-1.5 text-sm">{g.official.map((o) => <li key={o.href}><a href={o.href} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-brand-700 hover:underline">{o.label}<ExternalLink size={11} /></a></li>)}</ul>
          <p className="mt-4 font-bold text-slate-900">Scholarships</p>
          <ul className="mt-2 space-y-1.5 text-sm">{g.scholarships.map((o) => <li key={o.href}><Link href={o.href} className="text-brand-700 hover:underline">{o.label}</Link></li>)}
            <li><Link href="/scholarships" className="text-brand-700 hover:underline">All scholarships</Link></li></ul>
        </div>
        <div className="lg:sticky lg:top-24"><EnquiryForm compact title={`Planning to study in ${g.country}?`} subtitle="Free guidance — no agent fees." /></div>
      </aside>
    </div>
  );
}
