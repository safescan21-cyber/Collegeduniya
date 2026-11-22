import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeCheck, Building2, Globe, MapPin, Users } from 'lucide-react';
import { JobCard, EmptyState } from '@/components/Cards';
import TranslateText from '@/components/TranslateText';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import type { Job } from '@/lib/types';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts

async function getCompany(slug: string) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().from('companies_public').select('*').eq('slug', slug).maybeSingle();
  return data as any;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCompany((await params).slug);
  return c ? { title: `${c.name} — jobs for students`, description: (c.about || `${c.name} is hiring students on Collegeolo.`).slice(0, 160) } : { title: 'Company not found' };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getCompany((await params).slug);
  if (!c) notFound();
  const { data } = await supabasePublic().from('jobs').select('*').eq('company_id', c.id).eq('is_published', true).eq('status', 'open').order('created_at', { ascending: false });
  const jobs = (data || []) as Job[];
  return (
    <div className="container-x py-10">
      <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-50 text-brand-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {c.logo_url ? <img src={c.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 size={32} />}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">{c.name}{c.is_verified && <span className="chip-green"><BadgeCheck size={14} />Verified employer</span>}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            {c.industry && <span>{c.industry}</span>}
            {(c.city || c.country) && <span className="flex items-center gap-1"><MapPin size={14} />{[c.city, c.country].filter(Boolean).join(', ')}</span>}
            {c.size && <span className="flex items-center gap-1"><Users size={14} />{c.size} people</span>}
            {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 text-brand-700 hover:underline"><Globe size={14} />Website</a>}
          </p>
        </div>
      </div>
      {c.about && <div className="card mt-6 p-6"><h2 className="font-bold text-slate-900">About</h2><TranslateText text={c.about} className="mt-2 whitespace-pre-line text-slate-600" /></div>}
      <h2 className="section-title mt-10">Open jobs ({jobs.length})</h2>
      <div className="mt-5">{jobs.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{jobs.map((j) => <JobCard key={j.id} j={j} />)}</div> : <EmptyState title="No open jobs right now" />}</div>
    </div>
  );
}
