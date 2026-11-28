'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import PasswordSettings from '@/components/account/PasswordSettings';

// Landing page of the "Forgot password?" email: the link signs the person in, then they choose a new password.
export default function ResetPage() {
  const [state, setState] = useState<'wait' | 'ready' | 'bad' | 'done'>('wait');
  useEffect(() => {
    const sb = supabaseBrowser();
    const { data: sub } = sb.auth.onAuthStateChange((_e: string, s: unknown) => { if (s) setState((x) => (x === 'wait' ? 'ready' : x)); });
    const t = setTimeout(async () => {
      const { data } = await sb.auth.getSession();
      setState((x) => (x === 'wait' ? (data.session ? 'ready' : 'bad') : x));
    }, 2500);
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);
  return (
    <div className="container-x max-w-md py-16">
      {state === 'wait' && <p className="flex items-center justify-center gap-2 text-slate-600"><Loader2 className="animate-spin" size={18} />Checking your link…</p>}
      {state === 'bad' && <div className="card p-6 text-center"><p className="text-rose-600">This reset link has expired or was already used.</p><Link href="/login" className="btn-primary mt-4">Back to login</Link></div>}
      {state === 'ready' && <PasswordSettings title="Choose a new password" onDone={() => setState('done')} />}
      {state === 'done' && <div className="card p-6 text-center"><p className="font-semibold text-emerald-700">Your new password is saved.</p><Link href="/dashboard" className="btn-primary mt-4">Go to dashboard</Link></div>}
    </div>
  );
}
