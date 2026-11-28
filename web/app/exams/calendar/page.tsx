import type { Metadata } from 'next';
import Link from 'next/link';
import { hostOf } from '@/lib/newsDate';
import { Bell, CalendarDays, ExternalLink } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const revalidate = 1800;
export const metadata: Metadata = {
  title: 'Exam calendar — registration, admit card, exam & result dates',
  description: 'Upcoming entrance exam dates in one calendar: last dates to apply, admit cards, exam days, answer keys and results — each linked to the official notice.',
  alternates: { canonical: '/exams/calendar' },
};

type Row = { id: string; exam_slug: string; exam_name: string; stream: string | null; level: string | null; event: string; title: string | null;
  date_start: string; date_end: string | null; tentative: boolean; source_url: string };

const EVENT: Record<string, { label: string; cls: string }> = {
  registration_start: { label: 'Registration opens', cls: 'bg-sky-50 text-sky-700' },
  registration_end: { label: 'Last date to apply', cls: 'bg-rose-50 text-rose-700' },
  correction_window: { label: 'Form correction', cls: 'bg-slate-100 text-slate-700' },
  admit_card: { label: 'Admit card', cls: 'bg-violet-50 text-violet-700' },
  exam: { label: 'Exam', cls: 'bg-brand-600 text-white' },
  answer_key: { label: 'Answer key', cls: 'bg-amber-50 text-amber-700' },
  result: { label: 'Result', cls: 'bg-emerald-50 text-emerald-700' },
  counselling: { label: 'Counselling', cls: 'bg-teal-50 text-teal-700' },
};
const day = (d: string) => new Date(`${d}T00:00:00`);
const short = (d: string) => day(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default async function ExamCalendar({ searchParams }: { searchParams: Promise<{ stream?: string }> }) {
  const { stream } = await searchParams;
  const rows: Row[] = hasSupabase ? (((await supabasePublic().rpc('exam_calendar', { p_days: 240 })).data || []) as Row[]) : [];
  const streams = Array.from(new Set(rows.map((r) => r.stream).filter(Boolean))) as string[];
  const list = stream ? rows.filter((r) => r.stream === stream) : rows;
  const months = list.reduce((m: Record<string, Row[]>, r) => {
    const k = day(r.date_start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    (m[k] ||= []).push(r); return m;
  }, {});
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div className="container-x max-w-4xl py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><CalendarDays className="text-brand-600" />Exam calendar</h1>
      <p className="mt-2 text-slate-600">Last dates, admit cards, exam days and results for the next 8 months. Every date links to the official notice — always confirm there before you act.</p>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><Bell size={14} className="text-amber-500" />Follow an exam on its page and we’ll remind you 3 days and 1 day before each date.</p>

      {streams.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <Link href="/exams/calendar" className={`rounded-full px-3 py-1 ${!stream ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>All</Link>
          {streams.map((s) => <Link key={s} href={`/exams/calendar?stream=${encodeURIComponent(s)}`} className={`rounded-full px-3 py-1 ${stream === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{s}</Link>)}
        </div>)}

      {list.length === 0 ? (
        <div className="card mt-8 p-10 text-center text-slate-500">No dates announced yet{stream ? ` for ${stream}` : ''}. Check the <Link href="/exams" className="text-brand-700 underline">exam pages</Link> for the latest news.</div>
      ) : Object.entries(months).map(([month, items]) => (
        <section key={month} className="mt-8">
          <h2 className="sticky top-16 z-10 bg-white/90 py-2 text-lg font-bold text-slate-900 backdrop-blur">{month}</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {items.map((r) => {
              const ev = EVENT[r.event] || { label: r.event, cls: 'bg-slate-100 text-slate-700' };
              const days = Math.round((day(r.date_start).getTime() - today.getTime()) / 864e5);
              return (
                <li key={r.id} className="flex items-center gap-4 p-4">
                  <div className="w-16 shrink-0 text-center">
                    <p className="text-2xl font-extrabold leading-none text-slate-900">{day(r.date_start).getDate()}</p>
                    <p className="text-xs uppercase text-slate-500">{day(r.date_start).toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`/exams/${r.exam_slug}`} className="font-bold text-slate-900 hover:text-brand-700 hover:underline">{r.exam_name}</Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ev.cls}`}>{ev.label}</span>
                      {r.tentative && <span className="text-xs text-amber-600">tentative</span>}
                    </p>
                    <p className="text-sm text-slate-500">{r.title ? `${r.title} · ` : ''}{r.date_end ? `${short(r.date_start)} – ${short(r.date_end)}` : short(r.date_start)}{r.stream ? ` · ${r.stream}` : ''}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className={`text-xs font-semibold ${days <= 3 && days >= 0 ? 'text-rose-600' : 'text-slate-500'}`}>{days > 0 ? `in ${days} day${days > 1 ? 's' : ''}` : days === 0 ? 'today' : 'on now'}</p>
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">Source: {hostOf(r.source_url)} (official notice)<ExternalLink size={11} /></a>
                  </div>
                </li>);
            })}
          </ul>
        </section>))}
    </div>
  );
}
