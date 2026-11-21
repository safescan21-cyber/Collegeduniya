import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase.js';
import { requireUser } from '../middleware/auth.js';
import { completeJson, visionReady } from '../services/llm.js';

// Selfie verification for the green tick.
//   POST /api/verify/start            → random live challenge (valid 5 minutes)
//   POST /api/verify/:id/submit       → two camera frames (plain face + doing the challenge); AI decides
//   GET  /api/verify/status
// Selfies go to the private "verification" bucket and are deleted as soon as a decision is made
// (kept only while an admin still has to look).
const router = Router();
const limit = rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: true, legacyHeaders: false });

const CHALLENGES = [
  'Hold up two fingers next to your face',
  'Hold up three fingers next to your face',
  'Give a thumbs up next to your face',
  'Touch your ear with one hand',
  'Put one hand on your forehead',
  'Cover one eye with your hand',
  'Hold your open palm next to your face',
];
const MAX_TRIES_PER_DAY = 3;
const supaBase = (process.env.SUPABASE_URL || '').replace(/\/$/, '');

function decodeImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 8_000 || buf.length > 1_500_000) return null;            // too small to be a real photo / too big
  return { mime: m[1], data: m[2], buf };
}

// only the profile photo uploaded to our own bucket, in the student's own folder (never an arbitrary URL)
async function profilePhoto(userId, url) {
  const prefix = `${supaBase}/storage/v1/object/public/community/${userId}/`;
  if (!url || !url.startsWith(prefix) || url.includes('..')) return null;
  const path = decodeURIComponent(url.slice(`${supaBase}/storage/v1/object/public/community/`.length).split('?')[0]);
  const { data, error } = await supabase.storage.from('community').download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  const mime = data.type && /^image\/(jpeg|png|webp)$/.test(data.type) ? data.type : 'image/jpeg';
  if (buf.length > 4_000_000) return null;
  return { mime, data: buf.toString('base64') };
}

router.get('/status', requireUser, async (req, res) => {
  const [{ data: p }, { data: last }] = await Promise.all([
    supabase.from('profiles').select('verification, verified_at, gender, avatar_url').eq('id', req.user.id).single(),
    supabase.from('identity_verifications').select('id, status, reason, created_at, decided_at').eq('user_id', req.user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  res.json({ verification: p?.verification || 'none', verified_at: p?.verified_at, has_photo: !!p?.avatar_url, has_gender: !!p?.gender,
             last, ai: visionReady() });
});

router.post('/start', limit, requireUser, async (req, res) => {
  if (req.user.is_anonymous) return res.status(403).json({ error: 'Create a free account first' });
  const { data: p } = await supabase.from('profiles').select('gender, avatar_url, account_type, verification').eq('id', req.user.id).single();
  if (!p?.gender) return res.status(400).json({ error: 'Choose your gender in your profile first' });
  if (!p?.avatar_url) return res.status(400).json({ error: 'Upload a clear profile photo of your face first' });
  if (p.account_type && p.account_type !== 'student') return res.status(403).json({ error: 'Verification is for student accounts' });
  if (p.verification === 'verified') return res.status(409).json({ error: 'You are already verified' });
  if (p.verification === 'review') return res.status(409).json({ error: 'Your last check is with our team — you will hear back soon' });
  const since = new Date(Date.now() - 86400e3).toISOString();
  const { count } = await supabase.from('identity_verifications').select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id).neq('status', 'started').gte('created_at', since);
  if ((count || 0) >= MAX_TRIES_PER_DAY) return res.status(429).json({ error: `You can try ${MAX_TRIES_PER_DAY} times a day. Please try again tomorrow.` });
  const challenge = CHALLENGES[crypto.randomInt(CHALLENGES.length)];
  const { data, error } = await supabase.from('identity_verifications').insert({ user_id: req.user.id, challenge }).select('id').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.id, challenge, expires_in: 300 });
});

