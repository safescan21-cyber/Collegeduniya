'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, PlayCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function StartTest({ slug, ready, needed, attempts }: { slug: string; ready: number; needed: number; attempts: number }) {
  const { user, loading } = useAuth();
  const router = useRouter(); const path = usePathname();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const start = async () => {
    setBusy(true); setErr('');
    const { data, error } = await supabaseBrowser().rpc('start_mock', { p_exam: slug });
    if (error || !data) { setBusy(false); return setErr(error?.message || 'Could not start the test'); }
    router.push(`/mock-tests/attempt/${data}`);
  };
  return (
    <div className="card p-6">
      <p className="text-lg font-bold text-slate-900">Ready to start?</p>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
        <li>• The timer starts as soon as you begin and keeps running if you close the page.</li>
        <li>• Answers save automatically; you can resume until time runs out.</li>
        <li>• When time is up, the test is submitted for you.</li>
        <li>• You get the result instantly, and by email.</li>
      </ul>
      {ready < needed && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">This test currently has {ready} of {needed} questions ready — you’ll get a shorter test until the bank is complete.</p>}
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {loading ? <div className="mt-5 h-11 animate-pulse rounded-xl bg-slate-100" /> : user
        ? <button onClick={start} disabled={busy} className="btn-primary mt-5 w-full">{busy ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} />}Start test</button>
        : <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn-primary mt-5 w-full">Log in free to start</Link>}
      {attempts > 0 && <p className="mt-3 text-center text-xs text-slate-400">{attempts.toLocaleString()} tests taken so far</p>}
    </div>
  );
}
