'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

type Row = { exam_id: string; email: boolean; exams: { short_name: string; slug: string } | null };

export default function MyExams() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = useCallback(() => {
    if (!user) return;
    supabaseBrowser().from('exam_follows').select('exam_id, email, exams(short_name, slug)').eq('user_id', user.id).order('created_at')
      .then(({ data }: { data: Row[] | null }) => setRows(data || []));
  }, [user]);
  useEffect(() => { load(); }, [load]);
  if (!user || !rows) return <Loader2 className="animate-spin text-slate-300" />;
  const sb = supabaseBrowser();
  const setEmail = async (r: Row, email: boolean) => { await sb.from('exam_follows').update({ email }).eq('user_id', user.id).eq('exam_id', r.exam_id); load(); };
  const remove = async (r: Row) => { await sb.from('exam_follows').delete().eq('user_id', user.id).eq('exam_id', r.exam_id); load(); };
  return (
    <div className="card p-5">
      <h2 className="font-bold text-slate-900">Exam news emails</h2>
      <p className="mt-1 text-sm text-slate-500">Results, admit cards, dates and answer keys for the exams you follow — at most one email a day.</p>
      {rows.length ? (
        <ul className="mt-4 divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.exam_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <Link href={`/exams/${r.exams?.slug}#news`} className="font-semibold text-brand-700 hover:underline">{r.exams?.short_name}</Link>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.email} onChange={(e) => setEmail(r, e.target.checked)} />Email me</label>
                <button onClick={() => remove(r)} className="btn-ghost px-2 py-1.5" aria-label={`Stop following ${r.exams?.short_name}`}><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-slate-600">You don't follow any exam yet. Open an exam on the <Link href="/exams" className="text-brand-700 underline">exams page</Link> and tap “Get news by email”.</p>}
    </div>
  );
}
