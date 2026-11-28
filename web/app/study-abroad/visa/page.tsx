import type { Metadata } from 'next';
import Link from 'next/link';
import { Plane } from 'lucide-react';
import { EmptyState } from '@/components/Cards';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import VisaNews from '@/components/abroad/VisaNews';
import { GUIDES } from '@/lib/admissionGuides';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts
export const metadata: Metadata = { title: 'Student visa guides & latest visa news by country', description: 'Latest student visa news and rule changes for the UK, USA, Canada, Australia and more — plus visa steps, processing time, fees and work rights with links to each official immigration website.' };

export default async function VisaIndex() {
  const rows = hasSupabase ? ((await supabasePublic().from('visa_guides').select('country_code, title, summary, updated_at').eq('is_published', true).order('title')).data || []) : [];
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Plane className="text-brand-600" />Student visa guides</h1>
      <p className="mt-1 text-slate-500">Plain-language checklists. Rules change — every guide links to the official government page.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="self-center font-semibold text-slate-700">Admission guides:</span>
        {Object.values(GUIDES).map((g) => <Link key={g.slug} href={`/study-abroad/${g.slug}`} className="chip hover:bg-brand-50">{g.flag} Study in {g.country}</Link>)}
      </div>
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
      <VisaNews limit={15} />
    </div>
  );
}
