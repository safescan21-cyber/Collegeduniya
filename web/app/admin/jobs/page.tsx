'use client';
import Link from 'next/link';
import { FileText, Check, Ban } from 'lucide-react';
import { api } from '@/lib/api';
import ResourceManager from '@/components/admin/ResourceManager';
import { range } from '@/lib/format';

export default function AdminJobs() {
  return (
    <ResourceManager
      resource="jobs"
      title="Jobs"
      quickFilters={[{ label: 'All', params: {} }, { label: 'Pending approval', params: { approval_status: 'pending' } }, { label: 'Rejected', params: { approval_status: 'rejected' } }]}
      defaults={{ job_type: 'Part-time', currency: 'INR', pay_unit: 'month', status: 'open', is_published: true, country: 'India' }}
      fields={[
        { name: 'title', label: 'Job title', type: 'text', required: true, full: true },
        { name: 'company', label: 'Company', type: 'text', required: true },
        { name: 'job_type', label: 'Type', type: 'select', options: ['Part-time', 'Internship', 'Weekend', 'Freelance', 'Full-time'], required: true },
        { name: 'college_id', label: 'Near college', type: 'college' },
        { name: 'country', label: 'Country', type: 'text', required: true },
        { name: 'city', label: 'City', type: 'text', required: true },
        { name: 'address', label: 'Area / address', type: 'text' },
        { name: 'is_remote', label: 'Remote job', type: 'bool' },
        { name: 'latitude', label: 'Latitude', type: 'number' },
        { name: 'longitude', label: 'Longitude', type: 'number' },
        { name: 'pay_min', label: 'Pay from', type: 'number' },
        { name: 'pay_max', label: 'Pay up to', type: 'number' },
        { name: 'currency', label: 'Currency', type: 'select', options: ['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SGD', 'NZD'], required: true },
        { name: 'pay_unit', label: 'Per', type: 'select', options: ['hour', 'day', 'week', 'month', 'project'], required: true },
        { name: 'hours_per_week', label: 'Hours / week', type: 'number' },
        { name: 'deadline', label: 'Apply by', type: 'date' },
        { name: 'skills', label: 'Skills', type: 'tags', full: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'requirements', label: 'Requirements', type: 'textarea' },
        { name: 'company_logo', label: 'Company logo', type: 'image' },
        { name: 'contact_phone', label: 'Contact phone', type: 'text' },
        { name: 'contact_email', label: 'Contact email', type: 'text' },
        { name: 'status', label: 'Status', type: 'select', options: ['open', 'closed'], required: true },
        { name: 'approval_status', label: 'Approval', type: 'select', options: ['approved', 'pending', 'rejected'] },
        { name: 'is_published', label: 'Published', type: 'bool' },
      ]}
      columns={[
        { key: 'title', label: 'Job', render: (r) => <div><p className="font-semibold text-slate-900">{r.title}</p><p className="text-xs text-slate-500">{r.company} · {r.is_remote ? 'Remote' : r.city}</p></div> },
        { key: 'job_type', label: 'Type' },
        { key: 'pay', label: 'Pay', render: (r) => `${range(r.pay_min, r.pay_max, r.currency)} / ${r.pay_unit}` },
        { key: 'approval_status', label: 'Approval', render: (r) => r.approval_status === 'pending' ? <span className="chip-amber">Pending</span> : r.approval_status === 'rejected' ? <span className="chip-red">Rejected</span> : <span className="chip-green">Approved</span> },
        { key: 'status', label: 'Status', render: (r) => (r.status === 'open' ? <span className="chip-green">Open</span> : <span className="chip-red">Closed</span>) },
      ]}
      rowActions={(r, reload) => (
        <>
          {((r, reload) => r.approval_status === 'pending' ? (
        <>
          <button onClick={async () => { await api(`/api/admin/jobs/${r.id}`, { method: 'PATCH', body: JSON.stringify({ approval_status: 'approved' }) }).catch((e) => alert(e.message)); reload(); }} className="btn-ghost px-2 py-1.5 text-emerald-700" title="Approve"><Check size={14} /></button>
          <button onClick={async () => { await api(`/api/admin/jobs/${r.id}`, { method: 'PATCH', body: JSON.stringify({ approval_status: 'rejected' }) }).catch((e) => alert(e.message)); reload(); }} className="btn-ghost px-2 py-1.5 text-rose-600" title="Reject"><Ban size={14} /></button>
        </>
      ) : null)(r, reload)}
          <Link href={`/admin/applications?job_id=${r.id}`} className="btn-ghost px-2 py-1.5" title="Applications"><FileText size={14} /></Link>
        </>
      )}
    />
  );
}
