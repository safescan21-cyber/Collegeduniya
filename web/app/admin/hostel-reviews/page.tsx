'use client';
import ModerationList from '@/components/admin/ModerationList';
import { Stars } from '@/components/Cards';
import { timeAgo } from '@/lib/format';

export default function AdminHostelReviews() {
  return (
    <ModerationList resource="hostel_reviews" title="PG / hostel reviews" statusField="status" statusOptions={['approved', 'pending', 'blocked']}
      tabs={[{ label: 'All', params: {} }, { label: 'Blocked', params: { status: 'blocked' } }]}
      columns={[
        { key: 'hostel', label: 'PG / hostel', render: (r) => <a href={`/hostels/${r.hostel_id}`} target="_blank" className="font-medium text-brand-700">{r.hostels?.name}<span className="block text-xs text-slate-400">{r.hostels?.city}</span></a> },
        { key: 'review', label: 'Review', className: 'max-w-md', render: (r) => <div><Stars value={r.rating} /><p className="mt-1 line-clamp-3 text-slate-700">{r.body}</p></div> },
        { key: 'by', label: 'By', render: (r) => <span className="text-xs">{r.profiles?.full_name}<br />{r.profiles?.email}<br />{timeAgo(r.created_at)}</span> },
      ]} />
  );
}
