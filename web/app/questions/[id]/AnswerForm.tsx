'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function AnswerForm({ questionId }: { questionId: string }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!user) return <div className="card flex items-center justify-between gap-3 p-5"><p className="text-slate-700">Know the answer? Help a fellow student.</p><Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-primary">Login to answer</Link></div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 5) return setErr('Answer is too short.');
    setBusy(true); setErr('');
    const { error } = await supabase.from('answers').insert({ question_id: questionId, user_id: user.id, body: body.trim() });
    setBusy(false);
    if (error) return setErr(error.message);
    setBody('');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <h3 className="font-semibold text-slate-900">Your answer</h3>
      <textarea rows={4} maxLength={4000} className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share what you know — be specific and kind." />
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button disabled={busy} className="btn-primary">{busy ? 'Posting…' : 'Post answer'}</button>
    </form>
  );
}
