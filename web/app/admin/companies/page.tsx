'use client';
import { BadgeCheck } from 'lucide-react';
import { extUrl, urlLabel } from '@/lib/extUrl';
import ModerationList from '@/components/admin/ModerationList';
import { timeAgo } from '@/lib/format';

export default function AdminCompanies() {
  return (
    <ModerationList resource="companies" title="Companies (employers)"
      tabs={[{ label: 'To verify', params: { is_verified: 'false' } }, { label: 'Verified', params: { is_verified: 'true' } }, { label: 'All', params: {} }]}
      extraActions={(r, patch) => (
        <button onClick={() => patch({ is_verified: !r.is_verified })} className={`btn-ghost px-2 py-1.5 text-xs ${r.is_verified ? 'text-emerald-700' : ''}`}>
          <BadgeCheck size={14} />{r.is_verified ? 'Verified' : 'Verify'}</button>
      )}
      columns={[
        { key: 'name', label: 'Company', render: (r) => (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.logo_url && <img src={r.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />}
            <div><a href={`/companies/${r.slug}`} target="_blank" className="font-semibold text-slate-900 hover:text-brand-700">{r.name}</a><p className="text-xs text-slate-500">{[r.industry, r.city, r.country].filter(Boolean).join(' · ')}</p></div>
          </div>) },
        { key: 'contact', label: 'Contact', render: (r) => <div className="text-xs"><p>{r.profiles?.full_name}</p><p>{r.contact_email || r.profiles?.email}</p><p>{r.contact_phone || r.profiles?.phone}</p></div> },
        { key: 'reg', label: 'Reg. / GST', render: (r) => <span className="text-xs">{r.registration_no || '—'}</span> },
        { key: 'web', label: 'Website', render: (r) => (extUrl(r.website) ? <a href={extUrl(r.website)!} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700">{r.website.replace(/^https?:\/\//, '').slice(0, 30)}</a> : '—') },
        { key: 'when', label: 'Joined', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
      ]} />
  );
}
