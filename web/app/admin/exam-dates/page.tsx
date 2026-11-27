'use client';
import { useState } from 'react';
import { Check, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { api } from '@/lib/api';
import ResourceManager from '@/components/admin/ResourceManager';

const EVENTS = ['registration_start', 'registration_end', 'correction_window', 'admit_card', 'exam', 'answer_key', 'result', 'counselling'];
const label = (e: string) => e.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Important dates shown on /exams/calendar and the exam pages; students who follow the exam get a reminder 3 days and 1 day before.
// Dates are collected automatically from each exam's official website (server/src/services/examDates.js) — every one is
// kept only when the sentence it came from is on the official page. Admins just review: Approve or Reject (rejected = hidden for good).
export default function AdminExamDates() {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const runNow = async () => {
    setBusy(true); setMsg('');
    try { const r = await api('/api/admin/exam-dates/collect?limit=5', { method: 'POST' }); setMsg(r.skipped ? `Skipped: ${r.skipped}` : `Checked ${r.checked} official site(s), found ${r.added} new date(s).`); }
    catch (e: any) { setMsg(e.message); }
    setBusy(false);
  };
  const review = async (id: string, status: 'approved' | 'rejected', reload: () => void) => {
    await api(`/api/admin/exam_dates/${id}`, { method: 'PATCH', body: JSON.stringify({ review_status: status }) }); reload();
  };
  return (
    <>
    <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
      <p className="text-slate-600"><b>Automatic:</b> the server reads each exam’s official website (set on the exam) every 6 hours and adds the dates it finds. Your job is only to check the <b>Needs review</b> list.</p>
      <button onClick={runNow} disabled={busy} className="btn-ghost py-1.5 text-sm">{busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Check 5 exams now</button>
      {msg && <p className="w-full text-xs text-slate-500">{msg}</p>}
    </div>
    <ResourceManager resource="exam_dates" title="Exam dates (calendar & reminders)"
      defaults={{ event: 'exam', tentative: false, is_published: true }}
      quickFilters={[{ label: 'Needs review', params: { review_status: 'pending' } }, { label: 'All', params: {} }, { label: 'Exams', params: { event: 'exam' } }, { label: 'Last dates', params: { event: 'registration_end' } }, { label: 'Results', params: { event: 'result' } }]}
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
        { key: 'quote', label: 'Found on the official page', render: (r) => r.quote ? <p className="max-w-xs text-xs italic text-slate-600">“{r.quote}”</p> : <span className="text-xs text-slate-400">{r.origin === 'auto' ? '—' : 'added by admin'}</span> },
        { key: 'review_status', label: 'Status', render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.review_status === 'pending' ? 'bg-amber-50 text-amber-700' : r.review_status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{r.review_status === 'pending' ? 'Needs review' : r.review_status}{r.origin === 'auto' ? ' · auto' : ''}</span> },
        { key: 'date_start', label: 'Date', render: (r) => <span>{fmt(r.date_start)}{r.date_end ? ` – ${fmt(r.date_end)}` : ''}{r.tentative ? <span className="ms-1 text-xs text-amber-600">tentative</span> : null}</span> },
      ]}
      rowActions={(r, reload) => (
        <span className="flex items-center gap-1">
          {r.review_status === 'pending' && <>
            <button onClick={() => review(r.id, 'approved', reload)} className="btn-ghost px-2 py-1.5 text-emerald-600" title="Approve — date is correct"><Check size={14} /></button>
            <button onClick={() => review(r.id, 'rejected', reload)} className="btn-ghost px-2 py-1.5 text-rose-600" title="Reject — hide this date for good"><X size={14} /></button>
          </>}
          <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2 py-1.5" title="Official notice"><ExternalLink size={14} /></a>
        </span>)}
    />
    </>
  );
}
