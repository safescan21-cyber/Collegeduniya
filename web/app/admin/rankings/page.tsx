'use client';
import ResourceManager from '@/components/admin/ResourceManager';

export default function AdminRankings() {
  return (
    <ResourceManager resource="college_rankings" title="College rankings (NIRF etc.)" defaults={{ source: 'NIRF', category: 'Overall' }}
      fields={[
        { name: 'college_id', label: 'College', type: 'college', required: true, full: true },
        { name: 'source', label: 'Source', type: 'select', options: ['NIRF', 'QS', 'THE', 'ARWU', 'Other'] },
        { name: 'year', label: 'Year', type: 'number', required: true },
        { name: 'category', label: 'Category', type: 'text', placeholder: 'Overall, Engineering, Management…' },
        { name: 'rank', label: 'Rank (exact)', type: 'number' }, { name: 'rank_band', label: 'Rank band', type: 'text', placeholder: '101-150' },
        { name: 'score', label: 'Score', type: 'number' }, { name: 'source_url', label: 'Official page', type: 'text', full: true },
      ]}
      columns={[
        { key: 'college', label: 'College', render: (r) => r.colleges?.name }, { key: 'source', label: 'Source' }, { key: 'year', label: 'Year' },
        { key: 'category', label: 'Category' }, { key: 'rank', label: 'Rank', render: (r) => r.rank ?? r.rank_band }, { key: 'score', label: 'Score' },
      ]} />
  );
}
