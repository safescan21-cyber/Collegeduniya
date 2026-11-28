'use client';
import ModerationList from '@/components/admin/ModerationList';
import { timeAgo } from '@/lib/format';

export default function AdminCollegeApplications() {
  return (
    <ModerationList
      resource="college_applications" title="College applications" exportName="college_applications"
      statusField="status" noteField="admin_note" canDelete={false}
      statusOptions={['submitted', 'under_review', 'forwarded', 'accepted', 'rejected', 'withdrawn']}
      tabs={[{ label: 'New', params: { status: 'submitted' } }, { label: 'Under review', params: { status: 'under_review' } }, { label: 'Forwarded', params: { status: 'forwarded' } }, { label: 'All', params: {} }]}
      columns={[
        { key: 'student', label: 'Student', render: (r) => (
          <div><p className="font-semibold text-slate-900">{r.full_name}</p><a href={`tel:${r.phone}`} className="block text-xs text-slate-600">{r.phone}</a>
            <a href={`mailto:${r.email}`} className="text-xs text-brand-700">{r.email}</a><p className="text-xs text-slate-400">{[r.city, r.state].filter(Boolean).join(', ')}</p></div>) },
        { key: 'college', label: 'College & course', render: (r) => <div><a href={`/colleges/${r.colleges?.slug}`} target="_blank" className="font-medium text-brand-700">{r.colleges?.name}</a><p className="text-xs">{r.course}</p></div> },
        { key: 'academics', label: 'Academics', render: (r) => (
          <div className="text-xs text-slate-600"><p>{r.qualification} {r.percentage ? `· ${r.percentage}%` : ''} {r.passing_year ? `· ${r.passing_year}` : ''}</p>
            <p>{r.board_or_university}</p>{r.entrance_exam && <p>{r.entrance_exam}: {r.entrance_score}</p>}</div>) },
        { key: 'when', label: 'Applied', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
      ]}
    />
  );
}
