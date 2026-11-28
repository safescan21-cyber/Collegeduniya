'use client';
import ModerationList from '@/components/admin/ModerationList';
import { timeAgo } from '@/lib/format';

export default function AdminAmbassadors() {
  return (
    <ModerationList resource="ambassadors" idKey="user_id" title="Campus ambassadors" statusField="status" noteField="admin_note"
      statusOptions={['applied', 'approved', 'rejected', 'paused']}
      tabs={[{ label: 'New', params: { status: 'applied' } }, { label: 'Approved', params: { status: 'approved' } }, { label: 'All', params: {} }]}
      columns={[
        { key: 'who', label: 'Student', render: (r) => <div><p className="font-medium">{r.profiles?.full_name}</p><p className="text-xs text-slate-500">{r.profiles?.email} · {r.profiles?.phone}</p><p className="text-xs text-slate-400">Code {r.profiles?.referral_code}</p></div> },
        { key: 'college', label: 'College', render: (r) => <div><p>{r.colleges?.name || r.college_name}</p><p className="text-xs text-slate-500">{r.city}{r.year_of_study ? ` · year ${r.year_of_study}` : ''}{r.instagram ? ` · ${r.instagram}` : ''}</p></div> },
        { key: 'why', label: 'Why', render: (r) => <p className="max-w-sm text-sm">{r.why}</p> },
        { key: 'when', label: 'Applied', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
      ]} />
  );
}
