import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase.js';
import { leadSchema, newsletterSchema } from '../schemas.js';
import { autoShare } from '../services/leadShare.js';

const router = Router();

const formLimit = rateLimit({ windowMs: 10 * 60_000, limit: 8, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests — please try again in a few minutes.' } });

// POST /api/leads — "Get free counselling" / college or PG enquiry
router.post('/leads', formLimit, async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return res.status(422).json({ error: first || 'Please check the form' });
  }
  const { website: _hp, ...lead } = parsed.data;
  lead.user_id = req.user?.id || null;
  if (!lead.email && req.user?.email) lead.email = req.user.email;
  const { data: saved, error } = await supabase.from('leads').insert(lead).select('id, college_id, consent_share').single();
  if (!error) autoShare(saved).catch(() => {});
  if (error) {
    console.error('[leads]', error.message);
    return res.status(500).json({ error: 'Could not send your request, please try again.' });
  }
  res.status(201).json({ ok: true });
});

// POST /api/newsletter — subscribe
router.post('/newsletter', formLimit, async (req, res) => {
  const parsed = newsletterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Enter a valid email address' });
  const { email, interests = [], source = 'site' } = parsed.data;
  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert({ email, interests, source, unsubscribed: false }, { onConflict: 'email' });
  if (error) {
    console.error('[newsletter]', error.message);
    return res.status(500).json({ error: 'Could not subscribe, please try again.' });
  }
  res.status(201).json({ ok: true });
});

// GET /api/newsletter/unsubscribe?email=...
router.get('/newsletter/unsubscribe', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (email) await supabase.from('newsletter_subscribers').update({ unsubscribed: true }).eq('email', email);
  res.json({ ok: true });
});

export default router;
