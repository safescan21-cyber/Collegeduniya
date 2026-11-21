'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Target, Loader2, Info } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CompareButton, SaveButton } from '@/components/ActionButtons';
import EnquiryForm from '@/components/EnquiryForm';

type Row = { college_id: string; slug: string; name: string; city: string; state?: string | null; home_state?: string | null; country: string; course: string; category: string; quota: string | null; year: number; opening_rank: number | null; closing_rank: number; chance: 'High' | 'Medium' | 'Low' };
const CHANCE = { High: 'chip-green', Medium: 'chip-amber', Low: 'chip-red' } as const;

export default function Predictor({ exams, categories, quotas, states = [], title, hideHeader = false }: { exams: { slug: string; short_name: string }[]; categories: string[]; quotas: string[]; states?: string[]; title?: string; hideHeader?: boolean }) {
  const params = useSearchParams();
  const supabase = supabaseBrowser();
  const [exam, setExam] = useState(params.get('exam') || exams[0]?.slug || '');
  const [rank, setRank] = useState(params.get('rank') || '');
  const [category, setCategory] = useState('General');
  const [quota, setQuota] = useState('');
  const [homeState, setHomeState] = useState(params.get('state') || '');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'' | Row['chance']>('');

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseInt(rank, 10);
    if (!exam) return setErr('Choose an exam.');
    if (!r || r < 1) return setErr('Enter your rank (a positive number).');
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('predict_colleges', { p_exam: exam, p_rank: r, p_category: category, p_quota: quota || null, p_state: homeState || null });
    setBusy(false);
    if (error) return setErr(error.message);
    setRows((data || []) as Row[]);
    setFilter('');
  };

  const shown = (rows || []).filter((r) => !filter || r.chance === filter);
  const count = (c: Row['chance']) => (rows || []).filter((r) => r.chance === c).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        {!hideHeader && <>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Target className="text-brand-600" />{title || 'College predictor'}</h1>
          <p className="mt-1 text-slate-500">See where you can get admission, based on last year’s closing ranks.</p>
        </>}

        {exams.length === 0 ? (
          <div className="card mt-6 p-8 text-center text-slate-500">Cutoff data for this exam hasn’t been added yet. Admins can upload official counselling cutoffs in Admin → Import & APIs.</div>
        ) : (
          <form onSubmit={run} className="card mt-6 grid gap-4 p-6 sm:grid-cols-4">
            <div className="sm:col-span-1"><label className="label">Exam</label>
              <select className="input" value={exam} onChange={(e) => setExam(e.target.value)}>{exams.map((x) => <option key={x.slug} value={x.slug}>{x.short_name}</option>)}</select></div>
            <div><label className="label">Your rank</label><input className="input" inputMode="numeric" value={rank} onChange={(e) => setRank(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 4500" /></div>
            <div><label className="label">Category</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
            {quotas.length > 1 ? (
              <div><label className="label">Quota</label>
                <select className="input" value={quota} onChange={(e) => setQuota(e.target.value)}><option value="">Any</option>{quotas.map((q) => <option key={q}>{q}</option>)}</select></div>
            ) : <div className="hidden sm:block" />}
            {states.length > 0 && (
              <div className="sm:col-span-2"><label className="label">Your home state (for state-quota seats)</label>
                <select className="input" value={homeState} onChange={(e) => setHomeState(e.target.value)}><option value="">Not needed / outside India</option>{states.map((s) => <option key={s}>{s}</option>)}</select></div>
            )}
            {err && <p className="text-sm text-rose-600 sm:col-span-4">{err}</p>}
            <button disabled={busy} className="btn-primary sm:col-span-4">{busy ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}Predict my colleges</button>
          </form>
        )}

        {rows && (
          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-2 font-semibold text-slate-900">{rows.length} options found</p>
              <button onClick={() => setFilter('')} className={!filter ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>All</button>
              {(['High', 'Medium', 'Low'] as const).map((c) => <button key={c} onClick={() => setFilter(c)} className={filter === c ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>{c} chance ({count(c)})</button>)}
            </div>
            {shown.length === 0 ? (
              <div className="card mt-4 p-8 text-center text-slate-500">No colleges match. Try another category, or talk to a counsellor for options.</div>
            ) : (
              <div className="card mt-4 divide-y divide-slate-100">
                {shown.map((r, i) => (
                  <div key={`${r.college_id}-${r.course}-${i}`} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/colleges/${r.slug}#cutoffs`} className="font-semibold text-slate-900 hover:text-brand-700">{r.name}</Link>
                      <p className="text-sm text-slate-600">{r.course}</p>
                      <p className="text-xs text-slate-400">{r.city}, {r.country} · {r.year} closing rank {r.closing_rank.toLocaleString()} ({r.category}{r.quota ? `, ${r.quota}` : ''}{r.home_state && r.quota === 'Home State' ? ` · ${r.home_state}` : ''})</p>
                    </div>
                    <span className={CHANCE[r.chance]}>{r.chance} chance</span>
                    <CompareButton item={{ id: r.college_id, slug: r.slug, name: r.name, city: r.city }} />
                    <SaveButton type="college" id={r.college_id} />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 flex items-start gap-2 text-xs text-slate-500"><Info size={14} className="mt-0.5 shrink-0" />
              Prediction uses last year’s closing ranks: High = your rank is well inside the cutoff, Medium = close to it, Low = slightly beyond (possible in later rounds). Cutoffs change every year — this is guidance, not a guarantee.</p>
          </div>
        )}
      </div>
      <aside><div className="lg:sticky lg:top-24"><EnquiryForm title="Confused about choice filling?" subtitle="A counsellor can help you plan your counselling rounds — free." /></div></aside>
    </div>
  );
}
