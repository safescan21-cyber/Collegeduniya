'use client';
import { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

const KEY = 'ses-ref';

// ?ref=CODE on any page → remembered on this device → claimed once the visitor signs up / logs in (within 7 days of joining)
export default function ReferralCapture() {
  const { user } = useAuth();
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('ref');
      if (code && /^[A-Za-z0-9]{4,12}$/.test(code)) localStorage.setItem(KEY, code.toUpperCase());
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    if (!user) return;
    let code: string | null = null;
    try { code = localStorage.getItem(KEY); } catch { return; }
    if (!code) return;
    supabaseBrowser().rpc('claim_referral', { p_code: code }).then(({ error }: { error: unknown }) => {
      if (!error) { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
    });
  }, [user]);
  return null;
}
