import Link from 'next/link';
import { Flag, isForeign } from './Flag';
import { MapPin, Star, Trophy, Download, Send, IndianRupee, Briefcase, Target } from 'lucide-react';
import { SaveButton, CompareButton } from '@/components/ActionButtons';
import { short, lpa } from '@/lib/format';
import type { College } from '@/lib/types';

export type RowFacts = {
  avg_rating: number | null; review_count: number; placement_avg: number | null; placement_highest: number | null; placement_year: number | null;
  placement_currency: string | null; rank_source: string | null; rank_value: number | null; rank_year: number | null; course_count: number;
  fee_low: number | null; fee_high: number | null; exams: string[]; approvals: string[]; cutoff_exam: string | null; cutoff_rank: number | null;
  cutoff_year: number | null; brochure: boolean;
};

// One college as a row of facts — fees, placements, reviews, rank, cutoff — so students can compare at a glance.
export default function CollegeRow({ c, f, examNames, n }: { c: College & { brochure_url?: string | null }; f?: RowFacts; examNames: Record<string, string>; n?: number }) {
  const cur = c.currency || 'INR';
  const rank = f?.rank_value ?? c.ranking;
  const item = { id: c.id, slug: c.slug, name: c.name, city: c.city };
  return (
    <article className="card overflow-hidden">
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] md:items-start">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.logo_url ? <img src={c.logo_url} alt="" className="h-full w-full object-contain p-1" loading="lazy" /> : isForeign((c as any).country_code) ? <Flag code={(c as any).country_code} country={(c as any).country} className="h-9 w-12" /> : <span className="text-lg font-bold text-brand-700">{c.name[0]}</span>}
          </div>
          <div className="min-w-0">
            {n ? <span className="text-xs font-semibold text-slate-400">#{n}</span> : null}
            <Link href={`/colleges/${c.slug}`} className="block font-bold leading-snug text-slate-900 hover:text-brand-700">{c.name}</Link>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">{isForeign((c as any).country_code) ? <Flag code={(c as any).country_code} country={(c as any).country} className="h-3 w-4" /> : <MapPin size={12} />}{[c.city, c.state].filter(Boolean).join(', ')}{c.type ? ` · ${c.type}` : ''}{c.established ? ` · Estd ${c.established}` : ''}</p>
            {(f?.approvals?.length || c.accreditation) ? <div className="mt-1.5 flex flex-wrap gap-1">{(f?.approvals?.length ? f.approvals : [c.accreditation!]).slice(0, 4).map((a) => <span key={a} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{a}</span>)}</div> : null}
          </div>
        </div>
        <Fact icon={<IndianRupee size={13} />} label="Fees / year">
          {f?.fee_low ? <><b>{short(f.fee_low, cur)}</b>{f.fee_high && f.fee_high !== f.fee_low ? <> – {short(f.fee_high, cur)}</> : null}</> : c.fees_min ? <b>{short(c.fees_min, cur)}</b> : <Na />}
          {f?.course_count ? <Link href={`/colleges/${c.slug}#courses`} className="block text-xs text-brand-700 hover:underline">{f.course_count} course{f.course_count > 1 ? 's' : ''}</Link> : null}
        </Fact>
        <Fact icon={<Briefcase size={13} />} label="Placement">
          {f?.placement_avg || f?.placement_highest ? <>
            {f.placement_avg ? <span className="block"><b>{lpa(f.placement_avg, f.placement_currency || cur)}</b> <span className="text-xs text-slate-500">avg</span></span> : null}
            {f.placement_highest ? <span className="block text-xs text-slate-600">{lpa(f.placement_highest, f.placement_currency || cur)} highest</span> : null}
            {f.placement_year ? <span className="text-[10px] text-slate-400">{f.placement_year}</span> : null}
          </> : <Na />}
        </Fact>
        <Fact icon={<Star size={13} />} label="Student reviews">
          {f?.review_count ? <Link href={`/colleges/${c.slug}#reviews`} className="hover:underline"><b className="text-emerald-700">{Number(f.avg_rating).toFixed(1)}</b><span className="text-xs text-slate-500">/5 · {f.review_count} review{f.review_count > 1 ? 's' : ''}</span></Link> : <Link href={`/colleges/${c.slug}#reviews`} className="text-xs text-brand-700 hover:underline">Be the first to review</Link>}
        </Fact>
        <Fact icon={rank ? <Trophy size={13} /> : <Target size={13} />} label={rank ? 'Rank' : 'Cutoff'}>
          {rank ? <><b>#{rank}</b> <span className="text-xs text-slate-500">{f?.rank_value ? `${f.rank_source || ''}${f.rank_year ? ` ${f.rank_year}` : ''}` : 'rank'}</span></> : null}
          {f?.cutoff_rank ? <span className="block text-xs text-slate-600">{examNames[f.cutoff_exam!] || f.cutoff_exam} closing rank {f.cutoff_rank.toLocaleString('en-IN')}{f.cutoff_year ? ` (${f.cutoff_year})` : ''}</span> : !rank ? <Na /> : null}
        </Fact>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2">
        {f?.exams?.length ? <p className="me-auto truncate text-xs text-slate-500">Exams: {f.exams.slice(0, 4).map((e) => examNames[e] || e).join(', ')}</p> : <span className="me-auto" />}
        <CompareButton item={item} />
        <SaveButton type="college" id={c.id} />
        {c.brochure_url ? <a href={c.brochure_url} target="_blank" rel="noopener noreferrer" className="btn-ghost py-1 text-xs"><Download size={13} />Brochure</a> : null}
        {c.accepts_applications
          ? <Link href={`/colleges/${c.slug}#apply`} className="btn-accent py-1.5 text-xs"><Send size={13} />Apply now</Link>
          : <Link href={`/colleges/${c.slug}#enquiry`} className="btn-primary py-1.5 text-xs"><Send size={13} />Get details</Link>}
      </div>
    </article>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm text-slate-800">
      <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">{icon}{label}</p>
      {children}
    </div>
  );
}
const Na = () => <span className="text-xs text-slate-400">Not available</span>;
