import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, Clock, Wallet, Briefcase } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { renderMarkdown } from '@/lib/markdown';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts
async function get(cc: string) {
  if (!hasSupabase || !/^[a-z]{2}$/i.test(cc)) return null;
  return (await supabasePublic().from('visa_guides').select('*').eq('country_code', cc.toUpperCase()).eq('is_published', true).maybeSingle()).data as any;
}
export async function generateMetadata({ params }: { params: Promise<{ country: string }> }): Promise<Metadata> {
  const v = await get((await params).country);
  return v ? { title: `${v.title} — documents, fees, processing time`, description: (v.summary || '').slice(0, 160) } : { title: 'Visa guide not found' };
}
export default async function VisaGuide({ params }: { params: Promise<{ country: string }> }) {
  const v = await get((await params).country);
  if (!v) notFound();
  return (
    <div className="container-x max-w-3xl py-10">
      <Link href="/study-abroad/visa" className="text-sm text-slate-500">← All visa guides</Link>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">{v.title}</h1>
      {v.summary && <p className="mt-2 text-slate-600">{v.summary}</p>}
      <div className="card mt-6 grid gap-4 p-5 sm:grid-cols-3 text-sm">
        <div><p className="flex items-center gap-1 text-xs text-slate-500"><Clock size={12} />Processing time</p><p className="font-semibold">{v.processing_time || 'See official site'}</p></div>
        <div><p className="flex items-center gap-1 text-xs text-slate-500"><Wallet size={12} />Fees</p><p className="font-semibold">{v.fee_note || 'See official site'}</p></div>
        <div><p className="flex items-center gap-1 text-xs text-slate-500"><Briefcase size={12} />Work while studying</p><p className="font-semibold">{v.work_rights || 'See official site'}</p></div>
      </div>
      {v.body && <article className="prose prose-slate mt-6 max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(v.body) }} />}
      <a href={v.official_url} target="_blank" rel="noopener" className="btn-primary mt-6">Official immigration website<ExternalLink size={14} /></a>
      <p className="mt-3 text-xs text-slate-400">Updated {new Date(v.updated_at).toLocaleDateString()}. Immigration rules change often — the official website is always the final word. This is not legal advice.</p>
    </div>
  );
}
