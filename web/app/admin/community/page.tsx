'use client';
import { useState } from 'react';
import ModerationList from '@/components/admin/ModerationList';
import { timeAgo } from '@/lib/format';

export default function AdminCommunity() {
  const [tab, setTab] = useState<'members' | 'roommates'>('members');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('members')} className={tab === 'members' ? 'btn-primary' : 'btn-ghost'}>College members</button>
        <button onClick={() => setTab('roommates')} className={tab === 'roommates' ? 'btn-primary' : 'btn-ghost'}>Roommate posts</button>
      </div>
      {tab === 'members' ? (
        <ModerationList resource="college_members" title="Students, alumni & aspirants" canDelete
          tabs={[{ label: 'Not verified', params: { is_verified: 'false' } }, { label: 'Verified', params: { is_verified: 'true' } }, { label: 'All', params: {} }]}
          extraActions={(r, patch) => <button className={r.is_verified ? 'btn-ghost py-1 text-xs' : 'btn-primary py-1 text-xs'} onClick={() => patch({ is_verified: !r.is_verified })}>{r.is_verified ? 'Unverify' : 'Verify'}</button>}
          columns={[
            { key: 'who', label: 'Person', render: (r) => <div><p className="font-medium">{r.profiles?.full_name}</p><p className="text-xs text-slate-500">{r.profiles?.email}</p></div> },
            { key: 'college', label: 'College', render: (r) => <a href={`/colleges/${r.colleges?.slug}#community`} target="_blank" className="text-brand-700">{r.colleges?.name}</a> },
            { key: 'rel', label: 'As', render: (r) => `${r.relation}${r.course ? ` · ${r.course}` : ''}${r.batch_year ? ` · ${r.batch_year}` : ''}` },
            { key: 'when', label: 'Joined', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
          ]} />
      ) : (
        <ModerationList resource="roommate_posts" title="Roommate posts" canDelete
          tabs={[{ label: 'Active', params: { is_active: 'true' } }, { label: 'All', params: {} }]}
          extraActions={(r, patch) => <button className="btn-ghost py-1 text-xs" onClick={() => patch({ is_active: !r.is_active })}>{r.is_active ? 'Hide' : 'Show'}</button>}
          columns={[
            { key: 'who', label: 'Posted by', render: (r) => <div><p className="font-medium">{r.profiles?.full_name}</p><p className="text-xs text-slate-500">{r.profiles?.email}</p></div> },
            { key: 'city', label: 'City' }, { key: 'about', label: 'Post', render: (r) => <p className="line-clamp-3 max-w-md text-sm">{r.about}</p> },
            { key: 'when', label: 'When', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
          ]} />
      )}
    </div>
  );
}
