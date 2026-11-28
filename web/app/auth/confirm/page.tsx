'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

// One-time login links (?token_hash=…&type=magiclink&next=/dashboard), e.g. created by an admin on the server.
function Confirm() {
  const sp = useSearchParams();
  const router = useRouter();
  const [err, setErr] = useState('');
  useEffect(() => {
    const token_hash = sp.get('token_hash');
    const type = (sp.get('type') || 'magiclink') as 'magiclink' | 'email' | 'signup' | 'recovery' | 'invite' | 'email_change';
    const next = sp.get('next') || '/dashboard';
    if (!token_hash) { setErr('This link is incomplete.'); return; }
    supabaseBrowser().auth.verifyOtp({ token_hash, type }).then(({ error }: { error: { message: string } | null }) => {
      if (error) setErr('This login link has expired or was already used. Ask for a new one.');
      else router.replace(next.startsWith('/') ? next : '/dashboard');
    });
  }, [sp, router]);
  return (
    <div className="container-x max-w-md py-20 text-center">
      {err ? <p className="text-rose-600">{err}</p> : <p className="flex items-center justify-center gap-2 text-slate-600"><Loader2 className="animate-spin" size={18} />Signing you in…</p>}
    </div>
  );
}

export default function Page() {
  return <Suspense><Confirm /></Suspense>;
}
