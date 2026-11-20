import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, CalendarDays, Award } from 'lucide-react';
import TranslateText from '@/components/TranslateText';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';
async function get(slug: string) {
  if (!hasSupabase) return null;
  return (await supabasePublic().from('scholarships').select('*').eq('slug', slug).eq('is_published', true).maybeSingle()).data as any;
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await get((await params).slug);
  return s ? { title: `${s.name} — amount, eligibility, deadline`, description: `${s.name} by ${s.provider || 'the provider'}: ${s.amount_note || ''} Eligibility, deadline and official link.`.slice(0, 160) } : { title: 'Scholarship not found' };
}
export default async function ScholarshipPage({ params }: { params: Promise<{ slug: string }> }) {
  const s = await get((await params).slug);
  if (!s) notFound();
  return (
    <div className="container-x max-w-3xl py-10">
      <Link href="/scholarships" className="text-sm text-slate-500">← All scholarships</Link>
      <h1 className="mt-2 flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Award className="text-brand-600" />{s.name}</h1>
      <p className="text-slate-500">{s.provider}{s.host_country ? ` · Study in ${s.host_country}` : ''}{s.field ? ` · ${s.field}` : ''}</p>
      <div className="card mt-6 grid gap-4 p-5 sm:grid-cols-3">
        <div><p className="text-xs text-slate-500">Amount</p><p className="font-bold text-emerald-700">{s.amount != null ? money(s.amount, s.currency || 'USD') : '—'}</p>{s.amount_note && <p className="text-xs text-slate-500">{s.amount_note}</p>}</div>
        <div><p className="text-xs text-slate-500">Deadline</p><p className="flex items-center gap-1 font-bold"><CalendarDays size={14} />{s.deadline ? new Date(s.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'See official site'}</p></div>
        <div><p className="text-xs text-slate-500">Levels</p><p className="font-bold">{(s.levels || []).join(', ') || 'Any'}</p>{(s.for_nationalities || []).length > 0 && <p className="text-xs text-slate-500">For: {s.for_nationalities.join(', ')}</p>}</div>
      </div>
      {s.eligibility && <section className="card mt-4 p-5"><h2 className="font-bold">Eligibility</h2><TranslateText text={s.eligibility} className="mt-2 whitespace-pre-line text-slate-600" /></section>}
      {s.how_to_apply && <section className="card mt-4 p-5"><h2 className="font-bold">How to apply</h2><TranslateText text={s.how_to_apply} className="mt-2 whitespace-pre-line text-slate-600" /></section>}
      <a href={s.official_url} target="_blank" rel="noopener" className="btn-primary mt-6">Apply on the official website<ExternalLink size={14} /></a>
      <p className="mt-3 text-xs text-slate-400">Last updated {new Date(s.updated_at).toLocaleDateString()}. Information can change — always confirm on the official page.</p>
    </div>
  );
}
