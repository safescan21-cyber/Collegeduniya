'use client';
import ResourceManager from '@/components/admin/ResourceManager';

export default function AdminPromotions() {
  return (
    <div className="space-y-4">
      <p className="card p-4 text-sm text-slate-600">Sponsored placements show first in search with a “Sponsored” label. Paid boosts by owners/employers are added here automatically; you can also add deals manually (e.g. a college sponsorship).</p>
      <ResourceManager resource="promotions" title="Sponsored listings"
        fields={[
          { name: 'item_type', label: 'Type', type: 'select', options: ['college', 'hostel', 'job', 'quota_seat'], required: true },
          { name: 'item_id', label: 'Item ID (from its page URL / admin)', type: 'text', required: true, full: true },
          { name: 'starts_at', label: 'Starts', type: 'date' }, { name: 'ends_at', label: 'Ends', type: 'date', required: true },
          { name: 'note', label: 'Note (deal, invoice no.)', type: 'text', full: true },
        ]}
        columns={[{ key: 'item_type', label: 'Type' }, { key: 'item_id', label: 'Item', render: (r) => <code className="text-xs">{r.item_id.slice(0, 8)}…</code> },
          { key: 'starts_at', label: 'From', render: (r) => new Date(r.starts_at).toLocaleDateString() }, { key: 'ends_at', label: 'To', render: (r) => new Date(r.ends_at).toLocaleDateString() },
          { key: 'note', label: 'Note' }, { key: 'paid', label: 'Paid', render: (r) => (r.payment_id ? <span className="chip-green">Paid online</span> : <span className="chip">Manual</span>) }]} />
    </div>
  );
}
