'use client';
import ModerationList from '@/components/admin/ModerationList';
import { timeAgo } from '@/lib/format';

export default function AdminLeads() {
  return (
    <ModerationList
      resource="leads" title="Leads & enquiries" exportName="leads" statusField="status" noteField="admin_note"
      statusOptions={['new', 'contacted', 'converted', 'closed']}
      tabs={[{ label: 'New', params: { status: 'new' } }, { label: 'Contacted', params: { status: 'contacted' } }, { label: 'Converted', params: { status: 'converted' } }, { label: 'All', params: {} }]}
      columns={[
        { key: 'who', label: 'Person', render: (r) => (
          <div><p className="font-semibold text-slate-900">{r.full_name}</p>
            <a href={`tel:${r.phone}`} className="block text-xs text-slate-600">{r.phone}</a>
            <a href={`https://wa.me/${String(r.phone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700">WhatsApp</a>
            {r.email && <a href={`mailto:${r.email}`} className="ml-2 text-xs text-brand-700">{r.email}</a>}</div>) },
        { key: 'kind', label: 'Type', render: (r) => (
          <div><span className="chip capitalize">{r.kind}</span>
            {r.colleges && <p className="mt-1 text-xs text-brand-700">{r.colleges.name}</p>}
            {r.hostels && <p className="mt-1 text-xs text-brand-700">{r.hostels.name}</p>}</div>) },
        { key: 'interest', label: 'Interest', render: (r) => <div className="text-xs text-slate-600"><p>{r.course_interest || '—'}</p><p>{r.city}</p></div> },
        { key: 'message', label: 'Message', className: 'max-w-xs', render: (r) => <p className="line-clamp-3 text-xs text-slate-600">{r.message || '—'}</p> },
        { key: 'when', label: 'When', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}<br />{r.source_path}</span> },
      ]}
    />
  );
}
