'use client';
import { useEffect, useState } from 'react';
import ModerationList from '@/components/admin/ModerationList';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

export default function AdminLeads() {
  const [partners, setPartners] = useState<Set<string>>(new Set());
  useEffect(() => { api('/api/admin/college_partners?limit=500').then((r) => setPartners(new Set((r.data || []).filter((p: any) => p.is_active).map((p: any) => p.college_id)))).catch(() => {}); }, []);
  return (
    <ModerationList
      extraActions={(r) => r.college_id && partners.has(r.college_id) ? (
        r.shared_at ? <span className="chip-green text-xs">Sent to college</span>
          : r.consent_share ? <button className="btn-primary py-1 text-xs" onClick={async () => { try { const x = await api(`/api/admin/leads/${r.id}/share`, { method: 'POST', body: JSON.stringify({ college_id: r.college_id }) }); alert(x.mailed ? 'Sent to the college by email.' : 'Marked as shared (email not configured).'); } catch (e: any) { alert(e.message); } }}>Send to college</button>
          : <span className="chip text-xs" title="The student did not agree to share their details">No consent</span>
      ) : null}
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
