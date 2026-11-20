'use client';
import ModerationList from '@/components/admin/ModerationList';
import { timeAgo } from '@/lib/format';

export default function AdminReports() {
  return (
    <ModerationList resource="reports" title="Reports from users" statusField="status" noteField="admin_note" canDelete={false}
      statusOptions={['open', 'actioned', 'dismissed']}
      tabs={[{ label: 'Open', params: { status: 'open' } }, { label: 'All', params: {} }]}
      columns={[
        { key: 'by', label: 'Reported by', render: (r) => <div><p className="font-medium">{r.profiles?.full_name}</p><p className="text-xs text-slate-500">{r.profiles?.email}</p></div> },
        { key: 'what', label: 'About', render: (r) => <div><span className="chip">{r.target_type}</span><p className="text-xs text-slate-400"><code>{r.target_id}</code></p></div> },
        { key: 'reason', label: 'Reason', render: (r) => <p className="max-w-md text-sm">{r.reason}</p> },
        { key: 'when', label: 'When', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
      ]} />
  );
}
