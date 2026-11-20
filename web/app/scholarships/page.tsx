import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, CalendarDays, ExternalLink } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { EmptyState } from '@/components/Cards';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm } from '@/lib/data';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | undefined>;
export const metadata: Metadata = {
  title: 'Scholarships for Indian & international students — study in India and abroad',
  description: 'Scholarships with amount, eligibility, deadline and the official link to apply. Filter by country, level and field.',
};

export default async function ScholarshipsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  let rows: any[] = []; let countries: { code: string; name: string }[] = [];
  if (hasSupabase) {
    const sb = supabasePublic();
    let q = sb.from('scholarships').select('*').eq('is_published', true).order('deadline', { ascending: true, nullsFirst: false }).limit(100);
    if (sp.country) q = q.eq('host_country', sp.country);
    if (sp.level) q = q.contains('levels', [sp.level]);
    const term = cleanTerm(sp.q);
    if (term) q = q.or(`name.ilike.%${term}%,provider.ilike.%${term}%,field.ilike.%${term}%`);
    if (sp.open !== 'all') q = q.or(`deadline.is.null,deadline.gte.${new Date().toISOString().slice(0, 10)}`);
    if (sp.nat) q = q.or(`for_nationalities.eq.{},for_nationalities.cs.{${sp.nat}}`);
    rows = (await q).data || [];
    const { data: c } = await sb.from('scholarships').select('host_country').eq('is_published', true).limit(1000);
    const codes = Array.from(new Set((c || []).map((x: any) => x.host_country).filter(Boolean)));
    if (codes.length) countries = ((await sb.from('countries').select('code, name').in('code', codes)).data || []) as any[];
  }
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><Award className="text-brand-600" />Scholarships</h1>
      <p className="mt-1 text-slate-500">Always apply on the official website — scholarships never ask you to pay a fee to an agent.</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside><FilterBar action="/scholarships" values={sp} fields={[
          { name: 'q', label: 'Search', type: 'text', placeholder: 'Name, provider, field' },
          { name: 'country', label: 'Study in', type: 'select', options: countries.map((c) => ({ value: c.code, label: c.name })) },
          { name: 'level', label: 'Level', type: 'select', options: ['UG', 'PG', 'PhD', 'Diploma', 'School'] },
          { name: 'nat', label: 'My nationality', type: 'text', placeholder: 'e.g. IN' },
          { name: 'open', label: 'Show', type: 'select', options: [{ value: 'all', label: 'Include closed' }] },
        ]} /></aside>
        <section>
          {rows.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {rows.map((s) => (
                <Link key={s.id} href={`/scholarships/${s.slug}`} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                  <p className="font-bold text-slate-900">{s.name}</p>
                  <p className="text-sm text-slate-500">{s.provider}{s.host_country ? ` · ${s.host_country}` : ''}{s.field ? ` · ${s.field}` : ''}</p>
                  <p className="mt-2 font-semibold text-emerald-700">{s.amount != null ? money(s.amount, s.currency || 'USD') : ''}{s.amount_note ? `${s.amount != null ? ' · ' : ''}${s.amount_note}` : ''}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{(s.levels || []).map((l: string) => <span key={l} className="chip">{l}</span>)}
                    {s.deadline && <span className="chip-amber"><CalendarDays size={11} />Deadline {new Date(s.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}</div>
                </Link>
              ))}
            </div>
          ) : <EmptyState icon={<Award size={28} />} title="No scholarships listed yet" text="Our team adds verified scholarships with official links. Check back soon or ask a counsellor." />}
          <p className="mt-6 flex items-center gap-1 text-xs text-slate-400"><ExternalLink size={12} />Details can change — the official page is always the final word.</p>
        </section>
      </div>
    </div>
  );
}
