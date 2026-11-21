'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessagesSquare } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';
import type { QuestionPublic } from '@/lib/types';

// Ask-a-question form (+ optional list). Used on /questions and on college pages.
export function AskForm({ collegeId, collegeName, onDone }: { collegeId?: string; collegeName?: string; onDone?: (id: string) => void }) {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!user) {
    return (
      <div className="card flex flex-col items-center justify-between gap-3 p-5 sm:flex-row">
        <p className="text-slate-700">Have a question{collegeName ? ` about ${collegeName}` : ''}? Students and our experts will answer.</p>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-primary shrink-0">Login to ask</Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 10) return setErr('Please write at least 10 characters.');
    setBusy(true); setErr('');
    const { data, error } = await supabase.from('questions')
      .insert({ user_id: user.id, college_id: collegeId || null, title: title.trim(), body: body.trim() || null })
      .select('id').single();
    setBusy(false);
    if (error) return setErr(error.message);
    setTitle(''); setBody('');
    if (onDone) onDone(data.id); else router.push(`/questions/${data.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <h3 className="font-semibold text-slate-900">Ask a question{collegeName ? ` about ${collegeName}` : ''}</h3>
      <input className="input" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Is hostel compulsory in first year?" />
      <textarea className="input" rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add details (optional)" />
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Posting as {profile?.full_name?.split(' ')[0] || 'Student'}</span>
        <button disabled={busy} className="btn-primary">{busy ? 'Posting…' : 'Post question'}</button>
      </div>
    </form>
  );
}

export function QuestionList({ items, showCollege = true }: { items: QuestionPublic[]; showCollege?: boolean }) {
  if (!items.length) return <p className="text-sm text-slate-500">No questions yet — be the first to ask.</p>;
  return (
    <ul className="card divide-y divide-slate-100">
      {items.map((q) => (
        <li key={q.id}>
          <Link href={`/questions/${q.id}`} className="flex items-start gap-3 p-4 hover:bg-slate-50">
            <MessagesSquare size={18} className="mt-0.5 shrink-0 text-brand-600" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{q.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {q.asker_name} · {timeAgo(q.created_at)}{showCollege && q.college_name ? ` · ${q.college_name}` : ''}
              </p>
            </div>
            <span className={q.answer_count ? 'chip-green' : 'chip'}>{q.answer_count} answer{q.answer_count === 1 ? '' : 's'}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
