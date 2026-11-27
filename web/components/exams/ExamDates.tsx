import Link from 'next/link';
import { CalendarDays, ExternalLink } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { hostOf } from '@/lib/newsDate';

const NAMES: Record<string, string> = { registration_start: 'Registration opens', registration_end: 'Last date to apply', correction_window: 'Form correction',
  admit_card: 'Admit card', exam: 'Exam', answer_key: 'Answer key', result: 'Result', counselling: 'Counselling' };
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Upcoming official dates for one exam (entered by our team from the official notice)
export default async function ExamDates({ slug, name }: { slug: string; name: string }) {
  if (!hasSupabase) return null;
  const { data } = await supabasePublic().rpc('exam_calendar', { p_exam: slug, p_days: 400 });
  const rows = (data || []) as any[];
  if (!rows.length) return null;
  return (
    <section className="card p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarDays size={19} className="text-brand-600" />{name} important dates</h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <span className="font-medium text-slate-800">{NAMES[r.event] || r.event}{r.title ? ` · ${r.title}` : ''}</span>
            <span className="flex items-center gap-2 text-slate-600">{fmt(r.date_start)}{r.date_end ? ` – ${fmt(r.date_end)}` : ''}{r.tentative && <span className="text-xs text-amber-600">tentative</span>}
              <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline" title="Official notice">Source: {hostOf(r.source_url)}<ExternalLink size={11} /></a></span>
          </li>))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Follow {name} below to get a reminder before each date · <Link href="/exams/calendar" className="text-brand-700 hover:underline">All exam dates</Link></p>
    </section>
  );
}
