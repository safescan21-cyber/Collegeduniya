import type { Metadata } from 'next';
import Link from 'next/link';
import { Plane } from 'lucide-react';
import { EmptyState } from '@/components/Cards';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Student visa guides by country', description: 'Student visa steps, processing time, fees and work rights — with links to each official immigration website.' };

export default async function VisaIndex() {
  const rows = hasSupabase ? ((await supabasePublic().from('visa_guides').select('country_code, title, summary, updated_at').eq('is_published', true).order('title')).data || []) : [];
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Plane className="text-brand-600" />Student visa guides</h1>
      <p className="mt-1 text-slate-500">Plain-language checklists. Rules change — every guide links to the official government page.</p>
      {rows.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((v: any) => (
            <Link key={v.country_code} href={`/study-abroad/visa/${v.country_code.toLowerCase()}`} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="font-bold text-slate-900">{v.title}</p>{v.summary && <p className="mt-1 line-clamp-3 text-sm text-slate-600">{v.summary}</p>}
              <p className="mt-2 text-xs text-slate-400">Updated {new Date(v.updated_at).toLocaleDateString()}</p>
            </Link>
          ))}
        </div>
      ) : <div className="mt-6"><EmptyState icon={<Plane size={28} />} title="Visa guides coming soon" text="Our team is writing guides from official sources." /></div>}
    </div>
  );
}
