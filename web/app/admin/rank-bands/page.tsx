'use client';
import ResourceManager from '@/components/admin/ResourceManager';

export default function AdminRankBands() {
  return (
    <div className="space-y-4">
      <div className="card p-5 text-sm text-slate-600"><h1 className="text-xl font-extrabold text-slate-900">Marks → rank data</h1>
        <p className="mt-1">Add marks ranges and the ranks they got, from official result statistics or the exam body’s published analysis. Each row: “marks 200–250 → rank 2,000–500”. The predictor interpolates inside a row and always uses the latest year. Always note the source.</p></div>
      <ResourceManager resource="rank_bands" title="Bands" defaults={{ category: 'All' }}
        fields={[
          { name: 'exam_slug', label: 'Exam slug', type: 'text', required: true, placeholder: 'jee-main' },
          { name: 'year', label: 'Year', type: 'number', required: true },
          { name: 'category', label: 'Category (All, General, OBC-NCL…)', type: 'text' },
          { name: 'marks_from', label: 'Marks from', type: 'number', required: true },
          { name: 'marks_to', label: 'Marks to', type: 'number', required: true },
          { name: 'rank_from', label: 'Rank at “marks from” (worse)', type: 'number', required: true },
          { name: 'rank_to', label: 'Rank at “marks to” (better)', type: 'number', required: true },
          { name: 'source', label: 'Source', type: 'text', full: true, required: true },
        ]}
        columns={[
          { key: 'exam_slug', label: 'Exam' }, { key: 'year', label: 'Year' }, { key: 'category', label: 'Category' },
          { key: 'marks', label: 'Marks', render: (r) => `${r.marks_from}–${r.marks_to}` }, { key: 'rank', label: 'Rank', render: (r) => `${r.rank_from.toLocaleString()} → ${r.rank_to.toLocaleString()}` },
          { key: 'source', label: 'Source' },
        ]} />
    </div>
  );
}
