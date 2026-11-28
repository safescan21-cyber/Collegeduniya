'use client';
import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Trophy, Medal } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';

type Row = { rank: number; name: string; score: number; max_score: number; minutes: number; is_me: boolean };

function Board({ paper }: { paper: string }) {
  const group = useSearchParams().get('group');
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [info, setInfo] = useState<any>(null);
  useEffect(() => {
    const sb = supabaseBrowser();
    sb.rpc('paper_leaderboard', { p_paper: paper, p_group: group, p_lim: 100 }).then(({ data }: { data: Row[] | null }) => setRows(data || []));
    sb.from('mock_papers').select('title, exam_slug, duration_min').eq('id', paper).maybeSingle().then(({ data }: { data: any }) => setInfo(data));
  }, [paper, group, user?.id]);
  return (
    <div className="container-x max-w-3xl py-10">
      {info && <Link href={`/mock-tests/${info.exam_slug}`} className="text-sm text-slate-500 hover:underline">← All {info.exam_slug} tests</Link>}
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-slate-900"><Trophy className="text-amber-500" />{info?.title || 'Leaderboard'}</h1>
      <p className="text-sm text-slate-500">{group ? 'Your study group' : 'All India'} · first attempt of each student · ties broken by time taken</p>
      {!rows ? <div className="card mt-6 h-64 animate-pulse" /> : rows.length === 0 ? <div className="card mt-6 p-8 text-center text-slate-500">No one has finished this test yet — be the first!</div> : (
        <div className="card mt-6 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Rank</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Score</th><th className="px-4 py-2">Time</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} className={`border-t border-slate-100 ${r.is_me ? 'bg-brand-50 font-semibold' : ''}`}>
                <td className="px-4 py-2">{Number(r.rank) <= 3 ? <Medal size={18} className={['text-amber-500', 'text-slate-400', 'text-orange-600'][Number(r.rank) - 1]} /> : Number(r.rank)}</td>
                <td className="px-4 py-2">{r.name}{r.is_me ? ' (you)' : ''}</td>
                <td className="px-4 py-2">{Number(r.score)} / {Number(r.max_score)}</td>
                <td className="px-4 py-2 text-slate-500">{Number(r.minutes)} min</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">Students with a private profile appear as “Aspirant”.</p>
    </div>
  );
}

export default function Leaderboard({ params }: { params: Promise<{ paper: string }> }) {
  const { paper } = use(params);
  return <Suspense fallback={<div className="container-x py-10"><div className="card h-64 animate-pulse" /></div>}><Board paper={paper} /></Suspense>;
}
