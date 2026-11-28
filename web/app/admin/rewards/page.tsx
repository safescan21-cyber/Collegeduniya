'use client';
import { useState } from 'react';
import ResourceManager from '@/components/admin/ResourceManager';
import ModerationList from '@/components/admin/ModerationList';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

function Grant() {
  const [f, setF] = useState({ user_id: '', points: '', note: '' });
  const [msg, setMsg] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg('');
    try { await api('/api/admin/rewards/grant', { method: 'POST', body: JSON.stringify(f) }); setMsg('Done ✓'); setF({ user_id: '', points: '', note: '' }); }
    catch (er: any) { setMsg(er.message); }
  };
  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-5">
      <div><label className="label">User ID</label><input className="input w-80" required value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value.trim() })} placeholder="from Users & Admins" /></div>
      <div><label className="label">Points (− to deduct)</label><input className="input w-32" type="number" required value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} /></div>
      <div className="flex-1"><label className="label">Reason</label><input className="input" required minLength={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Contest winner, correction…" /></div>
      <button className="btn-primary">Add points</button>{msg && <span className="text-sm text-slate-600">{msg}</span>}
    </form>
  );
}

export default function AdminRewards() {
  return (
    <div className="space-y-8">
      <div className="card p-5 text-sm text-slate-600">
        <h1 className="text-xl font-extrabold text-slate-900">Rewards</h1>
        <p className="mt-1">Points are added automatically: <b>50</b> for a review you mark verified, <b>10</b> per college / quota application, <b>20</b> per referral (pending until the new student applies or posts a review). Students redeem points for items in the catalog; you send the voucher code here and the points of a rejected request go back.</p>
      </div>
      <ModerationList resource="reward_redemptions" title="Redemption requests" statusField="status" noteField="admin_note" canDelete={false}
        statusOptions={['requested', 'fulfilled', 'rejected']}
        tabs={[{ label: 'To do', params: { status: 'requested' } }, { label: 'All', params: {} }]}
        extraActions={(r, patch) => (
          <input className="input w-40 py-1.5 text-xs" placeholder="Voucher code" defaultValue={r.voucher || ''}
            onBlur={(e) => { if ((e.target.value || '') !== (r.voucher || '')) patch({ voucher: e.target.value }); }} />
        )}
        columns={[
          { key: 'who', label: 'Student', render: (r) => <div><p className="font-medium">{r.profiles?.full_name}</p><p className="text-xs text-slate-500">{r.profiles?.email} · {r.profiles?.phone}</p></div> },
          { key: 'what', label: 'Reward', render: (r) => <div><p>{r.reward_catalog?.title || r.reward_code}</p><p className="text-xs text-slate-500">{r.points} points</p></div> },
          { key: 'when', label: 'Requested', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
        ]} />
      <ResourceManager resource="reward_catalog" idKey="code" title="Catalog" defaults={{ is_active: true }}
        fields={[
          { name: 'code', label: 'Code (a-z, 0-9, _ -)', type: 'text', required: true, placeholder: 'amazon-100' },
          { name: 'title', label: 'Title', type: 'text', required: true, placeholder: '₹100 Amazon gift card' },
          { name: 'points', label: 'Points needed', type: 'number', required: true },
          { name: 'stock', label: 'Stock (blank = unlimited)', type: 'number' },
          { name: 'is_active', label: 'Active', type: 'bool' },
        ]}
        columns={[
          { key: 'title', label: 'Reward', render: (r) => <span className="font-medium">{r.title}</span> }, { key: 'points', label: 'Points' },
          { key: 'stock', label: 'Stock', render: (r) => (r.stock == null ? '∞' : r.stock) },
          { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? <span className="chip-green">Active</span> : <span className="chip">Off</span>) },
        ]} />
      <div><h2 className="mb-3 text-lg font-bold text-slate-900">Give or deduct points</h2><Grant /></div>
      <ModerationList resource="reward_points" title="Points ledger" statusField="status" noteField="note" canDelete={false}
        statusOptions={['pending', 'approved', 'reversed']}
        tabs={[{ label: 'All', params: {} }, { label: 'Pending', params: { status: 'pending' } }, { label: 'Referrals', params: { reason: 'referral' } }]}
        columns={[
          { key: 'who', label: 'Student', render: (r) => <div><p className="font-medium">{r.profiles?.full_name}</p><p className="text-xs text-slate-500">{r.profiles?.email}</p></div> },
          { key: 'points', label: 'Points', render: (r) => <span className={r.points < 0 ? 'text-rose-600' : 'text-emerald-700'}>{r.points > 0 ? '+' : ''}{r.points}</span> },
          { key: 'reason', label: 'For', render: (r) => <span className="chip">{r.reason.replace(/_/g, ' ')}</span> },
          { key: 'when', label: 'When', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
        ]} />
    </div>
  );
}
