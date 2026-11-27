'use client';
import { ExternalLink } from 'lucide-react';
import ResourceManager from '@/components/admin/ResourceManager';

const EVENTS = ['registration_start', 'registration_end', 'correction_window', 'admit_card', 'exam', 'answer_key', 'result', 'counselling'];
const label = (e: string) => e.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Important dates shown on /exams/calendar and the exam pages; students who follow the exam get a reminder
// 3 days and 1 day before. Copy every date from the official notice and paste its link — never guess a date.
export default function AdminExamDates() {
  return (
    <ResourceManager resource="exam_dates" title="Exam dates (calendar & reminders)"
      defaults={{ event: 'exam', tentative: false, is_published: true }}
      quickFilters={[{ label: 'All', params: {} }, { label: 'Exams', params: { event: 'exam' } }, { label: 'Last dates', params: { event: 'registration_end' } }, { label: 'Results', params: { event: 'result' } }]}
      fields={[
        { name: 'exam_slug', label: 'Exam URL slug', type: 'text', required: true, placeholder: 'jee-main', help: 'As in collegeolo.com/exams/<slug>' },
        { name: 'event', label: 'What happens', type: 'select', options: EVENTS, required: true },
        { name: 'title', label: 'Label (optional)', type: 'text', placeholder: 'Session 1 · Phase 2' },
        { name: 'date_start', label: 'Date (or first day)', type: 'date', required: true },
        { name: 'date_end', label: 'Last day (if a range)', type: 'date' },
        { name: 'tentative', label: 'Tentative (not final yet)', type: 'bool' },
        { name: 'source_url', label: 'Official notice link', type: 'text', required: true, full: true, placeholder: 'https://jeemain.nta.nic.in/…', help: 'Required — the date must come from the official website' },
        { name: 'is_published', label: 'Published', type: 'bool' },
      ]}
      columns={[
        { key: 'exam_slug', label: 'Exam', render: (r) => <div><p className="font-semibold text-slate-900">{r.exam_slug}</p><p className="text-xs text-slate-500">{label(r.event)}{r.title ? ` · ${r.title}` : ''}</p></div> },
        { key: 'date_start', label: 'Date', render: (r) => <span>{fmt(r.date_start)}{r.date_end ? ` – ${fmt(r.date_end)}` : ''}{r.tentative ? <span className="ms-1 text-xs text-amber-600">tentative</span> : null}</span> },
      ]}
      rowActions={(r) => <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2 py-1.5" title="Official notice"><ExternalLink size={14} /></a>}
    />
  );
}
