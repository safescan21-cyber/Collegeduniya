'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ExternalLink, EyeOff, Eye, Settings2 } from 'lucide-react';
import ResourceManager from '@/components/admin/ResourceManager';
import { api } from '@/lib/api';
import { COLLEGE_FIELDS, HIDEABLE_FIELDS, HIDEABLE_SECTIONS } from '@/lib/adminFields';
import { range } from '@/lib/format';

const bulk = (action: string, values?: string[]) => async (ids: string[]) => {
  await api('/api/admin/colleges/bulk', { method: 'POST', body: JSON.stringify({ ids, action, values }) });
};

export default function AdminColleges() {
  const router = useRouter();
  const [hideWhat, setHideWhat] = useState('fees');
  const isSection = HIDEABLE_SECTIONS.some((s) => s.key === hideWhat);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <span className="font-semibold text-slate-700">Bulk show / hide:</span>
        <select value={hideWhat} onChange={(e) => setHideWhat(e.target.value)} className="input w-auto py-1.5 text-sm">
          <optgroup label="Fields">{HIDEABLE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>
          <optgroup label="Sections">{HIDEABLE_SECTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>
        </select>
        <span className="text-slate-500">— tick colleges below, then use the buttons that appear above the table.</span>
      </div>
      <ResourceManager
        resource="colleges"
        title="Colleges"
        fields={COLLEGE_FIELDS}
        defaults={{ type: 'Private', currency: 'INR', is_published: true, country: 'India' }}
        onEditRow={(r) => router.push(`/admin/colleges/${r.id}`)}
        quickFilters={[
          { label: 'All', params: {} }, { label: 'Visible', params: { is_published: 'true' } }, { label: 'Hidden', params: { is_published: 'false' } },
          { label: 'Featured', params: { is_featured: 'true' } }, { label: 'Added by us', params: { source: 'admin' } },
          { label: 'AISHE', params: { source: 'aishe' } }, { label: 'Hipolabs', params: { source: 'hipolabs' } }, { label: 'US Scorecard', params: { source: 'scorecard' } },
        ]}
        bulkActions={[
          { label: 'Show on site', run: bulk('publish') },
          { label: 'Hide from site', run: bulk('hide') },
          { label: 'Feature', run: bulk('feature') },
          { label: 'Unfeature', run: bulk('unfeature') },
          { label: `Hide “${[...HIDEABLE_FIELDS, ...HIDEABLE_SECTIONS].find((x) => x.key === hideWhat)?.label}”`, run: (ids) => bulk(isSection ? 'hide_sections' : 'hide_fields', [hideWhat])(ids) },
          { label: `Show “${[...HIDEABLE_FIELDS, ...HIDEABLE_SECTIONS].find((x) => x.key === hideWhat)?.label}”`, run: (ids) => bulk(isSection ? 'show_sections' : 'show_fields', [hideWhat])(ids) },
          { label: 'Delete', danger: true, run: bulk('delete') },
        ]}
        columns={[
          { key: 'name', label: 'College', render: (r) => (
            <div><Link href={`/admin/colleges/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{r.name}</Link>
              <p className="text-xs text-slate-500">{[r.city, r.state, r.country].filter((x) => x && x !== 'Not specified').join(', ')}{r.source && r.source !== 'admin' ? ` · ${r.source}` : ''}</p></div>) },
          { key: 'fees', label: 'Fees', render: (r) => <span className={(r.hidden_fields || []).includes('fees') ? 'text-slate-400 line-through' : ''}>{range(r.fees_min, r.fees_max, r.currency)}</span> },
          { key: 'is_published', label: 'Status', render: (r) => (
            <div className="flex flex-wrap gap-1">
              {r.is_published ? <span className="chip-green"><Eye size={12} />Visible</span> : <span className="chip"><EyeOff size={12} />Hidden</span>}
              {r.is_featured && <span className="chip-amber">Featured</span>}
              {((r.hidden_fields || []).length + (r.hidden_sections || []).length) > 0 && <span className="chip" title={[...(r.hidden_fields || []), ...(r.hidden_sections || [])].join(', ')}>{(r.hidden_fields || []).length + (r.hidden_sections || []).length} hidden parts</span>}
            </div>) },
        ]}
        rowActions={(r) => (
          <>
            <Link href={`/admin/colleges/${r.id}`} className="btn-ghost px-2 py-1.5" title="Full editor & visibility"><Settings2 size={14} /></Link>
            {r.is_published && <a href={`/colleges/${r.slug}`} target="_blank" className="btn-ghost px-2 py-1.5" title="View"><ExternalLink size={14} /></a>}
          </>
        )}
      />
    </div>
  );
}
