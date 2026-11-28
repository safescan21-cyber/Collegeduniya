'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';
import { api } from '@/lib/api';

type Ctx = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({
  user: null, profile: null, loading: true, isAdmin: false,
  refreshProfile: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = supabaseBrowser();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
    setProfile((data as Profile) || null);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }: { data: { user: User | null } }) => {
      if (!active) return;
      setUser(data.user);
      await loadProfile(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event: string, session: { user: User } | null) => {
      const u = session?.user ?? null;
      if (event === 'SIGNED_IN' && u) api('/api/session/login', { method: 'POST', body: '{}' }).catch(() => undefined);   // login history (deduped on the server)
      setUser(u);
      loadProfile(u);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [supabase, loadProfile]);

  const value: Ctx = {
    user, profile, loading,
    isAdmin: !!profile && ['admin', 'super_admin'].includes(profile.role) && !profile.is_blocked,
    refreshProfile: () => loadProfile(user),
    signOut: async () => { await supabase.auth.signOut(); setUser(null); setProfile(null); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
