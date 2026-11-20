import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import { requireUser } from '../middleware/auth.js';
import { boostPrices, paymentsEnabled, createBoostOrder, activatePayment, verifyCheckoutSignature, verifyWebhookSignature } from '../services/payments.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/boost/prices', (_req, res) => res.json({ enabled: paymentsEnabled(), currency: 'INR', prices: boostPrices() }));

router.post('/boost/order', requireUser, wrap(async (req, res) => {
  if (!paymentsEnabled()) return res.status(503).json({ error: 'Payments are not set up yet' });
  const b = z.object({ item_type: z.enum(['hostel', 'job']), item_id: z.string().uuid(), days: z.coerce.number().int() }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: 'Invalid request' });
  res.json(await createBoostOrder({ userId: req.user.id, itemType: b.data.item_type, itemId: b.data.item_id, days: b.data.days }));
}));

router.post('/boost/verify', requireUser, wrap(async (req, res) => {
  const b = z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }).safeParse(req.body);
  if (!b.success || !verifyCheckoutSignature(b.data)) return res.status(400).json({ error: 'Payment could not be verified' });
  res.json(await activatePayment(b.data.razorpay_order_id, b.data.razorpay_payment_id));
}));

// Razorpay → Settings → Webhooks: URL https://api.studyearnstay.com/api/payments/razorpay/webhook, events: order.paid
export const webhook = [express.raw({ type: 'application/json', limit: '1mb' }), wrap(async (req, res) => {
  if (!verifyWebhookSignature(req.body, req.get('x-razorpay-signature'))) return res.status(400).json({ error: 'bad signature' });
  const evt = JSON.parse(req.body.toString('utf8'));
  const orderId = evt?.payload?.order?.entity?.id || evt?.payload?.payment?.entity?.order_id;
  const paymentId = evt?.payload?.payment?.entity?.id || null;
  if (['order.paid', 'payment.captured'].includes(evt?.event) && orderId) await activatePayment(orderId, paymentId).catch((e) => console.warn('[webhook]', e.message));
  res.json({ ok: true });
})];

export default router;
