'use client';
import { ExternalLink } from 'lucide-react';
import ResourceManager from '@/components/admin/ResourceManager';

export default function AdminExams() {
  return (
    <ResourceManager resource="exams" title="Exams"
      defaults={{ level: 'UG', country: 'India', is_published: true }}
      fields={[
        { name: 'short_name', label: 'Short name', type: 'text', required: true, placeholder: 'JEE Main' },
        { name: 'slug', label: 'URL slug', type: 'text', help: 'Used by cutoffs & predictor — keep it stable' },
        { name: 'full_name', label: 'Full name', type: 'text', full: true },
        { name: 'stream', label: 'Stream', type: 'text', placeholder: 'Engineering' },
        { name: 'level', label: 'Level', type: 'select', options: ['UG', 'PG', 'Diploma', 'PhD', 'Abroad', 'Other'], required: true },
        { name: 'country', label: 'Country', type: 'text' },
        { name: 'conducting_body', label: 'Conducted by', type: 'text' },
        { name: 'mode', label: 'Mode', type: 'text', placeholder: 'Computer-based test' },
        { name: 'frequency', label: 'Frequency', type: 'text', placeholder: 'Twice a year' },
        { name: 'exam_date', label: 'Exam date (text)', type: 'text', placeholder: 'Jan & Apr 2027 (tentative)' },
        { name: 'website', label: 'Official website', type: 'text', full: true },
        { name: 'description', label: 'About', type: 'textarea' },
        { name: 'eligibility', label: 'Eligibility', type: 'textarea' },
        { name: 'pattern', label: 'Exam pattern', type: 'textarea' },
        { name: 'syllabus', label: 'Syllabus', type: 'textarea' },
        { name: 'registration', label: 'Registration', type: 'textarea' },
        { name: 'news_enabled', label: 'Collect news & email followers', type: 'bool' },
        { name: 'news_terms', label: 'Other names used in news (optional)', type: 'tags', placeholder: 'JEE Mains, JEE Main 2027', help: 'The short and full names are always searched. Add spellings newspapers use.' },
        { name: 'is_published', label: 'Published', type: 'bool' },
      ]}
      columns={[
        { key: 'short_name', label: 'Exam', render: (r) => <div><p className="font-semibold text-slate-900">{r.short_name}</p><p className="text-xs text-slate-500">{r.slug}</p></div> },
        { key: 'stream', label: 'Stream', render: (r) => `${r.stream || '—'} · ${r.level}` },
        { key: 'exam_date', label: 'Date', render: (r) => r.exam_date || '—' },
      ]}
      rowActions={(r) => <a href={`/exams/${r.slug}`} target="_blank" className="btn-ghost px-2 py-1.5"><ExternalLink size={14} /></a>}
    />
  );
}
