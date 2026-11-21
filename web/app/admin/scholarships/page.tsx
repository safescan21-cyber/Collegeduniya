'use client';
import ResourceManager from '@/components/admin/ResourceManager';

export default function AdminScholarships() {
  return (
    <ResourceManager resource="scholarships" title="Scholarships" defaults={{ is_published: true }}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, full: true }, { name: 'provider', label: 'Provider', type: 'text' },
        { name: 'host_country', label: 'Study in (country code, blank = any)', type: 'text', placeholder: 'GB' },
        { name: 'for_nationalities', label: 'Only for nationalities (codes, blank = all)', type: 'tags', placeholder: 'IN, NP' },
        { name: 'levels', label: 'Levels', type: 'tags', placeholder: 'UG, PG, PhD' }, { name: 'field', label: 'Field', type: 'text' },
        { name: 'amount', label: 'Amount', type: 'number' }, { name: 'currency', label: 'Currency', type: 'text', placeholder: 'GBP' },
        { name: 'amount_note', label: 'Amount note', type: 'text', full: true, placeholder: 'Full tuition + monthly stipend' },
        { name: 'deadline', label: 'Deadline', type: 'date' },
        { name: 'eligibility', label: 'Eligibility', type: 'textarea' }, { name: 'how_to_apply', label: 'How to apply', type: 'textarea' },
        { name: 'official_url', label: 'Official URL (required)', type: 'text', required: true, full: true },
        { name: 'is_published', label: 'Published', type: 'bool' },
      ]}
      columns={[
        { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> }, { key: 'provider', label: 'Provider' },
        { key: 'host_country', label: 'Country' }, { key: 'deadline', label: 'Deadline' },
        { key: 'is_published', label: 'Status', render: (r) => (r.is_published ? <span className="chip-green">Live</span> : <span className="chip">Hidden</span>) },
      ]} />
  );
}
