'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellPlus, BellRing, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function FollowExam({ examId, name, slug }: { examId: string; name: string; slug: string }) {
  const { user } = useAuth();
  const [on, setOn] = useState<boolean | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => {
    if (!user) { setOn(false); return; }
    supabaseBrowser().from('exam_follows').select('email').eq('user_id', user.id).eq('exam_id', examId).maybeSingle()
      .then(({ data }: { data: { email: boolean } | null }) => setOn(!!data?.email));
  }, [user, examId]);
  if (!user) return (
    <Link href={`/login?next=/exams/${slug}`} className="btn-ghost w-full"><BellPlus size={16} />Get {name} news by email</Link>
  );
  const toggle = async () => {
    setBusy(true); setErr('');
    const sb = supabaseBrowser();
    const { error } = on
      ? await sb.from('exam_follows').update({ email: false }).eq('user_id', user.id).eq('exam_id', examId)
      : await sb.from('exam_follows').upsert({ user_id: user.id, exam_id: examId, email: true }, { onConflict: 'user_id,exam_id' });
    if (error) setErr(error.message); else setOn(!on);
    setBusy(false);
  };
  return (
    <div>
      <button onClick={toggle} disabled={busy || on === null} className={`${on ? 'btn-ghost' : 'btn-primary'} w-full`} aria-pressed={!!on}>
        {busy || on === null ? <Loader2 size={16} className="animate-spin" /> : on ? <BellRing size={16} /> : <BellPlus size={16} />}
        {on ? `Emailing you ${name} news` : `Get ${name} news by email`}
      </button>
      <p className="mt-1 text-center text-xs text-slate-500">{on ? 'At most one email a day. Click again to stop.' : 'Results, admit cards, dates — at most one email a day.'}</p>
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
