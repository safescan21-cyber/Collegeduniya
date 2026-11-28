'use client';
import { supabaseBrowser } from '@/lib/supabase/client';

// Guest tests: Supabase anonymous sign-in (enable "Allow anonymous sign-ins" in Supabase → Authentication → Sign In / Providers)
export const GUEST_TESTS = process.env.NEXT_PUBLIC_GUEST_TESTS === 'on';

export async function ensureSession(allowGuest: boolean): Promise<'ok' | 'login'> {
  const sb = supabaseBrowser();
  const { data } = await sb.auth.getSession();
  if (data.session) return 'ok';
  if (!allowGuest || !GUEST_TESTS) return 'login';
  const { error } = await sb.auth.signInAnonymously();
  return error ? 'login' : 'ok';
}

export async function startPaper(paperId: string, groupId?: string | null): Promise<{ id?: string; error?: string; login?: boolean }> {
  const s = await ensureSession(true);
  if (s === 'login') return { login: true };
  const { data, error } = await supabaseBrowser().rpc('start_paper', { p_paper: paperId, p_group: groupId || null });
  if (error || !data) return { error: error?.message || 'Could not start the test' };
  return { id: data as string };
}
