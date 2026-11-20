'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Star, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { Stars } from './Cards';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';
import type { ReviewPublic } from '@/lib/types';

type Own = { id: string; rating: number; rating_faculty: number | null; rating_campus: number | null; rating_placement: number | null;
  title: string; body: string; course: string | null; batch_year: number | null; status: string };

function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button type="button" key={i} onClick={() => onChange(i)} aria-label={`${i} stars`}>
            <Star size={24} className={i <= value ? 'fill-accent-400 text-accent-400' : 'text-slate-300 hover:text-accent-400'} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReviewSection({ collegeId, collegeName, reviews, avg, count }: {
  collegeId: string; collegeName: string; reviews: ReviewPublic[]; avg: number; count: number;
}) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = supabaseBrowser();
  const [own, setOwn] = useState<Own | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ rating: 0, rating_faculty: 0, rating_campus: 0, rating_placement: 0, title: '', body: '', course: '', batch_year: '' });

  useEffect(() => {
    if (!user) return;
    supabase.from('reviews').select('*').eq('college_id', collegeId).eq('user_id', user.id).maybeSingle()
      .then(({ data }: { data: Own | null }) => {
        setOwn(data);
        if (data) setForm({
          rating: data.rating, rating_faculty: data.rating_faculty || 0, rating_campus: data.rating_campus || 0,
          rating_placement: data.rating_placement || 0, title: data.title, body: data.body,
          course: data.course || '', batch_year: data.batch_year ? String(data.batch_year) : '',
        });
      });
  }, [user, collegeId, supabase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.rating) return setMsg({ ok: false, text: 'Please give an overall rating.' });
    if (form.body.trim().length < 30) return setMsg({ ok: false, text: 'Please write at least 30 characters.' });
    setBusy(true); setMsg(null);
    const row = {
      college_id: collegeId, user_id: user.id, rating: form.rating,
      rating_faculty: form.rating_faculty || null, rating_campus: form.rating_campus || null, rating_placement: form.rating_placement || null,
      title: form.title.trim(), body: form.body.trim(), course: form.course.trim() || null,
      batch_year: form.batch_year ? Number(form.batch_year) : null,
    };
    const { error } = own
      ? await supabase.from('reviews').update(row).eq('id', own.id)
      : await supabase.from('reviews').insert(row);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: own ? 'Review updated.' : 'Thanks! Your review is live.' });
    setEditing(false);
    const { data } = await supabase.from('reviews').select('*').eq('college_id', collegeId).eq('user_id', user.id).maybeSingle();
    setOwn(data);
    router.refresh();
  };

  const remove = async () => {
    if (!own || !confirm('Delete your review?')) return;
    await supabase.from('reviews').delete().eq('id', own.id);
    setOwn(null); setForm({ rating: 0, rating_faculty: 0, rating_campus: 0, rating_placement: 0, title: '', body: '', course: '', batch_year: '' });
    router.refresh();
  };

  const showForm = user && (!own || editing) && !profile?.is_blocked && own?.status !== 'blocked';
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.rating === s).length }));

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-slate-900">Student reviews</h2>
      <div className="card grid gap-6 p-6 sm:grid-cols-[200px_1fr]">
        <div className="text-center sm:border-r sm:border-slate-100 sm:pr-6">
          <p className="text-5xl font-extrabold text-slate-900">{avg ? avg.toFixed(1) : '–'}</p>
          <Stars value={avg} size={18} />
          <p className="mt-1 text-sm text-slate-500">{count} review{count === 1 ? '' : 's'}</p>
        </div>
        <div className="space-y-1.5">
          {dist.map(({ s, n }) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-slate-600">{s}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-accent-400" style={{ width: `${reviews.length ? (n / reviews.length) * 100 : 0}%` }} />
              </div>
              <span className="w-6 text-right text-slate-500">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {!user && (
        <div className="card mt-5 flex flex-col items-center justify-between gap-3 p-5 sm:flex-row">
          <p className="text-slate-700">Studied at {collegeName}? Help other students with an honest review.</p>
          <Link href={`/login?next=${encodeURIComponent(pathname + '#reviews')}`} className="btn-primary">Login to review</Link>
        </div>
      )}

      {own && !editing && (
        <div className="card mt-5 border-brand-200 bg-brand-50/50 p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-brand-800">Your review {own.status === 'blocked' && <span className="chip-red ml-2">Blocked by admin</span>}{own.status === 'pending' && <span className="chip-amber ml-2">Pending</span>}</p>
            {own.status !== 'blocked' && (
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="btn-ghost py-1.5"><Pencil size={14} />Edit</button>
                <button onClick={remove} className="btn-ghost py-1.5 text-rose-600"><Trash2 size={14} /></button>
              </div>
            )}
          </div>
          <Stars value={own.rating} /><p className="mt-1 font-medium">{own.title}</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="card mt-5 space-y-4 p-6">
          <h3 className="font-semibold text-slate-900">{own ? 'Edit your review' : 'Write a review'}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <StarInput label="Overall *" value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
            <StarInput label="Faculty" value={form.rating_faculty} onChange={(v) => setForm({ ...form, rating_faculty: v })} />
            <StarInput label="Campus & hostel" value={form.rating_campus} onChange={(v) => setForm({ ...form, rating_campus: v })} />
            <StarInput label="Placements" value={form.rating_placement} onChange={(v) => setForm({ ...form, rating_placement: v })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Course</label><input className="input" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="e.g. B.Tech CSE" /></div>
            <div><label className="label">Batch / passing year</label><input className="input" type="number" value={form.batch_year} onChange={(e) => setForm({ ...form, batch_year: e.target.value })} placeholder="2025" /></div>
          </div>
          <div><label className="label">Title *</label><input required minLength={3} maxLength={120} className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sum up your experience" /></div>
          <div><label className="label">Your review *</label><textarea required rows={5} maxLength={4000} className="input" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Teaching, campus life, hostel, placements, fees value…" /></div>
          {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.text}</p>}
          <div className="flex gap-2">
            <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : own ? 'Update review' : 'Submit review'}</button>
            {editing && <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>
      )}
      {msg && !showForm && <p className={`mt-3 text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.text}</p>}

      <div className="mt-5 space-y-4">
        {reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet — be the first.</p>}
        {reviews.map((r) => (
          <article key={r.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{r.reviewer_name[0]?.toUpperCase()}</span>
                <div>
                  <p className="font-semibold text-slate-900">{r.reviewer_name}</p>
                  <p className="text-xs text-slate-500">{[r.course, r.batch_year && `Batch ${r.batch_year}`].filter(Boolean).join(' · ') || 'Student'} · {timeAgo(r.created_at)}</p>
                </div>
              </div>
              <Stars value={r.rating} />
            </div>
            <h4 className="mt-3 font-semibold text-slate-900">{r.title}</h4>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{r.body}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {r.rating_faculty && <span className="chip">Faculty {r.rating_faculty}/5</span>}
              {r.rating_campus && <span className="chip">Campus {r.rating_campus}/5</span>}
              {r.rating_placement && <span className="chip">Placements {r.rating_placement}/5</span>}
              {r.edited_by_admin && <span className="chip"><MessageSquare size={12} />Edited by moderator</span>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
