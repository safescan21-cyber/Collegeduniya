'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { BedDouble, Building2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

// Shows children only for the right account type; offers to switch the account type otherwise.
export default function PortalGate({ type, children }: { type: 'pg_owner' | 'employer'; children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile, isAdmin } = useAuth();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const Icon = type === 'pg_owner' ? BedDouble : Building2;
  const label = type === 'pg_owner' ? 'PG owner' : 'employer';

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (!user) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <Icon className="mx-auto text-brand-600" size={40} />
        <h1 className="mt-3 text-xl font-bold">Login to your {label} account</h1>
        <div className="mt-5 flex justify-center gap-2">
          <Link href={`/login?as=${type}&next=${pathname}`} className="btn-primary">Login</Link>
          <Link href={`/login?mode=register&as=${type}`} className="btn-ghost">Register free</Link>
        </div>
      </div>
    );
  }
  if (profile?.account_type !== type && !isAdmin) {
    const switchType = async () => {
      setBusy(true);
      await supabaseBrowser().from('profiles').update({ account_type: type }).eq('id', user.id);
      await refreshProfile();
      setBusy(false);
    };
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <Icon className="mx-auto text-brand-600" size={40} />
        <h1 className="mt-3 text-xl font-bold">This area is for {label}s</h1>
        <p className="mt-2 text-sm text-slate-500">Your account is set up as a {profile?.account_type?.replace('_', ' ') || 'student'}. You can switch it — your applications and reviews stay as they are.</p>
        <button onClick={switchType} disabled={busy} className="btn-primary mt-5">{busy ? 'Switching…' : `Switch to ${label} account`}</button>
      </div>
    );
  }
  return <>{children}</>;
}
