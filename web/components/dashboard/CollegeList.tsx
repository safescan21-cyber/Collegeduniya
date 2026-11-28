'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Loader2, Target, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

type Item = { id: string; item_id: string; list_type: 'reach' | 'match' | 'safety' | null; app_status: string; deadline: string | null; note: string | null;
  college?: { name: string; slug: string; city: string | null; country: string | null } };

const TYPES = [
  { k: 'reach', label: 'Reach', hint: 'Hard to get in — your marks/rank are below most admitted students', cls: 'bg-rose-500' },
  { k: 'match', label: 'Match', hint: 'Your marks/rank are similar to admitted students', cls: 'bg-amber-500' },
  { k: 'safety', label: 'Safety', hint: 'You are very likely to get in', cls: 'bg-emerald-500' },
] as const;
const STATUS = [['researching', 'Researching'], ['applying', 'Applying'], ['applied', 'Applied'], ['accepted', 'Accepted 🎉'], ['waitlisted', 'Waitlisted'], ['rejected', 'Rejected'], ['joined', 'Joined ✅']] as const;
const daysTo = (d: string) => Math.round((new Date(`${d}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);

// College list & application tracker: sort saved colleges into reach / match / safety, track each application and its deadline.
// We remind you 3 days and 1 day before a deadline you set (while the status is Researching or Applying).
export default function CollegeList() {
  const { user } = useAuth();
  const sb = supabaseBrowser();
  const [items, setItems] = useState<Item[] | null>(null);
  const [saving, setSaving] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await sb.from('saved_items').select('id, item_id, list_type, app_status, deadline, note').eq('user_id', user.id).eq('item_type', 'college').order('created_at');
    const rows = (data || []) as Item[];
    const ids = rows.map((r) => r.item_id);
    const { data: cs } = ids.length ? await sb.from('colleges_public').select('id, name, slug, city, country').in('id', ids) : { data: [] as any[] };
    const by = Object.fromEntries(((cs || []) as any[]).map((c) => [c.id, c]));
    setItems(rows.map((r) => ({ ...r, college: by[r.item_id] })).filter((r) => r.college));
  }, [sb, user]);
  useEffect(() => { load(); }, [load]);

  const save = async (it: Item, patch: Partial<Item>) => {
    setItems((l) => (l || []).map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
    setSaving(it.id);
    await sb.from('saved_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', it.id);
    setSaving('');
  };
  const remove = async (it: Item) => { if (!confirm(`Remove ${it.college?.name} from your list?`)) return; await sb.from('saved_items').delete().eq('id', it.id); load(); };

  if (!items) return <Loader2 className="animate-spin text-slate-300" />;
  if (!items.length) return (
    <div className="card p-8 text-center">
      <Target className="mx-auto text-brand-600" size={32} />
      <p className="mt-2 font-bold text-slate-900">Build your college list</p>
      <p className="mt-1 text-sm text-slate-500">Tap ♥ Save on any college. Then sort them into reach, match and safety, and track each application and deadline here.</p>
      <Link href="/colleges" className="btn-primary mt-4">Find colleges</Link>
    </div>);

  const count = (k: string) => items.filter((i) => i.list_type === k).length;
  const tips: string[] = [];
  if (count('safety') === 0) tips.push('Add at least 1–2 safety colleges so you have a sure option.');
  if (count('match') < 2) tips.push('Most students apply to 3–4 match colleges.');
  if (count('reach') > count('match') + count('safety')) tips.push('Your list leans on reach colleges — balance it with more matches.');
  const upcoming = items.filter((i) => i.deadline && daysTo(i.deadline) >= 0 && ['researching', 'applying'].includes(i.app_status)).sort((a, b) => a.deadline!.localeCompare(b.deadline!));

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-bold text-slate-900">My college list</h2><p className="text-sm text-slate-500">A balanced list has reach, match and safety colleges. Not sure which is which? Use the <Link href="/predictor" className="text-brand-700 underline">college predictor</Link> with your rank.</p></div>
          {items.length >= 2 && <Link href={`/compare?c=${items.slice(0, 4).map((i) => i.college!.slug).join(',')}`} className="btn-ghost py-1.5 text-sm">Compare</Link>}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {TYPES.map((t) => (
            <div key={t.k} className="rounded-xl bg-slate-50 p-3" title={t.hint}>
              <p className="text-2xl font-extrabold text-slate-900">{count(t.k)}</p>
              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-600"><span className={`h-2 w-2 rounded-full ${t.cls}`} />{t.label}</p>
            </div>))}
        </div>
        {tips.length > 0 && <ul className="mt-3 space-y-1 text-sm text-amber-700">{tips.map((t) => <li key={t}>💡 {t}</li>)}</ul>}
        {upcoming.length > 0 && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
            <p className="flex items-center gap-1 font-semibold"><CalendarClock size={15} />Coming up</p>
            {upcoming.slice(0, 3).map((i) => <p key={i.id}>{i.college!.name} — {daysTo(i.deadline!) === 0 ? 'today' : `in ${daysTo(i.deadline!)} day${daysTo(i.deadline!) > 1 ? 's' : ''}`}</p>)}
          </div>)}
      </div>

      {items.map((it) => (
        <div key={it.id} className="card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><Link href={`/colleges/${it.college!.slug}`} className="font-bold text-slate-900 hover:underline">{it.college!.name}</Link>
              <p className="text-xs text-slate-500">{[it.college!.city, it.college!.country].filter(Boolean).join(', ')}</p></div>
            <span className="flex items-center gap-2">{saving === it.id && <Loader2 size={14} className="animate-spin text-slate-400" />}<button onClick={() => remove(it)} className="text-slate-400 hover:text-rose-600" aria-label="Remove"><Trash2 size={15} /></button></span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
              {TYPES.map((t) => (
                <button key={t.k} type="button" title={t.hint} onClick={() => save(it, { list_type: it.list_type === t.k ? null : t.k })}
                  className={`px-3 py-1.5 ${it.list_type === t.k ? `${t.cls} text-white` : 'text-slate-600 hover:bg-slate-50'}`}>{t.label}</button>))}
            </div>
            <select value={it.app_status} onChange={(e) => save(it, { app_status: e.target.value })} className="input w-auto py-1.5 text-sm" aria-label="Application status">
              {STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-500">Deadline
              <input type="date" value={it.deadline || ''} onChange={(e) => save(it, { deadline: e.target.value || null })} className="input w-auto py-1 text-sm" /></label>
            {it.deadline && daysTo(it.deadline) >= 0 && daysTo(it.deadline) <= 7 && ['researching', 'applying'].includes(it.app_status) && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{daysTo(it.deadline) === 0 ? 'Due today' : `${daysTo(it.deadline)} days left`}</span>}
          </div>
          <input defaultValue={it.note || ''} maxLength={500} onBlur={(e) => e.target.value !== (it.note || '') && save(it, { note: e.target.value.trim() || null })}
            className="input mt-2 py-1.5 text-sm" placeholder="Notes — documents needed, fee paid, login ID of the application portal…" />
        </div>))}
      <p className="text-center text-xs text-slate-400">We remind you 3 days and 1 day before a deadline you set. Always check the college’s official website for the exact date.</p>
    </div>
  );
}
