'use client';
import ResourceManager from '@/components/admin/ResourceManager';

export default function AdminVisaGuides() {
  return (
    <div className="space-y-4">
      <p className="card p-4 text-sm text-slate-600">Write each guide from the official immigration website and link it. Immigration rules change — review guides every few months.</p>
      <ResourceManager resource="visa_guides" title="Student visa guides" defaults={{ is_published: true }}
        fields={[
          { name: 'country_code', label: 'Country code', type: 'text', required: true, placeholder: 'GB' },
          { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'UK Student visa for Indian students' },
          { name: 'summary', label: 'Summary', type: 'textarea' },
          { name: 'processing_time', label: 'Processing time', type: 'text' }, { name: 'fee_note', label: 'Fees', type: 'text' },
          { name: 'work_rights', label: 'Work while studying', type: 'text', full: true },
          { name: 'body', label: 'Guide (Markdown: steps, documents, money proof, interview…)', type: 'textarea' },
          { name: 'official_url', label: 'Official immigration website (required)', type: 'text', required: true, full: true },
          { name: 'is_published', label: 'Published', type: 'bool' },
        ]}
        columns={[{ key: 'country_code', label: 'Country' }, { key: 'title', label: 'Title' }, { key: 'updated_at', label: 'Updated', render: (r) => new Date(r.updated_at).toLocaleDateString() }]} />
    </div>
  );
}
