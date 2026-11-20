import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase.js';
import { requireUser } from '../middleware/auth.js';
import { finishAttempt } from '../services/mockResults.js';
import { completeJson, llmReady } from '../services/llm.js';

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

// ---------------------------------------------------------------- AI explanations & hints
const EXPLAIN_PER_DAY = Number(process.env.AI_EXPLAIN_PER_DAY || 20);
const HINTS_PER_TEST = Number(process.env.AI_HINTS_PER_TEST || 3);
const aiLimit = rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: true, legacyHeaders: false });
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);   // India date

async function bumpUsage(uid, field, max) {
  const day = today();
  const { data } = await supabase.from('ai_usage').select('*').eq('user_id', uid).eq('day', day).maybeSingle();
  const used = data?.[field] || 0;
  if (used >= max) return false;
  if (data) await supabase.from('ai_usage').update({ [field]: used + 1 }).eq('user_id', uid).eq('day', day);
  else await supabase.from('ai_usage').insert({ user_id: uid, day, [field]: 1 });
  return true;
}
const examName = async (slug) => (await supabase.from('exams').select('short_name').eq('slug', slug).maybeSingle()).data?.short_name || slug;

// POST /api/mock/questions/:id/explain — concept, working, common mistake (made once per question, then shared)
router.post('/questions/:id/explain', aiLimit, requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'Bad id' });
    const { data: q } = await supabase.from('mock_questions').select('id, exam_slug, section, topic, stem, options, answer, explanation, ai_explanation').eq('id', id).maybeSingle();
    if (!q) return res.status(404).json({ error: 'Not found' });
    // only for questions you have finished (or today's question of the day)
    const { data: mine } = await supabase.from('mock_attempts').select('id').eq('user_id', req.user.id).eq('status', 'submitted').contains('question_ids', [id]).limit(1);
    let allowed = !!mine?.length;
    if (!allowed) { const { data: dq } = await supabase.rpc('daily_question', { p_exam: null }); allowed = dq?.[0]?.id === id || (await supabase.rpc('daily_question', { p_exam: q.exam_slug })).data?.[0]?.id === id; }
    if (!allowed) return res.status(403).json({ error: 'Finish the test first' });
    if (q.ai_explanation) return res.json({ explanation: q.ai_explanation, cached: true });
    if (!llmReady()) return res.status(503).json({ error: 'AI explanations are not available right now' });
    if (!(await bumpUsage(req.user.id, 'explains', EXPLAIN_PER_DAY))) return res.status(429).json({ error: `You have used today's ${EXPLAIN_PER_DAY} AI explanations. More tomorrow!` });
    const { data } = await completeJson({
      temperature: 0.3, maxTokens: 1200,
      system: `You are a friendly ${await examName(q.exam_slug)} teacher. Explain clearly for a student in simple English. Use Unicode for maths (x², √, π), no LaTeX.`,
      prompt: `Question (${q.section}${q.topic ? ' / ' + q.topic : ''}): ${q.stem}
Options: ${q.options.map((o, i) => `${'ABCDEF'[i]}. ${o}`).join(' | ')}
Correct answer: ${'ABCDEF'[q.answer]}. ${q.options[q.answer]}
${q.explanation ? `Short explanation we have: ${q.explanation}` : ''}
Return JSON {"concept":"the idea being tested, 1-2 sentences","working":"step-by-step solution, 3-8 short steps separated by newlines","mistake":"the most common wrong approach and why it fails, 1-2 sentences","tip":"one quick exam tip"}`,
    });
    const ex = { concept: String(data.concept || '').slice(0, 800), working: String(data.working || '').slice(0, 2500), mistake: String(data.mistake || '').slice(0, 800), tip: String(data.tip || '').slice(0, 300) };
    if (!ex.working) return res.status(502).json({ error: 'Could not explain this one — try again' });
    await supabase.from('mock_questions').update({ ai_explanation: ex }).eq('id', id);
    res.json({ explanation: ex, cached: false });
  } catch (e) {
    console.error('[explain]', e.message);
    res.status(502).json({ error: 'AI is busy — please try again in a minute' });
  }
});

// POST /api/mock/attempts/:id/hint { question_id } — sectional & topic tests only, a few per test, never the answer
router.post('/attempts/:id/hint', aiLimit, requireUser, async (req, res) => {
  try {
    const qid = String(req.body?.question_id || '');
    const { data: a } = await supabase.from('mock_attempts').select('id, user_id, status, deadline, practice, hints_used, question_ids').eq('id', req.params.id).maybeSingle();
    if (!a || a.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
    if (a.status !== 'in_progress' || new Date(a.deadline) < new Date()) return res.status(409).json({ error: 'Test is over' });
    if (!a.practice) return res.status(403).json({ error: 'Hints are for sectional and topic tests' });
    if (!a.question_ids.includes(qid)) return res.status(400).json({ error: 'Not in this test' });
    if (a.hints_used >= HINTS_PER_TEST) return res.status(429).json({ error: `You have used all ${HINTS_PER_TEST} hints for this test` });
    const { data: q } = await supabase.from('mock_questions').select('id, exam_slug, stem, options, answer, ai_hint').eq('id', qid).maybeSingle();
    let hint = q?.ai_hint;
    if (!hint) {
      if (!llmReady()) return res.status(503).json({ error: 'Hints are not available right now' });
      const { data } = await completeJson({
        temperature: 0.3, maxTokens: 300,
        system: `You are a ${await examName(q.exam_slug)} tutor giving a HINT, not the answer.`,
        prompt: `Question: ${q.stem}\nOptions: ${q.options.join(' | ')}\nWrite one or two sentences that point to the right concept or first step. Do NOT state the answer, the correct option, its letter or its value, and do not eliminate options by name.\nReturn JSON {"hint":"..."}`,
      });
      hint = String(data.hint || '').slice(0, 400);
      const leak = q.options[q.answer] && hint.toLowerCase().includes(String(q.options[q.answer]).toLowerCase()) && String(q.options[q.answer]).length > 2;
      if (!hint || leak) hint = 'Re-read the question and identify the concept it tests; write down what is given and what is asked before choosing.';
      else await supabase.from('mock_questions').update({ ai_hint: hint }).eq('id', qid);
    }
    await supabase.from('mock_attempts').update({ hints_used: a.hints_used + 1 }).eq('id', a.id);
    await bumpUsage(req.user.id, 'hints', 1000);
    res.json({ hint, left: HINTS_PER_TEST - a.hints_used - 1 });
  } catch (e) {
    console.error('[hint]', e.message);
    res.status(502).json({ error: 'Hint not available right now' });
  }
});

export default router;
