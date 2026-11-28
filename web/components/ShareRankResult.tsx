'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Send, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

// Students share their real result after it is declared; an admin checks it before it is used.
export default function ShareRankResult({ exam, examName, categories = [], sessions = [] }: { exam: string; examName: string; categories?: string[]; sessions?: string[] }) {
  const { user } = useAuth();
  const thisYear = new Date().getFullYear();
  const [f, setF] = useState({ year: String(thisYear), session: sessions[0] || 'All', category: 'General', marks: '', percentile: '', rank: '' });
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(''); const [err, setErr] = useState('');
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc('share_rank_result', { p_exam: exam, p_year: Number(f.year), p_session: f.session, p_category: f.category,
      p_marks: num(f.marks), p_percentile: num(f.percentile), p_rank: num(f.rank) });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(data === 'ok' ? 'Thanks! Your result will appear after a quick check.' : 'Thanks! We will double-check it because the numbers look unusual.');
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="card p-5" id="share">
      <p className="font-bold text-slate-900">Got your {examName} result? Share it</p>
      <p className="mt-1 text-sm text-slate-500">Your marks and rank (no name, no roll number) help next year's students. Shown only after a check.</p>
      {!user ? <Link href={`/login?next=/rank-predictor/${exam}%23share`} className="btn-primary mt-3">Log in to share</Link>
        : done ? <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700"><Check size={16} />{done}</p> : (
        <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-sm"><span className="label">Year</span>
            <select className="input" value={f.year} onChange={set('year')}>{[0, 1, 2, 3].map((d) => <option key={d}>{thisYear - d}</option>)}</select></label>
          {sessions.length > 1 && <label className="text-sm"><span className="label">Session</span>
            <select className="input" value={f.session} onChange={set('session')}>{sessions.map((s) => <option key={s}>{s}</option>)}</select></label>}
          <label className="text-sm"><span className="label">Category</span>
            <select className="input" value={f.category} onChange={set('category')}>{Array.from(new Set(['General', ...categories.filter((c) => c !== 'All')])).map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="text-sm"><span className="label">Marks</span><input className="input" inputMode="decimal" value={f.marks} onChange={set('marks')} placeholder="e.g. 186" /></label>
          <label className="text-sm"><span className="label">Percentile (if any)</span><input className="input" inputMode="decimal" value={f.percentile} onChange={set('percentile')} placeholder="e.g. 98.42" /></label>
          <label className="text-sm"><span className="label">Rank on scorecard *</span><input className="input" inputMode="numeric" value={f.rank} onChange={set('rank')} placeholder="e.g. 12450" required /></label>
          <div className="sm:col-span-3">
            <button className="btn-primary" disabled={busy || !f.rank || (!f.marks && !f.percentile)}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Share my result</button>
            {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
