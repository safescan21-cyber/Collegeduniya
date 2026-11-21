import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { fetchJson } from './http.js';

// Razorpay (India). Keys from https://dashboard.razorpay.com → Settings → API Keys.
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
// Prices live on the server only (never trust the browser). Amounts in rupees; override with BOOST_PRICES JSON:
//   BOOST_PRICES={"hostel":{"7":99,"30":299},"job":{"7":149,"30":399}}
const DEFAULT_PRICES = { hostel: { 7: 99, 30: 299 }, job: { 7: 149, 30: 399 } };
export function boostPrices() {
  try { return { ...DEFAULT_PRICES, ...(process.env.BOOST_PRICES ? JSON.parse(process.env.BOOST_PRICES) : {}) }; }
  catch { return DEFAULT_PRICES; }
}
export const paymentsEnabled = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const API = process.env.RAZORPAY_API_URL || 'https://api.razorpay.com/v1';
const auth = () => `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export async function ownsItem(userId, type, id) {
  const table = type === 'hostel' ? 'hostels' : 'jobs';
  const owner = type === 'hostel' ? 'submitted_by' : 'created_by';
  const { data } = await supabase.from(table).select(`id, ${owner}, is_published, approval_status`).eq('id', id).maybeSingle();
  if (!data || data[owner] !== userId) return { ok: false, reason: 'Not your listing' };
  if (!data.is_published || data.approval_status !== 'approved') return { ok: false, reason: 'Your listing must be approved and live before it can be boosted' };
  return { ok: true };
}

export async function createBoostOrder({ userId, itemType, itemId, days }) {
  const price = boostPrices()[itemType]?.[String(days)];
  if (!price) throw Object.assign(new Error('Unknown boost plan'), { status: 422 });
  const own = await ownsItem(userId, itemType, itemId);
  if (!own.ok) throw Object.assign(new Error(own.reason), { status: 403 });
  const amount = Math.round(price * 100);
  const order = await fetchJson(`${API}/orders`, {
    method: 'POST', headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'INR', receipt: `boost_${itemType}_${Date.now()}`.slice(0, 40), notes: { item_type: itemType, item_id: itemId, days: String(days) } }),
  });
  const { error } = await supabase.from('payments').insert({
    user_id: userId, item_type: itemType, item_id: itemId, days: Number(days), amount, currency: 'INR', provider_order_id: order.id,
  });
  if (error) throw error;
  return { order_id: order.id, amount, currency: 'INR', key_id: process.env.RAZORPAY_KEY_ID };
}

// Mark paid + start / extend the promotion. Idempotent (safe if both browser and webhook call it).
export async function activatePayment(orderId, paymentId) {
  const { data: p } = await supabase.from('payments').select('*').eq('provider_order_id', orderId).maybeSingle();
  if (!p) throw Object.assign(new Error('Unknown order'), { status: 404 });
  if (p.status === 'paid') return { already: true };
  const { data: upd } = await supabase.from('payments').update({ status: 'paid', provider_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq('id', p.id).eq('status', 'created').select('id');
  if (!upd?.length) return { already: true };   // another request activated it first
  const { data: current } = await supabase.from('promotions').select('ends_at').eq('item_type', p.item_type).eq('item_id', p.item_id)
    .gt('ends_at', new Date().toISOString()).order('ends_at', { ascending: false }).limit(1);
  const start = current?.[0]?.ends_at ? new Date(current[0].ends_at) : new Date();
  const end = new Date(start.getTime() + p.days * 864e5);
  await supabase.from('promotions').insert({ item_type: p.item_type, item_id: p.item_id, starts_at: start.toISOString(), ends_at: end.toISOString(), payment_id: p.id, created_by: p.user_id, note: `Boost ${p.days} days` });
  return { activated: true, ends_at: end.toISOString() };
}

export function verifyCheckoutSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  return safeEqual(expected, razorpay_signature);
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
