// Scholarship stories: a signed-in student who received a scholarship tells how they got it.
// Shown only after an admin approves. The optional award-letter photo is kept privately until the admin decides, then deleted.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';

const router = Router();
const limit = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many tries — try again in an hour.' } });
const UUID = /^[0-9a-f-]{36}$/;
const year = new Date().getFullYear();
const clean = (s) => (s == null ? null : String(s).replace(/<[^>]*>/g, '').replace(/\s+\n/g, '\n').trim() || null);

const storySchema = z.object({
  display_name: z.string().trim().min(2).max(60),
  college: z.string().trim().max(120).optional().nullable(),
  course: z.string().trim().max(120).optional().nullable(),
  year_awarded: z.coerce.number().int().min(1990).max(year),
  story: z.string().trim().min(80, 'Write at least a few sentences (80+ characters)').max(3000),
  tips: z.string().trim().max(1500).optional().nullable(),
  proof: z.string().max(1_700_000).optional().nullable(),     // data URL of a photo of the award letter (optional)
  consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm the story is true and yours' }) }),
});

function decodeImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 5_000 || buf.length > 1_200_000) return null;
  return { mime: m[1], buf };
}
const removeProof = (path) => path && supabase.storage.from('verification').remove([path]).catch(() => {});

// the student's own story for this scholarship (to show "pending" / let them edit)
router.get('/scholarships/:id/my-story', requireUser, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const { data } = await supabase.from('scholarship_stories').select('id, status, display_name, college, course, year_awarded, story, tips, verified')
    .eq('scholarship_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  res.json({ data: data || null });
});

router.post('/scholarships/:id/stories', requireUser, limit, async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Bad id' });
    const p = storySchema.safeParse(req.body);
    if (!p.success) return res.status(422).json({ error: p.error.issues[0]?.message || 'Check the form' });
    const { data: sch } = await supabase.from('scholarships').select('id').eq('id', req.params.id).eq('is_published', true).maybeSingle();
    if (!sch) return res.status(404).json({ error: 'Scholarship not found' });
    const { data: old } = await supabase.from('scholarship_stories').select('id, proof_path, status').eq('scholarship_id', sch.id).eq('user_id', req.user.id).maybeSingle();
    const d = p.data;
    let proof = null;
    if (d.proof) { proof = decodeImage(d.proof); if (!proof) return res.status(422).json({ error: 'The photo must be a JPG/PNG under 1 MB' }); }
    const row = {
      scholarship_id: sch.id, user_id: req.user.id, display_name: clean(d.display_name), college: clean(d.college), course: clean(d.course),
      year_awarded: d.year_awarded, story: clean(d.story), tips: clean(d.tips),
      status: 'pending', verified: false, approved_at: null, admin_note: null,   // every edit is checked again
    };
    const { data: saved, error } = await supabase.from('scholarship_stories').upsert(row, { onConflict: 'scholarship_id,user_id' }).select('id').single();
    if (error) throw error;
    if (proof) {
      const path = `${req.user.id}/scholarship-${saved.id}.${proof.mime.split('/')[1]}`;
      if (old?.proof_path && old.proof_path !== path) await removeProof(old.proof_path);
      const up = await supabase.storage.from('verification').upload(path, proof.buf, { contentType: proof.mime, upsert: true });
      if (!up.error) await supabase.from('scholarship_stories').update({ proof_path: path }).eq('id', saved.id);
    }
    res.json({ ok: true, status: 'pending' });
  } catch (e) { console.error('[stories]', e.message); res.status(500).json({ error: 'Could not save — try again.' }); }
});

// ---------------------------------------------------------------- admin
router.get('/admin/scholarship-stories', requireAdmin, async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const { data, error } = await supabase.from('scholarship_stories')
    .select('*, scholarships(name, slug), profiles(full_name, email)').eq('status', status).order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  const rows = await Promise.all((data || []).map(async (r) => ({
    ...r, proof_url: r.proof_path ? (await supabase.storage.from('verification').createSignedUrl(r.proof_path, 600)).data?.signedUrl || null : null,
  })));
  res.json({ data: rows });
});

router.patch('/admin/scholarship-stories/:id', requireAdmin, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const p = z.object({ status: z.enum(['approved', 'rejected', 'pending']), verified: z.boolean().optional(), admin_note: z.string().max(500).optional().nullable() }).safeParse(req.body);
  if (!p.success) return res.status(422).json({ error: 'Bad input' });
  const { data: r } = await supabase.from('scholarship_stories').select('proof_path').eq('id', req.params.id).maybeSingle();
  if (!r) return res.status(404).json({ error: 'Not found' });
  const patch = { status: p.data.status, admin_note: p.data.admin_note ?? null };
  if (p.data.verified !== undefined) patch.verified = p.data.status === 'approved' && p.data.verified && Boolean(r.proof_path);
  if (p.data.status === 'approved') patch.approved_at = new Date().toISOString();
  if (p.data.status !== 'pending' && r.proof_path) { await removeProof(r.proof_path); patch.proof_path = null; }   // keep nothing we don't need
  const { error } = await supabase.from('scholarship_stories').update(patch).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.delete('/admin/scholarship-stories/:id', requireAdmin, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const { data: r } = await supabase.from('scholarship_stories').select('proof_path').eq('id', req.params.id).maybeSingle();
  await removeProof(r?.proof_path);
  await supabase.from('scholarship_stories').delete().eq('id', req.params.id);
  res.json({ ok: true });
});

export default router;
