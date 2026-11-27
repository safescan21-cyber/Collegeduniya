import type { Metadata } from 'next';
import { extUrl, urlLabel } from '@/lib/extUrl';
import Link from 'next/link';
import { DocRow, type ExamDoc } from '@/components/ExamDocs';
import { notFound } from 'next/navigation';
import { ExternalLink, Target, CalendarDays, Building2, Monitor, Repeat } from 'lucide-react';
import EnquiryForm from '@/components/EnquiryForm';
import FollowExam from '@/components/exams/FollowExam';
import ExamDates from '@/components/exams/ExamDates';
import ExamNewsList, { type ExamNewsItem } from '@/components/exams/ExamNewsList';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { timeAgo } from '@/lib/format';
import type { Exam } from '@/lib/types';

// rendered per request (language cookie), but database answers are cached for a short time — lib/supabase/server.ts

async function getExam(slug: string) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().from('exams').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  return data as Exam | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await getExam((await params).slug);
  if (!e) return { title: 'Exam not found' };
  return { title: `${e.short_name} — eligibility, pattern, dates & accepting colleges`, description: (e.description || e.full_name || e.short_name).slice(0, 160) };
}

function Block({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return <section className="card p-6"><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="mt-2 whitespace-pre-line text-slate-600">{text}</p></section>;
}

export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const e = await getExam((await params).slug);
  if (!e) notFound();
  const sb = supabasePublic();
  const { data: mockBp } = await sb.from('mock_blueprints').select('title').eq('exam_slug', e.slug).eq('is_published', true).maybeSingle();
  const [{ data: cut }, { data: articles }, { data: docs }, { data: news }] = await Promise.all([
    sb.from('cutoffs').select('college_id, colleges(name, slug, city)').eq('exam_slug', e.slug).limit(500),
    sb.from('articles').select('slug, title, published_at').eq('exam_id', e.id).eq('is_published', true).order('published_at', { ascending: false }).limit(6),
    sb.from('exam_resources').select('*').eq('exam_slug', e.slug).eq('is_published', true).order('year', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(8),
    sb.from('exam_news').select('id, title, url, source, published_at, official, date_known').eq('exam_id', e.id).eq('is_hidden', false)
      .gte('published_at', new Date(Date.now() - 30 * 86400e3).toISOString()).order('published_at', { ascending: false }).limit(10),
  ]);
  const colleges = Array.from(new Map((cut || []).filter((x: any) => x.colleges).map((x: any) => [x.college_id, x.colleges])).values()) as { name: string; slug: string; city: string }[];
  const facts = [
    { icon: Building2, label: 'Conducted by', value: e.conducting_body },
    { icon: Monitor, label: 'Mode', value: e.mode },
    { icon: Repeat, label: 'Frequency', value: e.frequency },
    { icon: CalendarDays, label: 'Exam date', value: e.exam_date },
  ].filter((f) => f.value);

  return (
    <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <div>
          <Link href="/exams" className="text-sm text-slate-500 hover:underline">← All exams</Link>
          <div className="mt-2 flex flex-wrap gap-2"><span className="chip-brand">{e.stream}</span><span className="chip">{e.level}</span>{e.country && <span className="chip">{e.country}</span>}</div>
          <h1 className="mt-3 text-3xl font-extrabold text-slate-900">{e.short_name}</h1>
          <p className="text-lg text-slate-500">{e.full_name}</p>
          <p className="mt-1 text-xs text-slate-400">Updated {timeAgo(e.updated_at)}</p>
        </div>
        {facts.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {facts.map((f) => <div key={f.label} className="card flex items-center gap-3 p-4"><f.icon className="text-brand-600" size={20} /><div><p className="text-xs text-slate-500">{f.label}</p><p className="font-semibold text-slate-900">{f.value}</p></div></div>)}
          </div>
        )}
        <ExamDates slug={e.slug} name={e.short_name} />
        <Block title="About the exam" text={e.description} />
        <Block title="Eligibility" text={e.eligibility} />
        <Block title="Exam pattern" text={e.pattern} />
        <Block title="Syllabus" text={e.syllabus} />
        <Block title="Registration" text={e.registration} />
        {colleges.length > 0 && (
          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">Colleges accepting {e.short_name}</h2>
              <Link href={`/predictor?exam=${e.slug}`} className="btn-primary py-1.5"><Target size={14} />Predict my colleges</Link>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">{colleges.map((c) => <li key={c.slug}><Link href={`/colleges/${c.slug}#cutoffs`} className="text-brand-700 hover:underline">{c.name}</Link> <span className="text-xs text-slate-400">· {c.city}</span></li>)}</ul>
          </section>
        )}
        {(docs || []).length > 0 && (
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
              <h2 className="text-lg font-bold text-slate-900">{e.short_name} papers, answer keys & date sheets</h2>
              <Link href={`/papers?exam=${e.slug}`} className="text-sm text-brand-700 underline">See all</Link>
            </div>
            {(docs as ExamDoc[]).map((d) => <DocRow key={d.id} d={d} />)}
          </section>
        )}
        {(e as any).news_enabled !== false && <ExamNewsList items={(news || []) as ExamNewsItem[]} name={e.short_name} />}
        {(articles || []).length > 0 && (
          <section className="card p-6"><h2 className="text-lg font-bold text-slate-900">{e.short_name} articles from our team</h2>
            <ul className="mt-2 space-y-1">{(articles || []).map((a: any) => <li key={a.slug}><Link href={`/news/${a.slug}`} className="text-brand-700 hover:underline">{a.title}</Link></li>)}</ul></section>
        )}
      </div>
      <aside className="space-y-5">
        {mockBp && <Link href={`/mock-tests/${e.slug}`} className="btn-primary w-full">Take a free {e.short_name} mock test</Link>}
        {e.level !== 'Abroad' && <Link href={`/rank-predictor/${e.slug}`} className="btn-ghost w-full">{e.short_name} rank predictor</Link>}
        {extUrl(e.website) && <a href={extUrl(e.website)!} target="_blank" rel="noopener noreferrer" className={mockBp ? 'btn-ghost w-full' : 'btn-primary w-full'}><ExternalLink size={16} />Official website</a>}
        {(e as any).news_enabled !== false && <FollowExam examId={e.id} name={e.short_name} slug={e.slug} />}
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Dates and rules change every year — always confirm on the official website before applying.</p>
        <div className="lg:sticky lg:top-24"><EnquiryForm compact title={`Need help with ${e.short_name}?`} subtitle="Get free guidance on colleges and counselling." /></div>
      </aside>
    </div>
  );
}
