'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

// Follow / Following toggle. Pass `initial` when the caller already knows (feed rows carry author_followed);
// otherwise it asks the database. Hidden on your own posts and profile.
export default function FollowButton({ userId, initial, onChange, variant = 'chip' }:
  { userId: string; initial?: boolean; onChange?: (following: boolean, followers: number) => void; variant?: 'chip' | 'solid' | 'dark' }) {
  const { user } = useAuth();
  const router = useRouter();
  const [on, setOn] = useState<boolean | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const loggedIn = !!user && !(user as any).is_anonymous;
  useEffect(() => { setOn(initial); }, [initial]);
  useEffect(() => {
    if (initial !== undefined || !loggedIn) return;
    supabaseBrowser().rpc('follow_stats', { p_user: userId }).then(({ data }: { data: any[] | null }) => setOn(!!data?.[0]?.i_follow));
  }, [userId, initial, loggedIn]);
  if (user && user.id === userId) return null;
  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!loggedIn) return router.push(`/login?mode=register&next=${encodeURIComponent(location.pathname)}`);
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc('toggle_follow', { p_user: userId, p_on: !on });
    setBusy(false);
    if (error) return alert(error.message);
    const r = (data as any[])?.[0]; setOn(!!r?.following); onChange?.(!!r?.following, r?.followers ?? 0);
  };
  const style = variant === 'solid' ? (on ? 'btn-ghost' : 'btn-primary') + ' py-1.5 text-sm'
    : variant === 'dark' ? `rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-white/40 text-white/80' : 'border-white bg-white text-slate-900'}`
    : `rounded-full px-2.5 py-0.5 text-xs font-semibold ${on ? 'bg-slate-100 text-slate-600' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`;
  return (
    <button type="button" onClick={toggle} disabled={busy} className={`inline-flex items-center gap-1 ${style}`} aria-pressed={!!on}>
      {busy ? <Loader2 size={13} className="animate-spin" /> : on ? <UserCheck size={13} /> : <UserPlus size={13} />}{on ? 'Following' : 'Follow'}
    </button>
  );
}
