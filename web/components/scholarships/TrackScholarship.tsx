'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

const STATUS: [string, string][] = [['planning', 'Planning to apply'], ['applied', 'Applied ✓'], ['won', 'Won 🎉'], ['not_selected', 'Not selected']];

// Track a scholarship: kept in "My scholarships" with a status; reminders 7 days and 1 day before the deadline while "planning".
export default function TrackScholarship({ id, deadline }: { id: string; deadline?: string | null }) {
  const { user } = useAuth();
  const loggedIn = !!user && !(user as any).is_anonymous;
  const [status, setStatus] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!loggedIn) { setStatus(null); return; }
    supabaseBrowser().from('scholarship_tracker').select('status').eq('scholarship_id', id).maybeSingle()
      .then(({ data }: { data: { status: string } | null }) => setStatus(data?.status ?? null));
  }, [id, loggedIn]);
  const save = async (s: string | null) => {
    setBusy(true);
    const sb = supabaseBrowser();
    if (s === null) await sb.from('scholarship_tracker').delete().eq('scholarship_id', id);
    else await sb.from('scholarship_tracker').upsert({ user_id: user!.id, scholarship_id: id, status: s, updated_at: new Date().toISOString() });
    setStatus(s); setBusy(false);
  };
  if (!loggedIn) return <Link href={`/login?next=${encodeURIComponent(typeof location !== 'undefined' ? location.pathname : '/scholarships')}`} className="btn-ghost"><BookmarkPlus size={16} />Track & get deadline reminders</Link>;
  if (status === undefined) return <span className="btn-ghost opacity-60"><Loader2 size={16} className="animate-spin" />Loading…</span>;
  if (!status) return <button onClick={() => save('planning')} disabled={busy} className="btn-ghost"><BookmarkPlus size={16} />Track & get deadline reminders</button>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select value={status} onChange={(e) => save(e.target.value === 'remove' ? null : e.target.value)} disabled={busy} className="input w-auto py-2 text-sm font-semibold">
        {STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        <option value="remove">Stop tracking</option>
      </select>
      {status === 'planning' && deadline && <span className="flex items-center gap-1 text-xs text-emerald-700"><Check size={13} />We’ll remind you 7 days and 1 day before the deadline</span>}
      <Link href="/scholarships#mine" className="text-xs font-semibold text-brand-700 hover:underline">My scholarships →</Link>
    </span>
  );
}
