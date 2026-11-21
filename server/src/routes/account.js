import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase.js';
import { requireUser } from '../middleware/auth.js';

// POST /api/account/delete {confirm: "DELETE"} — deletes the login and, through the database's ON DELETE rules,
// the profile, posts, reviews, comments, chats, applications and test history. Uploaded files are removed too.
const router = Router();
const limit = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });

async function removeFolder(bucket, prefix) {
  for (let i = 0; i < 50; i++) {
    const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 100 });
    if (!data?.length) return;
    await supabase.storage.from(bucket).remove(data.map((f) => `${prefix}/${f.name}`));
    if (data.length < 100) return;
  }
}

router.post('/delete', limit, requireUser, async (req, res) => {
  if (req.body?.confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm' });
  const id = req.user.id;
  if (['admin', 'super_admin'].includes(req.profile?.role)) return res.status(403).json({ error: 'Admins must be removed by a super admin first' });
  try {
    await Promise.all([removeFolder('community', id), removeFolder('verification', id)]);
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
    console.log(`[account] deleted ${id}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('[account] delete failed', e.message);
    res.status(500).json({ error: 'Could not delete right now — please email us and we will do it.' });
  }
});

export default router;
