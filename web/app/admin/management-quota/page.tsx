'use client';
import Link from 'next/link';
import ResourceManager from '@/components/admin/ResourceManager';
import { QUOTA_SEAT_FIELDS, QUOTA_SEAT_COLUMNS, QUOTA_SEAT_DEFAULTS } from '@/components/admin/quotaSeatFields';

export default function AdminManagementQuota() {
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Management quota seats</h1>
          <p className="text-sm text-slate-500">Post management / NRI quota seats with the college&apos;s official fee. Students apply on the website; applications arrive in <Link href="/admin/quota-applications" className="text-brand-700 underline">Quota applications</Link>.</p>
        </div>
        <a href="/management-quota" target="_blank" className="btn-ghost">View public page</a>
      </div>
      <ResourceManager resource="quota_seats" title="Seats" fields={QUOTA_SEAT_FIELDS()} columns={QUOTA_SEAT_COLUMNS()} defaults={QUOTA_SEAT_DEFAULTS}
        quickFilters={[{ label: 'Open', params: { status: 'open' } }, { label: 'Filled', params: { status: 'filled' } }, { label: 'Closed', params: { status: 'closed' } }, { label: 'All', params: {} }]}
        rowActions={(r) => <a href={`/management-quota/${r.id}`} target="_blank" className="btn-ghost py-1 text-xs">View</a>} />
    </div>
  );
}
