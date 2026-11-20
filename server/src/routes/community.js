import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireUser } from '../middleware/auth.js';

const router = Router();
const limit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
// Notifications for visit requests and messages are now queued by database triggers (migration 012) and delivered
// by services/notifier.js (WhatsApp or email). These endpoints stay so older browsers calling them don't error.
router.post('/notify/visit', limit, requireUser, (_req, res) => res.json({ ok: true, queued: true }));
router.post('/notify/message', limit, requireUser, (_req, res) => res.json({ ok: true, queued: true }));

export default router;
