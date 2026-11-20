import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase.js';
import { trackSchema } from '../schemas.js';

const router = Router();

// 60 page-views per minute per IP is plenty for a real visitor
router.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

// POST /api/track  { visitor_id, path, referrer }
router.post('/', async (req, res) => {
  const parsed = trackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Invalid payload' });
  const ua = String(req.headers['user-agent'] || '').slice(0, 300);
  if (/bot|crawler|spider|preview|headless/i.test(ua)) return res.json({ ok: true, skipped: 'bot' });

  const { error } = await supabase.from('site_visits').insert({
    visitor_id: parsed.data.visitor_id,
    path: parsed.data.path || '/',
    referrer: parsed.data.referrer || null,
    user_agent: ua,
    user_id: req.user?.id || null,
    // Cloudflare / Nginx GeoIP header if available
    country: req.headers['cf-ipcountry'] || req.headers['x-country'] || null,
  });
  if (error) {
    console.error('[track]', error.message);
    return res.status(500).json({ error: 'Could not record visit' });
  }
  res.json({ ok: true });
});

export default router;
