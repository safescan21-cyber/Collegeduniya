'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

export default function MyAttempts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabaseBrowser().from('mock_attempts').select('id, title, status, score, max_score, percentile, started_at, deadline').eq('user_id', user.id)
      .order('started_at', { ascending: false }).limit(6).then(({ data }: { data: any[] | null }) => setRows(data || []));
  }, [user]);
  if (!rows.length) return null;
  return (
    <section className="card mt-6 p-5">
      <p className="flex items-center gap-2 font-bold text-slate-900"><History size={17} className="text-brand-600" />My recent tests</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const live = r.status === 'in_progress' && new Date(r.deadline) > new Date();
          return (
            <Link key={r.id} href={live ? `/mock-tests/attempt/${r.id}` : `/mock-tests/result/${r.id}`} className="rounded-xl border border-slate-100 p-3 hover:border-brand-300">
              <p className="truncate font-medium text-slate-900">{r.title}</p>
              <p className="text-xs text-slate-500">{timeAgo(r.started_at)} · {live ? <span className="font-semibold text-amber-600">In progress — resume</span>
                : r.score != null ? <>Score <b>{Number(r.score)}</b>/{Number(r.max_score)} · {Number(r.percentile)} percentile</> : 'Processing…'}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
