'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';

export default function DeleteAccount() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false); const [txt, setTxt] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  if (!user || (user as any).is_anonymous) return null;
  const go = async () => {
    setBusy(true); setErr('');
    try { await api('/api/account/delete', { method: 'POST', body: JSON.stringify({ confirm: txt }) }); await signOut(); location.href = '/?deleted=1'; }
    catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="card border-rose-100 p-5">
      <p className="font-bold text-slate-900">Delete my account</p>
      <p className="mt-1 text-sm text-slate-600">This permanently deletes your profile, posts, reviews, comments, chats, applications and test history. It cannot be undone. <Link href="/privacy" className="underline">Privacy policy</Link></p>
      {!open ? <button onClick={() => setOpen(true)} className="btn-ghost mt-3 text-rose-600"><Trash2 size={15} />Delete my account</button> : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className="input w-40" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Type DELETE" aria-label="Type DELETE to confirm" />
          <button onClick={go} disabled={txt !== 'DELETE' || busy} className="btn-primary bg-rose-600 hover:bg-rose-700">{busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}Delete forever</button>
          <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
          {err && <p className="w-full text-sm text-rose-600">{err}</p>}
        </div>)}
    </div>
  );
}
