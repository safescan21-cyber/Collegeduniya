import Link from 'next/link';
import { Globe2, ArrowRight, ExternalLink } from 'lucide-react';
import { guideFor, germanFeeRule, CHECKED } from '@/lib/admissionGuides';

// "How to get admission" for U.S. and German colleges — the country's official process + the fee rule for this college
export default function CountryGuide({ c }: { c: { name: string; short_name?: string | null; country_code?: string | null; state?: string | null; type?: string | null; website?: string | null } }) {
  const g = guideFor(c.country_code);
  if (!g) return null;
  const fee = g.code === 'DE' ? germanFeeRule(c) : null;
  const name = c.short_name || c.name;
  return (
    <section id="how-to-apply" className="card scroll-mt-32 space-y-4 p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Globe2 size={20} className="text-brand-600" />How Indian students get admission to {name}</h2>
      <p className="text-sm text-slate-600">{g.intro}</p>
      {fee && (
        <div className="rounded-xl bg-brand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Tuition at {name}</p>
          <p className="mt-1 font-bold text-slate-900">{fee.amount}</p>
          <p className="text-sm text-slate-600">{fee.note} {fee.href && <a href={fee.href} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-0.5 text-brand-700 hover:underline">Official rule<ExternalLink size={11} /></a>}</p>
        </div>
      )}
      <ol className="space-y-3">
        {g.ugSteps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
            <div><p className="font-semibold text-slate-900">{s.title}</p><p className="text-sm text-slate-600">{s.text}</p>
              {s.link && <a href={s.link.href} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-0.5 text-xs text-brand-700 hover:underline">{s.link.label}<ExternalLink size={10} /></a>}</div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-slate-600"><strong>Intakes:</strong> {g.intakes}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/study-abroad/${g.slug}`} className="btn-primary py-2">Full {g.country} guide: costs, visa, master’s<ArrowRight size={15} /></Link>
        {c.website && <a href={c.website} target="_blank" rel="noopener nofollow" className="btn-ghost py-2">{name} admissions website<ExternalLink size={14} /></a>}
      </div>
      <p className="text-xs text-slate-400">From official sources, checked {CHECKED}. Rules change — always confirm on the university’s and embassy’s websites.</p>
    </section>
  );
}
