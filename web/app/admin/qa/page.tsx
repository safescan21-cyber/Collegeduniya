'use client';
import { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import ModerationList from '@/components/admin/ModerationList';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

function ReplyBox({ questionId }: { questionId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  if (done) return <span className="chip-green">Answered</span>;
  if (!open) return <button onClick={() => setOpen(true)} className="btn-ghost px-2 py-1.5 text-xs">Answer</button>;
  return (
    <div className="flex w-72 flex-col gap-1">
      <textarea rows={3} className="input text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="Official answer…" />
      <button className="btn-primary py-1 text-xs" onClick={async () => {
        const sb = supabaseBrowser();
        const { data, error } = await sb.from('answers').insert({ question_id: questionId, user_id: user!.id, body: text }).select('id').single();
        if (error) return alert(error.message);
        await sb.from('answers').update({ is_official: true }).eq('id', data.id);
        setDone(true);
      }}>Post as expert answer</button>
    </div>
  );
}

export default function AdminQA() {
  const [view, setView] = useState<'questions' | 'answers'>('questions');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setView('questions')} className={view === 'questions' ? 'btn-primary' : 'btn-ghost'}>Questions</button>
        <button onClick={() => setView('answers')} className={view === 'answers' ? 'btn-primary' : 'btn-ghost'}>Answers</button>
      </div>
      {view === 'questions' ? (
        <ModerationList key="q" resource="questions" title="Questions" statusField="status" statusOptions={['approved', 'pending', 'blocked']}
          tabs={[{ label: 'All', params: {} }, { label: 'Blocked', params: { status: 'blocked' } }]}
          extraActions={(r) => <ReplyBox questionId={r.id} />}
          columns={[
            { key: 'title', label: 'Question', className: 'max-w-md', render: (r) => <div><a href={`/questions/${r.id}`} target="_blank" className="font-medium text-slate-900 hover:text-brand-700">{r.title}</a>{r.colleges && <p className="text-xs text-brand-700">{r.colleges.name}</p>}</div> },
            { key: 'by', label: 'By', render: (r) => <span className="text-xs">{r.profiles?.full_name}<br />{r.profiles?.email}</span> },
            { key: 'when', label: 'When', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
          ]} />
      ) : (
        <ModerationList key="a" resource="answers" title="Answers" statusField="status" statusOptions={['approved', 'pending', 'blocked']}
          extraActions={(r, patch) => (
            <button onClick={() => patch({ is_official: !r.is_official })} className={`btn-ghost px-2 py-1.5 text-xs ${r.is_official ? 'text-emerald-700' : ''}`}>
              <BadgeCheck size={14} />{r.is_official ? 'Expert' : 'Mark expert'}</button>
          )}
          columns={[
            { key: 'body', label: 'Answer', className: 'max-w-md', render: (r) => <div><p className="text-xs text-slate-400">Q: {r.questions?.title}</p><p className="line-clamp-3 text-slate-700">{r.body}</p></div> },
            { key: 'by', label: 'By', render: (r) => <span className="text-xs">{r.profiles?.full_name}<br />{r.profiles?.email}</span> },
            { key: 'when', label: 'When', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
          ]} />
      )}
    </div>
  );
}
