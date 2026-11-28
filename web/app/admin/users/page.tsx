'use client';
import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, Ban, CheckCircle2, Activity, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { timeAgo } from '@/lib/format';

export default function AdminUsers() {
  const { profile } = useAuth();
  const isSuper = profile?.role === 'super_admin';
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [act, setAct] = useState<{ user: any; logins: any[]; mocks: any[] } | null>(null);
  const openActivity = async (u: any) => { const r = await api(`/api/admin/users/${u.id}/activity`).catch(() => ({ logins: [], mocks: [] })); setAct({ user: u, ...r }); };

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '25' });
    if (role) p.set('role', role);
    if (search) p.set('q', search);
    const r = await api(`/api/admin/users?${p}`).catch(() => ({ data: [], count: 0 }));
    setRows(r.data); setCount(r.count); setLoading(false);
  }, [role, search, page]);
  useEffect(() => { load(); }, [load]);

  const update = async (id: string, body: any) => {
    try { await api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Users & admins <span className="text-sm font-normal text-slate-400">({count})</span></h1>
        <div className="flex flex-wrap gap-2">
          <select className="input w-40" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">All roles</option><option value="student">Students</option><option value="admin">Admins</option><option value="super_admin">Super admins</option>
          </select>
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }} className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input w-56 pl-9" placeholder="Name, email, phone" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
        </div>
      </div>
      {!isSuper && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Only a super admin can add or remove admins. You can block / unblock students.</p>}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Role</th><th className="px-4 py-3 text-right">Access</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" /></td></tr>
              : rows.map((u) => {
                const self = u.id === profile?.id;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3"><p className="font-semibold text-slate-900">{u.full_name || '—'} {self && <span className="chip ml-1">you</span>}</p><p className="text-xs text-slate-500">{u.email}{u.username ? <> · <a href={`/u/${u.username}`} target="_blank" className="underline">@{u.username}</a></> : ''}</p>
                      <p className="text-xs text-slate-400">{u.last_seen_at ? `last seen ${timeAgo(u.last_seen_at)}` : 'not seen yet'} · <button onClick={() => openActivity(u)} className="inline-flex items-center gap-0.5 text-brand-700 underline"><Activity size={11} />logins & mock tests</button></p></td>
                    <td className="px-4 py-3 text-slate-600">{u.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{timeAgo(u.created_at)}</td>
                    <td className="px-4 py-3">
                      {isSuper && !self ? (
                        <select className="input py-1.5" value={u.role} onChange={(e) => update(u.id, { role: e.target.value })}>
                          <option value="student">Student</option><option value="admin">Admin</option><option value="super_admin">Super admin</option>
                        </select>
                      ) : <span className={u.role === 'student' ? 'chip' : 'chip-brand'}>{u.role.replace('_', ' ')}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!self && (isSuper || u.role === 'student') && (u.is_blocked
                        ? <button onClick={() => update(u.id, { is_blocked: false })} className="btn-ghost px-2 py-1.5 text-emerald-700"><CheckCircle2 size={14} />Unblock</button>
                        : <button onClick={() => update(u.id, { is_blocked: true })} className="btn-ghost px-2 py-1.5 text-rose-600"><Ban size={14} />Block</button>)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {act && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" onClick={() => setAct(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{act.user.full_name || act.user.email}</h3><button onClick={() => setAct(null)} aria-label="Close"><X /></button></div>
            <p className="mt-4 font-semibold">Recent logins</p>
            <ul className="mt-1 divide-y divide-slate-100 text-sm">{act.logins.map((l) => <li key={l.id} className="flex justify-between gap-2 py-1.5"><span>{l.device}{l.city ? ` · ${l.city}` : ''}{l.country ? `, ${l.country}` : ''} <span className="text-xs text-slate-400">{l.method}</span></span><span className="text-xs text-slate-500">{new Date(l.created_at).toLocaleString()}</span></li>)}
              {!act.logins.length && <li className="py-2 text-slate-400">None recorded</li>}</ul>
            <p className="mt-5 font-semibold">Mock tests</p>
            <ul className="mt-1 divide-y divide-slate-100 text-sm">{act.mocks.map((m) => <li key={m.id} className="flex justify-between gap-2 py-1.5"><span>{m.title}</span><span className="text-xs text-slate-500">{m.score != null ? `${Number(m.score)}/${Number(m.max_score)} · ${Number(m.percentile)} pct` : m.status} · {timeAgo(m.started_at)}</span></li>)}
              {!act.mocks.length && <li className="py-2 text-slate-400">No tests yet</li>}</ul>
          </div>
        </div>
      )}
      {count > 25 && (
        <div className="mt-4 flex justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost">Prev</button>
          <button disabled={page >= Math.ceil(count / 25)} onClick={() => setPage(page + 1)} className="btn-ghost">Next</button>
        </div>
      )}
    </div>
  );
}
