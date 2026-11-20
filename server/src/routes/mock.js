import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase.js';
import { requireUser } from '../middleware/auth.js';
import { finishAttempt } from '../services/mockResults.js';

// POST /api/mock/attempts/:id/finish — called by the browser right after submit_mock: feedback + email
const router = Router();
const limit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

router.post('/attempts/:id/finish', limit, requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'Bad id' });
    const { data: a } = await supabase.from('mock_attempts').select('user_id, status').eq('id', id).maybeSingle();
    if (!a || a.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
    if (a.status !== 'submitted') return res.status(409).json({ error: 'Submit the test first' });
    res.json({ feedback: await finishAttempt(id) });
  } catch (e) {
    console.error('[mock finish]', e.message);
    res.status(500).json({ error: 'Could not prepare feedback — it will arrive by email shortly.' });
  }
});

export default router;
