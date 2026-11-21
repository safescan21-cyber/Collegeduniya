'use client';
import ModerationList from '@/components/admin/ModerationList';
import { timeAgo } from '@/lib/format';

const TOPIC: Record<string, string> = { grievance: 'chip-red', privacy: 'chip-amber', correction: 'chip-brand' };

export default function AdminMessages() {
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Grievances must be acknowledged within 24 hours and resolved within 15 days (IT Rules, 2021). Privacy requests: within 90 days at most (DPDP Rules, 2025). Reply by email, then mark the message replied / resolved.</p>
      <ModerationList resource="contact_messages" title="Contact messages" statusField="status" noteField="admin_note" canDelete={false}
        statusOptions={['open', 'replied', 'resolved', 'spam']}
        tabs={[{ label: 'Open', params: { status: 'open' } }, { label: 'Grievances', params: { topic: 'grievance' } }, { label: 'Corrections', params: { topic: 'correction' } }, { label: 'Privacy', params: { topic: 'privacy' } }, { label: 'All', params: {} }]}
        columns={[
          { key: 'from', label: 'From', render: (r) => <div><p className="font-medium">{r.full_name}</p><a href={`mailto:${r.email}?subject=Re: your message to StudyEarnstay (${String(r.id).slice(0, 8).toUpperCase()})`} className="text-xs text-brand-700">{r.email}</a>{r.phone && <p className="text-xs text-slate-500">{r.phone}</p>}</div> },
          { key: 'topic', label: 'Topic', render: (r) => <div><span className={TOPIC[r.topic] || 'chip'}>{r.topic}</span>{r.about && <p className="mt-1 text-xs text-slate-500">{r.about}</p>}<p className="text-[10px] text-slate-400">Ref {String(r.id).slice(0, 8).toUpperCase()}</p></div> },
          { key: 'message', label: 'Message', render: (r) => <p className="max-w-lg whitespace-pre-wrap text-sm">{r.message}</p> },
          { key: 'when', label: 'Received', render: (r) => { const h = (Date.now() - new Date(r.created_at).getTime()) / 3600e3;
            return <span className={`text-xs ${r.status === 'open' && r.topic === 'grievance' && h > 20 ? 'font-bold text-rose-600' : 'text-slate-500'}`} title={new Date(r.created_at).toLocaleString('en-IN')}>{timeAgo(r.created_at)}</span>; } },
        ]} />
    </div>
  );
}
