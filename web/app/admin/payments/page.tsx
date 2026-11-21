'use client';
import ModerationList from '@/components/admin/ModerationList';
import { timeAgo } from '@/lib/format';

export default function AdminPayments() {
  return (
    <ModerationList resource="payments" title="Payments (Razorpay)" exportName="payments" statusField="status" canDelete={false}
      statusOptions={['created', 'paid', 'failed', 'refunded']}
      tabs={[{ label: 'Paid', params: { status: 'paid' } }, { label: 'Started', params: { status: 'created' } }, { label: 'All', params: {} }]}
      columns={[
        { key: 'who', label: 'Customer', render: (r) => <div><p className="font-medium">{r.profiles?.full_name || '—'}</p><p className="text-xs text-slate-500">{r.profiles?.email}</p></div> },
        { key: 'what', label: 'Purchase', render: (r) => `Boost ${r.item_type} · ${r.days} days` },
        { key: 'amount', label: 'Amount', render: (r) => `₹${(r.amount / 100).toLocaleString('en-IN')}` },
        { key: 'ids', label: 'Razorpay', render: (r) => <div className="text-xs"><p>{r.provider_order_id}</p><p className="text-slate-400">{r.provider_payment_id}</p></div> },
        { key: 'when', label: 'When', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
      ]} />
  );
}
