'use client';
import { useState } from 'react';
import Link from 'next/link';
import ModerationList from '@/components/admin/ModerationList';
import ContentReports from '@/components/admin/ContentReports';
import { mediaUrl } from '@/lib/mediaUrl';
import { timeAgo } from '@/lib/format';

const when = (r: any) => <span className="text-xs text-slate-500" title={new Date(r.created_at).toLocaleString('en-IN')}>{new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}<br />{timeAgo(r.created_at)}</span>;
const who = (r: any) => <div><p className="font-medium">{r.profiles?.full_name}{r.profiles?.username ? <span className="text-slate-400"> @{r.profiles.username}</span> : null}</p><p className="text-xs text-slate-500">{r.profiles?.email}</p></div>;

export default function AdminFeed() {
  const [tab, setTab] = useState<'reports' | 'posts' | 'comments'>('reports');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">{([['reports', 'Reports'], ['posts', 'Posts & blogs'], ['comments', 'Comments']] as const).map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} className={tab === k ? 'btn-primary' : 'btn-ghost'}>{l}</button>))}</div>
      {tab === 'reports' && <ContentReports />}
      {tab === 'posts' && (
        <ModerationList resource="posts" title="Community posts" statusField="status" statusOptions={['published', 'hidden', 'removed']} noteField="hidden_reason"
          tabs={[{ label: 'Published', params: { status: 'published' } }, { label: 'Hidden', params: { status: 'hidden' } }, { label: 'All', params: {} }]}
          columns={[
            { key: 'who', label: 'Posted by', render: who },
            { key: 'post', label: 'Post', render: (r) => (
              <div className="max-w-lg">
                <p className="text-xs"><span className="chip">{r.kind}</span> {r.colleges?.name}</p>
                {r.title && <p className="font-semibold">{r.title}</p>}
                <p className="line-clamp-3 text-sm">{r.body}</p>
                {r.media?.length > 0 && <div className="mt-1 flex gap-1">{r.media.slice(0, 4).map((m: any) => m.type === 'image'
                  ? <a key={m.path} href={mediaUrl(m.path)} target="_blank" rel="noopener"><img src={mediaUrl(m.path)} alt="" className="h-12 w-12 rounded object-cover" /></a>
                  : <a key={m.path} href={mediaUrl(m.path)} target="_blank" rel="noopener" className="chip">video</a>)}</div>}
                {r.place && <p className="text-xs text-slate-500">📍 {r.place}</p>}
                <Link href={`/community/post/${r.id}`} target="_blank" className="text-xs text-brand-700">Open</Link>
              </div>) },
            { key: 'n', label: '👍 / 👎 / 💬', render: (r) => <span className="text-xs">{r.likes} / {r.dislikes} / {r.comments}</span> },
            { key: 'when', label: 'When', render: when },
          ]} />)}
      {tab === 'comments' && (
        <ModerationList resource="post_comments" title="Comments" statusField="status" statusOptions={['published', 'hidden']}
          tabs={[{ label: 'All', params: {} }, { label: 'Hidden', params: { status: 'hidden' } }]}
          columns={[
            { key: 'who', label: 'By', render: who },
            { key: 'body', label: 'Comment', render: (r) => <div className="max-w-lg"><p className="text-sm">{r.body}</p><Link href={`/community/post/${r.post_id}`} target="_blank" className="text-xs text-brand-700">On post</Link></div> },
            { key: 'when', label: 'When', render: when },
          ]} />)}
    </div>
  );
}
