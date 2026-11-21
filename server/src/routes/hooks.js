import express from 'express';
import crypto from 'node:crypto';
import { sendOtp, otpReady } from '../services/whatsapp.js';

// Supabase Auth → "Send SMS" hook (HTTPS). Supabase generates the login code and POSTs it here; we deliver it on
// WhatsApp. Requests are signed with the Standard Webhooks scheme using SEND_SMS_HOOK_SECRET ("v1,whsec_…").
// Mounted before express.json because the signature covers the raw body.
const router = express.Router();
const TOLERANCE = 5 * 60;

export function verifyStandardWebhook(raw, headers, secretSetting) {
  const id = headers['webhook-id']; const ts = headers['webhook-timestamp']; const sigs = String(headers['webhook-signature'] || '');
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > TOLERANCE) return false;
  for (const secret of String(secretSetting || '').split('|').map((s) => s.trim()).filter(Boolean)) {
    const key = Buffer.from(secret.replace(/^v1,whsec_/, ''), 'base64');
    const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest();
    for (const part of sigs.split(' ')) {
      const [ver, b64] = part.split(',');
      if (ver !== 'v1' || !b64) continue;
      const got = Buffer.from(b64, 'base64');
      if (got.length === expected.length && crypto.timingSafeEqual(got, expected)) return true;
    }
  }
  return false;
}

const hookError = (res, code, message) => res.status(code).json({ error: { http_code: code, message } });

router.post('/send-sms', express.text({ type: '*/*', limit: '64kb' }), async (req, res) => {
  const raw = typeof req.body === 'string' ? req.body : '';
  if (!process.env.SEND_SMS_HOOK_SECRET || !verifyStandardWebhook(raw, req.headers, process.env.SEND_SMS_HOOK_SECRET)) {
    return hookError(res, 401, 'Invalid signature');
  }
  if (!otpReady()) return hookError(res, 503, 'WhatsApp login is not configured yet. Please log in with email.');
  let payload;
  try { payload = JSON.parse(raw); } catch { return hookError(res, 400, 'Bad payload'); }
  const phone = payload?.user?.phone; const otp = payload?.sms?.otp;
  if (!phone || !otp) return hookError(res, 400, 'Missing phone or code');
  try {
    await sendOtp(phone, otp);
    res.json({});
  } catch (e) {
    console.error('[send-sms hook]', e.message);
    hookError(res, 502, 'Could not send the WhatsApp code. Check the number has WhatsApp, or log in with email.');
  }
});

export default router;
