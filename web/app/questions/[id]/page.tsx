import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, GraduationCap } from 'lucide-react';
import AnswerForm from './AnswerForm';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { SITE_URL, timeAgo } from '@/lib/format';
import type { AnswerPublic, QuestionPublic } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getQ(id: string) {
  if (!hasSupabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabasePublic().from('questions_public').select('*').eq('id', id).maybeSingle();
  return data as QuestionPublic | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const q = await getQ((await params).id);
  if (!q) return { title: 'Question not found', robots: { index: false } };
  // unanswered questions stay out of Google until someone answers
  return { title: q.title, description: (q.body || q.title).slice(0, 160), alternates: { canonical: `/questions/${q.id}` },
    robots: Number((q as any).answer_count) > 0 ? { index: true, follow: true } : { index: false, follow: true } };
}

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const q = await getQ((await params).id);
  if (!q) notFound();
  const { data } = await supabasePublic().from('answers_public').select('*').eq('question_id', q.id)
    .order('is_official', { ascending: false }).order('created_at', { ascending: true });
  const answers = (data || []) as AnswerPublic[];

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question', name: q.title, text: q.body || q.title, answerCount: answers.length, dateCreated: q.created_at,
      author: { '@type': 'Person', name: q.asker_name },
      ...(answers[0] ? { acceptedAnswer: { '@type': 'Answer', text: answers[0].body, dateCreated: answers[0].created_at, url: `${SITE_URL}/questions/${q.id}`, author: { '@type': 'Person', name: answers[0].author_name } } } : {}),
    },
  };

  return (
    <div className="container-x max-w-3xl py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/questions" className="text-sm text-slate-500 hover:underline">← All questions</Link>
      <article className="card mt-3 p-6">
        {q.college_slug && <Link href={`/colleges/${q.college_slug}`} className="chip-brand mb-3"><GraduationCap size={12} />{q.college_name}</Link>}
        <h1 className="text-2xl font-extrabold text-slate-900">{q.title}</h1>
        {q.body && <p className="mt-3 whitespace-pre-line text-slate-600">{q.body}</p>}
        <p className="mt-3 text-xs text-slate-400">Asked by {q.asker_name} · {timeAgo(q.created_at)}</p>
      </article>
      <h2 className="mt-8 text-lg font-bold text-slate-900">{answers.length} answer{answers.length === 1 ? '' : 's'}</h2>
      <div className="mt-3 space-y-3">
        {answers.map((a) => (
          <div key={a.id} className={`card p-5 ${a.is_official ? 'border-emerald-300 bg-emerald-50/40' : ''}`}>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {a.author_name}
              {a.is_team && <span className="chip-brand py-0.5">StudyEarnstay team</span>}
              {a.is_official && <span className="chip-green py-0.5"><BadgeCheck size={12} />Expert answer</span>}
              <span className="font-normal text-slate-400">· {timeAgo(a.created_at)}</span>
            </p>
            <p className="mt-2 whitespace-pre-line text-slate-700">{a.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6"><AnswerForm questionId={q.id} /></div>
    </div>
  );
}
