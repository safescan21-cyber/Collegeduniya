import type { Metadata } from 'next';
import Link from 'next/link';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { short } from '@/lib/format';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Courses after 12th and graduation — fees, eligibility & colleges',
  description: 'B.Tech, MBA, MBBS, BBA, BCA, B.Com, LLB and more: duration, eligibility, entrance exams, fee range and the colleges that offer each course.',
  alternates: { canonical: '/courses' },
};

export default async function Courses() {
  let rows: any[] = [];
  if (hasSupabase) {
    const sb = supabasePublic();
    const [{ data: cat }, { data: cnt }] = await Promise.all([sb.from('course_catalog').select('*').order('sort'), sb.rpc('course_catalog_counts')]);
    const counts = Object.fromEntries(((cnt || []) as any[]).map((r) => [r.slug, r]));
    rows = ((cat || []) as any[]).map((k) => ({ ...k, colleges: Number(counts[k.slug]?.colleges || 0), fee_min: counts[k.slug]?.fee_min }));
  }
  const groups = ['UG', 'PG', 'Diploma', 'PhD', 'Certificate'].map((lv) => [lv, rows.filter((r) => r.level === lv)] as const).filter(([, r]) => r.length);
  const LABEL: Record<string, string> = { UG: 'After 12th (undergraduate)', PG: 'After graduation (postgraduate)', Diploma: 'Diploma', PhD: 'Doctorate', Certificate: 'Certificate' };
  return (
    <div className="container-x py-10">
      <nav className="text-sm text-slate-500"><Link href="/" className="hover:underline">Home</Link> / Courses</nav>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Courses</h1>
      <p className="mt-1 max-w-2xl text-slate-500">Pick a course to see how long it takes, who can apply, the entrance exams, what it costs at real colleges, and where you can study it.</p>
      {groups.map(([lv, list]) => (
        <section key={lv} className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-slate-900">{LABEL[lv]}</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2.5">Course</th><th className="px-4 py-2.5">Duration</th><th className="px-4 py-2.5">Stream</th><th className="px-4 py-2.5">Colleges</th><th className="px-4 py-2.5">Fees from</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{list.map((k) => (
                <tr key={k.slug} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3"><Link href={`/courses/${k.slug}`} className="font-semibold text-slate-900 hover:text-brand-700">{k.name}</Link><p className="text-xs text-slate-500">{k.full_name}</p></td>
                  <td className="px-4 py-3 text-slate-700">{k.duration || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{k.stream}</td>
                  <td className="px-4 py-3">{k.colleges ? <Link href={`/colleges?course=${k.slug}`} className="font-semibold text-brand-700 hover:underline">{k.colleges.toLocaleString('en-IN')}</Link> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3">{k.fee_min ? `${short(k.fee_min)} / yr` : <span className="text-slate-400">—</span>}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </section>))}
    </div>
  );
}
