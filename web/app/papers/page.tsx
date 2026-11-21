import type { Metadata } from 'next';
import Link from 'next/link';
import { FileStack } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { EmptyState } from '@/components/Cards';
import Pagination from '@/components/Pagination';
import { DocRow, KIND_LABEL, type ExamDoc } from '@/components/ExamDocs';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm } from '@/lib/data';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | undefined>;
const PER = 30;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const what = sp.kind ? `${KIND_LABEL[sp.kind] || 'Papers'}s` : 'Previous year papers, answer keys & date sheets';
  return {
    title: `${what}${sp.year ? ` ${sp.year}` : ''} — free PDF download`,
    description: 'Free previous-year question papers, official answer keys, syllabi and board exam date sheets for JEE, NEET, CUET, CAT, GATE, CBSE and more — with links to the official source.',
    alternates: { canonical: '/papers' },
  };
}

export default async function Papers({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  let docs: ExamDoc[] = []; let total = 0; let exams: { slug: string; short_name: string }[] = [];
  if (hasSupabase) {
    const sb = supabasePublic();
    let q = sb.from('exam_resources').select('*', { count: 'exact' }).eq('is_published', true);
    if (sp.exam) q = q.eq('exam_slug', sp.exam);
    if (sp.kind) q = q.eq('kind', sp.kind);
    if (sp.year) q = q.eq('year', Number(sp.year));
    const t = cleanTerm(sp.q);
    if (t) q = q.or(`title.ilike.%${t}%,session.ilike.%${t}%`);
    const r = await q.order('year', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1);
    docs = (r.data || []) as ExamDoc[]; total = r.count || 0;
    exams = ((await sb.from('exams').select('slug, short_name').eq('is_published', true).order('short_name').limit(500)).data || []) as any[];
  }
  const name = Object.fromEntries(exams.map((e) => [e.slug, e.short_name]));
  const years = Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() - i));
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><FileStack className="text-brand-600" />Exam library</h1>
      <p className="mt-1 text-slate-500">Previous-year papers, official answer keys, syllabi and date sheets — every file links to the official source.</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside><FilterBar action="/papers" values={sp} fields={[
          { name: 'q', label: 'Search', type: 'text', placeholder: 'Shift, subject, title' },
          { name: 'exam', label: 'Exam', type: 'select', options: exams.map((e) => ({ value: e.slug, label: e.short_name })) },
          { name: 'kind', label: 'Type', type: 'select', options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })) },
          { name: 'year', label: 'Year', type: 'select', options: years },
        ]} /></aside>
        <section>
          {docs.length ? <div className="card overflow-hidden">{docs.map((d) => <DocRow key={d.id} d={d} showExam={name[d.exam_slug]} />)}</div>
            : <EmptyState icon={<FileStack size={28} />} title="No documents here yet" text="We add official papers and answer keys as soon as exam bodies publish them." />}
          <Pagination page={page} total={total} perPage={PER} basePath="/papers" params={sp} />
          {sp.exam && <p className="mt-6 text-sm"><Link href={`/exams/${sp.exam}`} className="text-brand-700 underline">About {name[sp.exam] || sp.exam}</Link> · <Link href={`/predictor/${sp.exam}`} className="text-brand-700 underline">College predictor</Link></p>}
        </section>
      </div>
    </div>
  );
}
