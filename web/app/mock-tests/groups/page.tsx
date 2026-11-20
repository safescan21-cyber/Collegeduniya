'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UsersRound, Plus, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Groups() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState(''); const [code, setCode] = useState('');
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    const { data: mem } = await sb.from('study_group_members').select('group_id, role').eq('user_id', user.id);
    const ids = (mem || []).map((m: any) => m.group_id);
    if (!ids.length) { setRows([]); return; }
    const { data } = await sb.from('study_groups').select('id, name, code, owner_id, created_at').in('id', ids).order('created_at', { ascending: false });
    setRows(data || []);
  }, [user, sb]);
  useEffect(() => { load(); }, [load]);
  if (!loading && (!user || (user as any).is_anonymous)) return (
    <div className="container-x max-w-lg py-16 text-center"><UsersRound className="mx-auto text-brand-600" size={36} /><h1 className="mt-3 text-2xl font-extrabold">Study groups</h1>
      <p className="mt-2 text-slate-500">Take the same test as your friends or batch and compare on a private leaderboard.</p>
      <Link href="/login?mode=register&next=/mock-tests/groups" className="btn-primary mt-5">Register free to create or join</Link></div>);
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy('create');
    const { data, error } = await sb.from('study_groups').insert({ name: name.trim(), owner_id: user!.id }).select('id').single();
    setBusy(''); if (error) return setErr(error.message);
    router.push(`/mock-tests/groups/${data.id}`);
  };
  const join = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy('join');
    const { data, error } = await sb.rpc('join_study_group', { p_code: code });
    setBusy(''); if (error) return setErr(error.message);
    router.push(`/mock-tests/groups/${data}`);
  };
  return (
    <div className="container-x max-w-4xl py-10">
      <Link href="/mock-tests" className="text-sm text-slate-500 hover:underline">← Mock tests</Link>
      <h1 className="mt-2 flex items-center gap-2 text-3xl font-extrabold text-slate-900"><UsersRound className="text-brand-600" />Study groups</h1>
      <p className="mt-1 text-slate-500">Your coaching batch, class or friends take the same tests and compare scores on a private leaderboard.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <form onSubmit={create} className="card space-y-3 p-5"><p className="flex items-center gap-2 font-bold"><Plus size={17} />Create a group</p>
          <input className="input" required minLength={3} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. JEE 2027 — Batch A" />
          <button disabled={!!busy} className="btn-primary w-full">{busy === 'create' && <Loader2 size={16} className="animate-spin" />}Create</button></form>
        <form onSubmit={join} className="card space-y-3 p-5"><p className="flex items-center gap-2 font-bold"><LogIn size={17} />Join with a code</p>
          <input className="input uppercase tracking-widest" required minLength={6} maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" />
          <button disabled={!!busy} className="btn-ghost w-full">{busy === 'join' && <Loader2 size={16} className="animate-spin" />}Join group</button></form>
      </div>
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {rows.length > 0 && <div className="mt-8"><h2 className="text-lg font-bold">My groups</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{rows.map((g) => (
          <Link key={g.id} href={`/mock-tests/groups/${g.id}`} className="card p-4 hover:border-brand-300"><p className="font-semibold">{g.name}</p><p className="text-xs text-slate-500">{g.owner_id === user?.id ? `You own this group · code ${g.code}` : 'Member'}</p></Link>))}</div></div>}
    </div>
  );
}
