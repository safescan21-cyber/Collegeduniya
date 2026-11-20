'use client';
import ResourceManager from '@/components/admin/ResourceManager';

const KINDS = ['question_paper', 'answer_key', 'solution', 'syllabus', 'date_sheet', 'notice', 'sample_paper', 'analysis'];

export default function AdminExamLibrary() {
  return (
    <div className="space-y-8">
      <div className="card p-5 text-sm text-slate-600">
        <h1 className="text-xl font-extrabold text-slate-900">Exam library</h1>
        <p className="mt-1">Previous-year papers, official answer keys, syllabi, board date sheets and notices. Only upload documents the exam body has <b>published publicly</b>, and always paste the official page in “Source URL”. Third-party solutions/analysis need the author’s permission.</p>
      </div>
      <ResourceManager resource="exam_resources" title="Documents" defaults={{ kind: 'question_paper', is_published: true, year: new Date().getFullYear() }}
        quickFilters={[{ label: 'All', params: {} }, { label: 'Papers', params: { kind: 'question_paper' } }, { label: 'Answer keys', params: { kind: 'answer_key' } }, { label: 'Date sheets', params: { kind: 'date_sheet' } }]}
        fields={[
          { name: 'exam_slug', label: 'Exam slug', type: 'text', required: true, placeholder: 'jee-main, cbse-class-12' },
          { name: 'kind', label: 'Type', type: 'select', options: KINDS, required: true },
          { name: 'title', label: 'Title', type: 'text', required: true, full: true, placeholder: 'JEE Main 2025 — 22 January Shift 1 (Paper 1)' },
          { name: 'year', label: 'Year', type: 'number' },
          { name: 'session', label: 'Session / shift / subject', type: 'text', placeholder: 'January, Shift 1' },
          { name: 'file_url', label: 'File (PDF)', type: 'file' },
          { name: 'source_url', label: 'Official source URL (required)', type: 'text', required: true, full: true },
          { name: 'is_published', label: 'Published', type: 'bool' },
        ]}
        columns={[
          { key: 'title', label: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
          { key: 'exam_slug', label: 'Exam' }, { key: 'kind', label: 'Type', render: (r) => <span className="chip">{r.kind.replace('_', ' ')}</span> },
          { key: 'year', label: 'Year' }, { key: 'downloads', label: 'Downloads' },
          { key: 'is_published', label: 'Status', render: (r) => (r.is_published ? <span className="chip-green">Live</span> : <span className="chip">Hidden</span>) },
        ]} />

      <div className="card p-5 text-sm text-slate-600">
        <h2 className="text-lg font-bold text-slate-900">Candidates per exam (percentile → rank)</h2>
        <p className="mt-1">Enter the number of candidates from the official result press release (e.g. NTA’s JEE Main result notice, CAT result announcement). The percentile tool uses <i>rank ≈ (100 − percentile) × candidates ÷ 100</i>. Without a row here, the tool stays hidden.</p>
      </div>
      <ResourceManager resource="exam_stats" title="Candidate counts" defaults={{ session: 'All', year: new Date().getFullYear() }}
        fields={[
          { name: 'exam_slug', label: 'Exam slug', type: 'text', required: true, placeholder: 'jee-main' },
          { name: 'year', label: 'Year', type: 'number', required: true },
          { name: 'session', label: 'Session', type: 'text', placeholder: 'All / January / April' },
          { name: 'total_candidates', label: 'Candidates (appeared)', type: 'number', required: true },
          { name: 'source', label: 'Source (official notice URL or title)', type: 'text', required: true, full: true },
        ]}
        columns={[
          { key: 'exam_slug', label: 'Exam' }, { key: 'year', label: 'Year' }, { key: 'session', label: 'Session' },
          { key: 'total_candidates', label: 'Candidates', render: (r) => Number(r.total_candidates).toLocaleString() }, { key: 'source', label: 'Source' },
        ]} />
    </div>
  );
}
