'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, EyeOff, Loader2, Search, ShieldOff, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

export default function ContentReports() {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState<any[] | null>(null);
  const [ctx, setCtx] = useState<Record<string, any>>({}); const [busy, setBusy] = useState('');
  const load = useCallback(() => api<{ data: any[] }>(`/api/admin/content_reports?status=${status}`).then((r) => setRows(r.data)).catch(() => setRows([])), [status]);
  useEffect(() => { load(); }, [load]);
  const investigate = async (r: any) => { setBusy(r.id); try { const c = await api<any>(`/api/admin/content_reports/${r.id}/context`); setCtx((x) => ({ ...x, [r.id]: c })); } finally { setBusy(''); } };
  const act = async (r: any, what: string) => {
    const c = ctx[r.id];
    setBusy(r.id + what);
    try {
      if (what === 'hide' && r.target_type === 'post') await api(`/api/admin/posts/${r.target_id}`, { method: 'PATCH', body: JSON.stringify({ status: 'hidden', hidden_reason: 'Removed after a report' }) });
      if (what === 'hide' && r.target_type === 'comment') await api(`/api/admin/post_comments/${r.target_id}`, { method: 'PATCH', body: JSON.stringify({ status: 'hidden' }) });
      if (what === 'restore' && r.target_type === 'post') await api(`/api/admin/posts/${r.target_id}`, { method: 'PATCH', body: JSON.stringify({ status: 'published', hidden_reason: null }) });
      if (what === 'block' && c?.user) { if (!confirm(`Block ${c.user.full_name || c.user.email}? They will not be able to log in, post or chat.`)) return; await api(`/api/admin/users/${c.user.id}`, { method: 'PATCH', body: JSON.stringify({ is_blocked: true }) }); }
      if (what === 'untick' && c?.user) await api(`/api/admin/users/${c.user.id}/unverify`, { method: 'POST' });
      if (['hide', 'block', 'untick', 'actioned'].includes(what)) await api(`/api/admin/content_reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'actioned' }) });
      if (what === 'dismiss' || what === 'restore') await api(`/api/admin/content_reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }) });
      load();
    } catch (e: any) { alert(e.message); } finally { setBusy(''); }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><h1 className="text-xl font-bold">Reports from students</h1>
        <select className="input ms-auto w-auto py-1.5" value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Open</option><option value="actioned">Actioned</option><option value="dismissed">Dismissed</option></select></div>
      {rows === null ? <div className="card h-40 animate-pulse" /> : rows.length === 0 ? <div className="card p-8 text-center text-slate-500">No {status} reports 🎉</div> : rows.map((r) => {
        const c = ctx[r.id];
        return (
          <div key={r.id} className="card p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p><span className="chip">{r.target_type}</span> <b>{r.reason}</b></p><p className="text-xs text-slate-500">by {r.profiles?.full_name} ({r.profiles?.email}) · {new Date(r.created_at).toLocaleString('en-IN')} · {timeAgo(r.created_at)}</p></div>
              {!c && <button onClick={() => investigate(r)} className="btn-ghost py-1 text-xs">{busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}Investigate</button>}
            </div>
            {c && (
              <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                {c.user && <p>Reported person: <b>{c.user.full_name}</b> {c.user.username && <Link href={`/u/${c.user.username}`} target="_blank" className="text-brand-700">@{c.user.username}</Link>} · {c.user.email} · {c.user.colleges?.name || 'no college'} · {c.user.verification}{c.user.is_blocked ? ' · BLOCKED' : ''} · joined {new Date(c.user.created_at).toLocaleDateString('en-IN')} · <b>{c.user_reports}</b> report(s) against this account</p>}
                {c.target && r.target_type === 'post' && <div className="rounded-lg bg-white p-2"><p className="text-xs text-slate-500">Post ({c.target.status}) · {new Date(c.target.created_at).toLocaleString('en-IN')}</p>{c.target.title && <p className="font-semibold">{c.target.title}</p>}<p className="whitespace-pre-wrap">{c.target.body}</p><Link href={`/community/post/${c.target.id}`} target="_blank" className="text-xs text-brand-700">Open post</Link></div>}
                {c.target && r.target_type === 'comment' && <div className="rounded-lg bg-white p-2"><p className="text-xs text-slate-500">Comment · {new Date(c.target.created_at).toLocaleString('en-IN')}</p><p>{c.target.body}</p></div>}
                {c.messages && <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-white p-2"><p className="text-xs text-slate-500">Last {c.messages.length} messages (reported person in red)</p>{c.messages.map((m: any, i: number) => (
                  <p key={i} className={m.sender_id === c.user?.id ? 'text-rose-700' : 'text-slate-700'}><span className="text-[10px] text-slate-400">{new Date(m.created_at).toLocaleString('en-IN')}</span> {m.body}</p>))}</div>}
                {c.recent_posts?.length > 0 && <details><summary className="cursor-pointer text-xs text-slate-600">Their recent posts ({c.recent_posts.length})</summary><ul className="mt-1 list-disc ps-5 text-xs">{c.recent_posts.map((p: any) => <li key={p.id}><Link href={`/community/post/${p.id}`} target="_blank">{p.title || (p.body || '').slice(0, 80)}</Link> · {p.status}</li>)}</ul></details>}
                <div className="flex flex-wrap gap-2">
                  {['post', 'comment'].includes(r.target_type) && c.target && <button onClick={() => act(r, 'hide')} className="btn-ghost py-1 text-xs"><EyeOff size={13} />Hide {r.target_type}</button>}
                  {r.target_type === 'post' && c.target?.status === 'hidden' && <button onClick={() => act(r, 'restore')} className="btn-ghost py-1 text-xs"><Check size={13} />Restore post (false report)</button>}
                  {c.user && !c.user.is_blocked && <button onClick={() => act(r, 'block')} className="btn-ghost py-1 text-xs text-rose-600"><Ban size={13} />Block user</button>}
                  {c.user?.verification === 'verified' && <button onClick={() => act(r, 'untick')} className="btn-ghost py-1 text-xs"><ShieldOff size={13} />Remove tick</button>}
                  {status === 'open' && <button onClick={() => act(r, 'dismiss')} className="btn-ghost py-1 text-xs"><X size={13} />Dismiss</button>}
                </div>
              </div>)}
          </div>);
      })}
    </div>
  );
}
