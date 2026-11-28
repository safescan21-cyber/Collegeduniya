'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { Stars } from './Cards';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

type Pub = { id: string; rating: number; rating_food: number | null; rating_safety: number | null; rating_cleanliness: number | null; body: string; stayed_from: number | null; created_at: string; reviewer_name: string };

function Pick({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div><p className="label">{label}</p>
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => (
        <button type="button" key={i} onClick={() => onChange(i)} aria-label={`${i} stars`}>
          <Star size={22} className={i <= value ? 'fill-accent-400 text-accent-400' : 'text-slate-300'} />
        </button>
      ))}</div>
    </div>
  );
}

export default function HostelReviews({ hostelId, reviews, avg, count }: { hostelId: string; reviews: Pub[]; avg: number; count: number }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [ownId, setOwnId] = useState<string | null>(null);
  const [f, setF] = useState({ rating: 0, rating_food: 0, rating_safety: 0, rating_cleanliness: 0, body: '', stayed_from: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('hostel_reviews').select('*').eq('hostel_id', hostelId).eq('user_id', user.id).maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!data) return;
        setOwnId(data.id);
        setF({ rating: data.rating, rating_food: data.rating_food || 0, rating_safety: data.rating_safety || 0,
          rating_cleanliness: data.rating_cleanliness || 0, body: data.body, stayed_from: data.stayed_from ? String(data.stayed_from) : '' });
      });
  }, [user, hostelId, supabase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!f.rating) return setMsg('Please give an overall rating.');
    if (f.body.trim().length < 20) return setMsg('Please write at least 20 characters.');
    setBusy(true); setMsg('');
    const row = { hostel_id: hostelId, user_id: user.id, rating: f.rating, rating_food: f.rating_food || null, rating_safety: f.rating_safety || null,
      rating_cleanliness: f.rating_cleanliness || null, body: f.body.trim(), stayed_from: f.stayed_from ? Number(f.stayed_from) : null };
    const { error } = ownId ? await supabase.from('hostel_reviews').update(row).eq('id', ownId) : await supabase.from('hostel_reviews').insert(row);
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg('Thanks — your review is saved.');
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-slate-900">Reviews by students</h2>
        {count > 0 && <span className="flex items-center gap-1 text-sm text-slate-600"><Stars value={avg} />{avg} ({count})</span>}
      </div>
      {reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
      {reviews.map((r) => (
        <article key={r.id} className="card p-5">
          <div className="flex items-start justify-between">
            <p className="font-semibold text-slate-900">{r.reviewer_name} <span className="text-xs font-normal text-slate-400">· {r.stayed_from ? `stayed since ${r.stayed_from} · ` : ''}{timeAgo(r.created_at)}</span></p>
            <Stars value={r.rating} />
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{r.body}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {r.rating_food && <span className="chip">Food {r.rating_food}/5</span>}
            {r.rating_safety && <span className="chip">Safety {r.rating_safety}/5</span>}
            {r.rating_cleanliness && <span className="chip">Cleanliness {r.rating_cleanliness}/5</span>}
          </div>
        </article>
      ))}
      {!user ? (
        <div className="card flex items-center justify-between gap-3 p-5">
          <p className="text-slate-700">Stayed here? Help other students.</p>
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-primary">Login to review</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4 p-5">
          <h3 className="font-semibold text-slate-900">{ownId ? 'Edit your review' : 'Write a review'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Pick label="Overall *" value={f.rating} onChange={(v) => setF({ ...f, rating: v })} />
            <Pick label="Food" value={f.rating_food} onChange={(v) => setF({ ...f, rating_food: v })} />
            <Pick label="Safety" value={f.rating_safety} onChange={(v) => setF({ ...f, rating_safety: v })} />
            <Pick label="Cleanliness" value={f.rating_cleanliness} onChange={(v) => setF({ ...f, rating_cleanliness: v })} />
          </div>
          <input className="input" type="number" placeholder="Living here since (year)" value={f.stayed_from} onChange={(e) => setF({ ...f, stayed_from: e.target.value })} />
          <textarea className="input" rows={4} maxLength={3000} placeholder="Room, food, owner, rules, Wi-Fi, safety…" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          {msg && <p className="text-sm text-slate-700">{msg}</p>}
          <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Submit review'}</button>
        </form>
      )}
    </div>
  );
}
