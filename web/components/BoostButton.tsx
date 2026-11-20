'use client';
import { useEffect, useState } from 'react';
import { Rocket, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';

declare global { interface Window { Razorpay?: any } }
type Prices = { enabled: boolean; currency: string; prices: Record<string, Record<string, number>> };
let pricesPromise: Promise<Prices> | null = null;

function loadCheckout() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load the payment window'));
    document.body.appendChild(s);
  });
}

// "Boost" a live PG or job: appears first in search with a "Sponsored" label for 7 / 30 days.
export default function BoostButton({ itemType, itemId, title, live, boostedUntil }: { itemType: 'hostel' | 'job'; itemId: string; title: string; live: boolean; boostedUntil?: string | null }) {
  const [p, setP] = useState<Prices | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { (pricesPromise ||= api('/api/payments/boost/prices')).then(setP).catch(() => {}); }, []);
  if (!p?.enabled) return null;
  const plans = Object.entries(p.prices[itemType] || {});

  const buy = async (days: string) => {
    setBusy(days); setMsg('');
    try {
      await loadCheckout();
      const o = await api('/api/payments/boost/order', { method: 'POST', body: JSON.stringify({ item_type: itemType, item_id: itemId, days: Number(days) }) });
      const rz = new window.Razorpay({
        key: o.key_id, order_id: o.order_id, amount: o.amount, currency: o.currency, name: 'StudyEarnstay', description: `Boost "${title}" for ${days} days`,
        theme: { color: '#4f46e5' },
        handler: async (r: any) => {
          try { await api('/api/payments/boost/verify', { method: 'POST', body: JSON.stringify(r) }); setMsg(`Boosted for ${days} days ✓`); setOpen(false); }
          catch (e: any) { setMsg(e.message); }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rz.open();
    } catch (e: any) { setMsg(e.message); }
    setBusy(null);
  };

  return (
    <span className="relative inline-flex flex-col">
      <button type="button" disabled={!live} title={live ? '' : 'Available once the listing is approved and live'} onClick={() => setOpen(!open)} className="btn-ghost py-1.5 text-amber-700">
        <Rocket size={14} />{boostedUntil && new Date(boostedUntil) > new Date() ? `Boosted till ${new Date(boostedUntil).toLocaleDateString()}` : 'Boost'}
      </button>
      {open && (
        <span className="absolute end-0 top-full z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-xl">
          <span className="mb-2 flex items-center justify-between font-semibold">Show first in search <button type="button" onClick={() => setOpen(false)}><X size={14} /></button></span>
          <span className="mb-2 block text-xs text-slate-500">Your listing appears at the top of {itemType === 'hostel' ? 'PG' : 'job'} results in its city, marked “Sponsored”.</span>
          {plans.map(([days, price]) => (
            <button key={days} type="button" onClick={() => buy(days)} disabled={!!busy} className="mb-1 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-amber-50">
              <span>{days} days</span><span className="font-bold">{busy === days ? <Loader2 size={14} className="animate-spin" /> : `₹${price}`}</span>
            </button>
          ))}
        </span>
      )}
      {msg && <span className="mt-1 text-xs text-slate-600">{msg}</span>}
    </span>
  );
}
