'use client';
import { useEffect, useState } from 'react';
import ResourceManager from '@/components/admin/ResourceManager';
import { api } from '@/lib/api';
import { money } from '@/lib/format';

export default function AdminPartners() {
  const [sum, setSum] = useState<any[]>([]);
  useEffect(() => { api('/api/admin/partners/summary').then((r) => setSum(r.data)).catch(() => {}); }, []);
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h1 className="text-xl font-extrabold text-slate-900">Lead partners (colleges that pay per enquiry)</h1>
        <p className="mt-1 text-sm text-slate-600">Students are shared only when they tick “share my details with this college”. With auto-share on, their enquiry is emailed to the college immediately (needs SMTP_URL on the API).</p>
        {sum.length > 0 && (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400"><tr><th className="py-1">College</th><th>Leads this month</th><th>Price / lead</th><th>Amount due</th></tr></thead>
            <tbody>{sum.map((p) => <tr key={p.college_id} className="border-t border-slate-100"><td className="py-2">{p.colleges?.name}</td><td>{p.leads}</td><td>{p.lead_price != null ? money(p.lead_price, p.currency || 'INR') : '—'}</td><td className="font-semibold">{money(p.amount_due, p.currency || 'INR')}</td></tr>)}</tbody>
          </table>
        )}
      </div>
      <ResourceManager resource="college_partners" title="Partners" defaults={{ currency: 'INR', is_active: true, auto_share: false }}
        fields={[
          { name: 'college_id', label: 'College', type: 'college', required: true, full: true },
          { name: 'contact_name', label: 'Admission contact', type: 'text' }, { name: 'contact_email', label: 'Email (leads are sent here)', type: 'text' },
          { name: 'contact_phone', label: 'Phone', type: 'text' }, { name: 'lead_price', label: 'Price per lead', type: 'number' },
          { name: 'currency', label: 'Currency', type: 'text' }, { name: 'auto_share', label: 'Send consented enquiries automatically', type: 'bool' },
          { name: 'is_active', label: 'Active', type: 'bool' }, { name: 'notes', label: 'Agreement notes', type: 'textarea' },
        ]}
        columns={[{ key: 'college', label: 'College', render: (r) => r.colleges?.name }, { key: 'contact_email', label: 'Email' },
          { key: 'lead_price', label: 'Price', render: (r) => (r.lead_price != null ? money(r.lead_price, r.currency || 'INR') : '—') },
          { key: 'auto_share', label: 'Auto', render: (r) => (r.auto_share ? 'Yes' : 'No') }, { key: 'is_active', label: 'Active', render: (r) => (r.is_active ? 'Yes' : 'No') }]} />
    </div>
  );
}
