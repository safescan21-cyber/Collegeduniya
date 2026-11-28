'use client';
import ModerationList from '@/components/admin/ModerationList';

export default function AdminPgVisits() {
  return (
    <ModerationList resource="hostel_visits" title="PG visit requests" exportName="hostel_visits" statusField="status" noteField="owner_note" canDelete={false}
      statusOptions={['requested', 'confirmed', 'done', 'cancelled', 'no_show']}
      tabs={[{ label: 'Requested', params: { status: 'requested' } }, { label: 'Confirmed', params: { status: 'confirmed' } }, { label: 'All', params: {} }]}
      columns={[
        { key: 'pg', label: 'PG', render: (r) => <a href={`/hostels/${r.hostel_id}`} target="_blank" className="text-brand-700">{r.hostels?.name}, {r.hostels?.city}</a> },
        { key: 'who', label: 'Student', render: (r) => <div><p className="font-medium">{r.name}</p><a href={`tel:${r.phone}`} className="text-xs">{r.phone}</a></div> },
        { key: 'when', label: 'Visit', render: (r) => `${r.visit_date}${r.slot ? ` · ${r.slot}` : ''}${r.mode === 'video_call' ? ' · video' : ''}` },
      ]} />
  );
}
