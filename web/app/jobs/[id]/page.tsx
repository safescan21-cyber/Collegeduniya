import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Clock, Briefcase, CalendarDays, Building2, GraduationCap } from 'lucide-react';
import ApplyForm from '@/components/ApplyForm';
import { SaveButton, ShareButtons } from '@/components/ActionButtons';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { range, SITE_URL, timeAgo } from '@/lib/format';
import type { Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getJob(id: string) {
  if (!hasSupabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabasePublic().from('jobs').select('*, colleges(name, slug)').eq('id', id).eq('is_published', true).maybeSingle();
  return data as Job | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const j = await getJob((await params).id);
  if (!j) return { title: 'Job not found' };
  return { title: `${j.title} at ${j.company}, ${j.city}`, description: (j.description || '').slice(0, 160) };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const j = await getJob((await params).id);
  if (!j) notFound();

  const unitMap: Record<string, string> = { hour: 'HOUR', day: 'DAY', week: 'WEEK', month: 'MONTH', project: 'YEAR' };
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'JobPosting', title: j.title, description: j.description || j.title,
    datePosted: j.created_at, ...(j.deadline ? { validThrough: j.deadline } : {}),
    employmentType: j.job_type === 'Full-time' ? 'FULL_TIME' : j.job_type === 'Internship' ? 'INTERN' : 'PART_TIME',
    hiringOrganization: { '@type': 'Organization', name: j.company },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: j.city, addressCountry: j.country, streetAddress: j.address } },
    ...(j.is_remote ? { jobLocationType: 'TELECOMMUTE' } : {}),
    ...(j.pay_min ? { baseSalary: { '@type': 'MonetaryAmount', currency: j.currency, value: { '@type': 'QuantitativeValue', minValue: j.pay_min, maxValue: j.pay_max || j.pay_min, unitText: unitMap[j.pay_unit] } } } : {}),
    url: `${SITE_URL}/jobs/${j.id}`,
  };

  return (
    <div className="container-x py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 text-sm text-slate-500"><Link href="/jobs" className="hover:underline">Jobs</Link> / {j.city}</nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {j.company_logo ? <img src={j.company_logo} alt="" className="h-full w-full rounded-2xl object-cover" /> : <Building2 />}
              </span>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">{j.title}</h1>
                <p className="text-slate-600">{j.company}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip-brand"><Briefcase size={12} />{j.job_type}</span>
              <span className="chip"><MapPin size={12} />{j.is_remote ? 'Remote' : [j.address, j.city].filter(Boolean).join(', ')}</span>
              {j.hours_per_week ? <span className="chip"><Clock size={12} />{j.hours_per_week} hrs / week</span> : null}
              {j.deadline && <span className="chip-amber"><CalendarDays size={12} />Apply by {new Date(j.deadline).toLocaleDateString()}</span>}
              {j.status === 'closed' && <span className="chip-red">Closed</span>}
            </div>
            <p className="mt-5 text-2xl font-bold text-emerald-700">{range(j.pay_min, j.pay_max, j.currency)} <span className="text-base font-normal text-slate-500">/ {j.pay_unit}</span></p>
            <p className="mt-1 text-xs text-slate-400">Posted {timeAgo(j.created_at)}</p>
            <div className="mt-4 flex flex-wrap gap-2"><SaveButton type="job" id={j.id} variant="button" /><ShareButtons title={`${j.title} at ${j.company}`} path={`/jobs/${j.id}`} /></div>
          </div>
          <div className="card p-6">
            <h2 className="font-bold text-slate-900">Job description</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-600">{j.description || '—'}</p>
            {j.requirements && <><h2 className="mt-6 font-bold text-slate-900">Requirements</h2><p className="mt-2 whitespace-pre-line text-slate-600">{j.requirements}</p></>}
            {j.skills?.length ? <div className="mt-6 flex flex-wrap gap-2">{j.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div> : null}
            {j.colleges && <Link href={`/colleges/${j.colleges.slug}`} className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><GraduationCap size={16} />Near {j.colleges.name}</Link>}
          </div>
        </div>
        <aside><div className="sticky top-24"><ApplyForm jobId={j.id} jobTitle={j.title} closed={j.status === 'closed'} /></div></aside>
      </div>
    </div>
  );
}
