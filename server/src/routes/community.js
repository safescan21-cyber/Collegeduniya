import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { requireUser } from '../middleware/auth.js';
import { sendMail, mailEnabled } from '../services/mailer.js';

// Email nudges (only when SMTP_URL is set). The browser calls these right after it saves a visit request / message.
const router = Router();
const limit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const SITE = (process.env.SITE_URL || 'https://studyearnstay.com').replace(/\/$/, '');

async function once(key, hours) {   // true the first time in `hours`
  const { data } = await supabase.from('api_cache').select('fetched_at').eq('key', key).maybeSingle();
  if (data && Date.now() - new Date(data.fetched_at).getTime() < hours * 3600e3) return false;
  await supabase.from('api_cache').upsert({ key, payload: {}, fetched_at: new Date().toISOString() });
  return true;
}

router.post('/notify/visit', limit, requireUser, wrap(async (req, res) => {
  if (!mailEnabled()) return res.json({ ok: true, mailed: false });
  const { visit_id } = z.object({ visit_id: z.string().uuid() }).parse(req.body);
  const { data: v } = await supabase.from('hostel_visits').select('*, hostels(name, contact_email, submitted_by)').eq('id', visit_id).eq('user_id', req.user.id).maybeSingle();
  if (!v) return res.status(404).json({ error: 'Not found' });
  let to = v.hostels?.contact_email;
  if (!to && v.hostels?.submitted_by) to = (await supabase.from('profiles').select('email').eq('id', v.hostels.submitted_by).single()).data?.email;
  const mailed = await sendMail({
    to, subject: `Visit request for ${v.hostels?.name}: ${v.visit_date}`,
    text: `${v.name} wants to ${v.mode === 'video_call' ? 'see your PG on a video call' : 'visit your PG'} on ${v.visit_date}${v.slot ? ` (${v.slot})` : ''}.\n\nConfirm or reschedule in your owner dashboard: ${SITE}/owner\n\nNote: ${v.note || '—'}`,
  }).catch(() => false);
  res.json({ ok: true, mailed });
}));

router.post('/notify/message', limit, requireUser, wrap(async (req, res) => {
  if (!mailEnabled()) return res.json({ ok: true, mailed: false });
  const { conversation_id } = z.object({ conversation_id: z.string().uuid() }).parse(req.body);
  const { data: c } = await supabase.from('conversations').select('user_a, user_b').eq('id', conversation_id).maybeSingle();
  if (!c || ![c.user_a, c.user_b].includes(req.user.id)) return res.status(404).json({ error: 'Not found' });
  const other = c.user_a === req.user.id ? c.user_b : c.user_a;
  if (!(await once(`notify:msg:${conversation_id}:${other}`, 1))) return res.json({ ok: true, mailed: false });
  const { data: p } = await supabase.from('profiles').select('email').eq('id', other).single();
  const mailed = await sendMail({ to: p?.email, subject: 'You have a new message on StudyEarnstay', text: `Someone sent you a message. Read and reply: ${SITE}/messages?c=${conversation_id}\n\n(You get at most one email per conversation per hour.)` }).catch(() => false);
  res.json({ ok: true, mailed });
}));

export default router;
