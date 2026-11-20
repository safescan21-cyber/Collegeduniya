import type { Metadata } from 'next';
import { MessagesSquare } from 'lucide-react';
import { AskForm, QuestionList } from '@/components/QuestionsBlock';
import Pagination from '@/components/Pagination';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm } from '@/lib/data';
import type { QuestionPublic } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Student Q&A — ask about colleges, admissions, PGs and jobs',
  description: 'Ask questions about colleges, courses, fees, hostels and part-time jobs. Answers from students and the StudyEarnstay team.',
};
const PER_PAGE = 20;
type SP = Record<string, string | undefined>;

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  let items: QuestionPublic[] = [];
  let total = 0;
  let collegeName = '';
  if (hasSupabase) {
    const sb = supabasePublic();
    let q = sb.from('questions_public').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (sp.college && /^[0-9a-f-]{36}$/i.test(sp.college)) q = q.eq('college_id', sp.college);
    if (sp.unanswered === '1') q = q.eq('answer_count', 0);
    const t = cleanTerm(sp.q);
    if (t) q = q.ilike('title', `%${t}%`);
    const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    items = (data || []) as QuestionPublic[];
    total = count || 0;
    if (sp.college && items[0]?.college_name) collegeName = items[0].college_name;
  }
  return (
    <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><MessagesSquare className="text-brand-600" />Questions & answers{collegeName ? ` — ${collegeName}` : ''}</h1>
        <form className="mt-5 flex gap-2">
          <input name="q" defaultValue={sp.q || ''} placeholder="Search questions…" className="input" />
          {sp.college && <input type="hidden" name="college" value={sp.college} />}
          <button className="btn-primary">Search</button>
        </form>
        <div className="mt-3 flex gap-2 text-sm">
          <a href="/questions" className={sp.unanswered ? 'chip' : 'chip-brand'}>Latest</a>
          <a href="/questions?unanswered=1" className={sp.unanswered ? 'chip-brand' : 'chip'}>Unanswered</a>
        </div>
        <div className="mt-5"><QuestionList items={items} /></div>
        <Pagination page={page} total={total} perPage={PER_PAGE} basePath="/questions" params={sp} />
      </div>
      <aside className="lg:pt-14"><AskForm /></aside>
    </div>
  );
}