router.post('/:id/submit', limit, requireUser, async (req, res) => {
  const id = String(req.params.id);
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'Bad id' });
  const { data: row } = await supabase.from('identity_verifications').select('*').eq('id', id).maybeSingle();
  if (!row || row.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
  if (row.status !== 'started') return res.status(409).json({ error: 'This check was already used — start again' });
  if (Date.now() - new Date(row.created_at).getTime() > 5 * 60e3) {
    await supabase.from('identity_verifications').update({ status: 'expired' }).eq('id', id);
    return res.status(410).json({ error: 'Time is up — start again' });
  }
  const front = decodeImage(req.body?.front); const act = decodeImage(req.body?.challenge);
  if (!front || !act) return res.status(400).json({ error: 'Take both photos with your camera' });
  const { data: p } = await supabase.from('profiles').select('gender, avatar_url').eq('id', req.user.id).single();
  const photo = await profilePhoto(req.user.id, p?.avatar_url);
  if (!photo) return res.status(400).json({ error: 'Upload your profile photo again on this site, then retry' });

  const paths = [`${req.user.id}/${id}-1.jpg`, `${req.user.id}/${id}-2.jpg`];
  await Promise.all([
    supabase.storage.from('verification').upload(paths[0], front.buf, { contentType: front.mime, upsert: true }),
    supabase.storage.from('verification').upload(paths[1], act.buf, { contentType: act.mime, upsert: true }),
  ]);
  await supabase.from('identity_verifications').update({ status: 'pending', selfie_paths: paths }).eq('id', id);
  await supabase.from('profiles').update({ verification: 'pending' }).eq('id', req.user.id);

  let status = 'review'; let reason = 'Our team will check your photos within 24 hours.'; let ai = null;
  if (visionReady()) {
    try {
      const { data, model } = await completeJson({
        system: 'You check selfies for a student community, to stop fake accounts. Be strict about spoofing, fair to everyone, and never comment on looks.',
        prompt: `Image 1 is the student's profile photo. Image 2 is a live camera selfie. Image 3 is a live camera selfie where they were asked to: "${row.challenge}".
The student says their gender is: ${p.gender}.
Answer:
- real_live_person: images 2 and 3 show a real person in front of a camera (not a photo of a screen, a printed photo, a mask, a cartoon or an edited image)
- spoof_signs: any sign of a screen, moiré, paper edges, cut-outs, deepfake artefacts
- challenge_done: image 3 clearly shows the requested action
- same_person_in_selfies: images 2 and 3 show the same person
- matches_profile_photo: the person in the selfies is the person in image 1
- face_clear: the face is clearly visible in images 2 and 3
- presents_as: "female", "male" or "unclear" — only how the person presents in the selfies
- confidence: 0 to 1 for your overall answer
- reason: one short sentence the student will read (no remarks about appearance)
Return JSON {"real_live_person":bool,"spoof_signs":bool,"challenge_done":bool,"same_person_in_selfies":bool,"matches_profile_photo":bool,"face_clear":bool,"presents_as":"female|male|unclear","confidence":0.0,"reason":"..."}`,
        images: [photo, { mime: front.mime, data: front.data }, { mime: act.mime, data: act.data }],
        maxTokens: 500, temperature: 0,
      });
      ai = { ...data, model };
      const conf = Number(data.confidence) || 0;
      const allGood = data.real_live_person && !data.spoof_signs && data.challenge_done && data.same_person_in_selfies
        && data.matches_profile_photo && data.face_clear && conf >= 0.75;
      const genderOk = p.gender !== 'female' || data.presents_as === 'female';
      if (allGood && genderOk) { status = 'verified'; reason = 'You are verified.'; }
      else if (conf >= 0.75 && (data.spoof_signs || !data.real_live_person)) { status = 'rejected'; reason = 'These photos did not look like a live camera selfie. Please try again in good light.'; }
      else if (conf >= 0.75 && data.face_clear && !data.matches_profile_photo) { status = 'rejected'; reason = 'The selfie does not match your profile photo. Use a clear photo of your own face as your profile photo.'; }
      else if (conf >= 0.75 && !data.challenge_done) { status = 'rejected'; reason = `We could not see you doing the action ("${row.challenge}"). Please try again.`; }
      else { status = 'review'; reason = 'Our team will take a quick look and confirm within 24 hours.'; }
    } catch (e) {
      console.warn('[verify] AI failed:', e.message);
    }
  }

  await supabase.from('identity_verifications').update({ status, ai, reason, decided_by: status === 'review' ? null : 'ai',
    decided_at: status === 'review' ? null : new Date().toISOString(), selfie_paths: status === 'review' ? paths : [] }).eq('id', id);
  await supabase.from('profiles').update({ verification: status, verified_at: status === 'verified' ? new Date().toISOString() : null }).eq('id', req.user.id);
  if (status !== 'review') await supabase.storage.from('verification').remove(paths);   // keep nothing we don't need
  res.json({ status, reason });
});

export default router;
