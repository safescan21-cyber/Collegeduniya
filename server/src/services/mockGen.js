import { supabase } from '../supabase.js';
import { completeJson, llmReady } from './llm.js';

// AI question bank for mock tests.
//  1. generate original MCQs for an exam / section / topic
//  2. a second, independent AI pass answers each question without seeing the key → ai_check agree / disagree
//  3. questions are saved as drafts for admin review (or approved straight away when the pattern has
//     "auto-publish AI-checked questions" on AND the check agreed)

const DIFF = ['easy', 'medium', 'hard'];

const clean = (s, max) => String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);

export async function examInfo(slug) {
  const { data: exam } = await supabase.from('exams').select('slug, short_name, full_name, stream, level, country, conducting_body, pattern, syllabus').eq('slug', slug).maybeSingle();
  if (!exam) throw new Error('Exam not found');
  const { data: bp } = await supabase.from('mock_blueprints').select('*').eq('exam_slug', slug).maybeSingle();
  return { exam, bp };
}

// Draft a test pattern; the admin must check it against the official notice before publishing
export async function draftBlueprint(slug) {
  const { exam } = await examInfo(slug);
  const { data } = await completeJson({
    system: 'You design practice mock tests that mirror the structure of real entrance and language exams. Be accurate; if unsure about the official pattern, choose a sensible scaled-down practice format and say so in "note".',
    prompt: `Exam: ${exam.full_name} (${exam.short_name}), ${exam.country || ''}, conducted by ${exam.conducting_body || 'unknown'}.
${exam.pattern ? `Pattern notes from our database: ${exam.pattern.slice(0, 1500)}\n` : ''}${exam.syllabus ? `Syllabus notes: ${exam.syllabus.slice(0, 1500)}\n` : ''}
Return JSON: {"title": "<exam> full mock test", "duration_min": int, "instructions": "short candidate instructions incl. marking",
 "sections": [{"name": "Physics", "topics": ["8-20 syllabus topics"], "questions": int, "correct": marks for correct (number), "wrong": marks for wrong (0 or negative number)}],
 "note": "what an admin must verify against the official notice"}
Only multiple-choice (single correct) questions are supported, so convert numeric/written parts into MCQs. Max 12 sections, max 200 questions in total.`,
    maxTokens: 3000, temperature: 0.3,
  });
  const sections = (data.sections || []).slice(0, 12).map((s) => ({
    name: clean(s.name, 60), topics: (s.topics || []).map((t) => clean(t, 80)).filter(Boolean).slice(0, 40),
    questions: Math.max(1, Math.min(200, parseInt(s.questions, 10) || 10)),
    correct: Number.isFinite(Number(s.correct)) ? Number(s.correct) : 1, wrong: Number.isFinite(Number(s.wrong)) ? Math.min(0, Number(s.wrong)) : 0,
  })).filter((s) => s.name);
  if (!sections.length) throw new Error('AI returned no sections');
  return {
    exam_slug: slug, title: clean(data.title || `${exam.short_name} mock test`, 120),
    duration_min: Math.max(5, Math.min(360, parseInt(data.duration_min, 10) || 60)),
    instructions: clean(data.instructions, 2000), sections, note: clean(data.note, 1000),
  };
}

function validQuestion(q, nOpts = 4) {
  const options = (Array.isArray(q.options) ? q.options : []).map((o) => clean(o, 500)).filter(Boolean);
  const answer = parseInt(q.answer, 10);
  const stem = clean(q.stem || q.question, 4000);
  if (stem.length < 10 || options.length < 2 || options.length > 6 || !(answer >= 0 && answer < options.length)) return null;
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return null;   // duplicate options
  return { stem, options: options.slice(0, Math.max(nOpts, options.length)), answer, explanation: clean(q.explanation, 3000) || null,
    difficulty: DIFF.includes(q.difficulty) ? q.difficulty : 'medium', topic: clean(q.topic, 80) || null };
}

// Independent check: the model answers without the key
async function crossCheck(exam, qs, avoid = null) {
  if (!qs.length) return [];
  try {
    const { data } = await completeJson({
      check: true, avoid, temperature: 0,
      system: `You are a careful ${exam.short_name} subject expert. Solve each question independently.`,
      prompt: `For each question pick the single correct option (0-based index). If no option is correct or several are, use -1.
Return JSON {"answers":[int,...]} in the same order.\n\n${JSON.stringify(qs.map((q, i) => ({ i, question: q.stem, options: q.options })))}`,
      maxTokens: 800,
    });
    return (data.answers || []).map((a) => parseInt(a, 10));
  } catch (e) {
    console.warn('[mockGen] check failed', e.message);
    return [];
  }
}

// Third pass for a disagreement between the writer's key and the checker's answer
export async function judge(exam, q, other, avoid = null) {
  try {
    const { data } = await completeJson({
      check: true, avoid, temperature: 0, maxTokens: 900,
      system: `You are a meticulous ${exam.short_name} examiner. Work the problem out fully before deciding. A question must have exactly one correct option.`,
      prompt: `Question: ${q.stem}\nOptions: ${JSON.stringify(q.options)}\nAnswer key says option ${q.answer}; another solver chose option ${other}.
Return JSON {"correct": index of the single correct option or -1 if none/several, "ambiguous": true|false, "explanation": "1-4 sentence working", "reason": "one sentence"}`,
    });
    const c = parseInt(data.correct, 10);
    if (data.ambiguous || !(c >= 0 && c < q.options.length)) return { action: 'reject', reason: String(data.reason || 'ambiguous or no correct option').slice(0, 200) };
    if (c === q.answer) return { action: 'keep', reason: String(data.reason || '').slice(0, 200) };
    if (c === other) return { action: 'fix', answer: c, explanation: String(data.explanation || '').slice(0, 3000), reason: String(data.reason || '').slice(0, 200) };
    return { action: 'reject', reason: 'three passes gave three different answers' };
  } catch (e) { return { action: 'reject', reason: `re-check failed: ${e.message}`.slice(0, 200) }; }
}

// Student reports: the AI decides whether the report is right and fixes / rejects / keeps the question
export async function reviewReported(question, reasons, exam) {
  const { data, provider } = await completeJson({
    check: true, temperature: 0, maxTokens: 1500,
    system: `You are a meticulous ${exam.short_name} examiner reviewing a practice question that students reported. Solve it yourself first.`,
    prompt: `Question: ${question.stem}\nOptions: ${JSON.stringify(question.options)}\nAnswer key: option ${question.answer}\nExplanation: ${question.explanation || '-'}
Student reports:\n${reasons.map((r) => '- ' + r).join('\n')}
Return JSON {"action":"keep"|"fix"|"reject","reason":"one sentence",
 "fixed": null or {"stem":"...","options":["..."],"answer":int,"explanation":"..."}}
keep = the question and key are correct as they are; fix = small correction makes it right (give the full corrected question); reject = unclear or unfixable.`,
  });
  const action = ['keep', 'fix', 'reject'].includes(data.action) ? data.action : 'reject';
  const fixed = action === 'fix' && data.fixed ? validQuestion({ ...data.fixed, difficulty: question.difficulty, topic: question.topic }) : null;
  if (action === 'fix' && !fixed) return { action: 'reject', reason: 'fix was not a valid question' };
  if (fixed) {
    const [chk] = await crossCheck(exam, [fixed], provider);   // the corrected version must pass an independent check too
    if (chk !== fixed.answer) return { action: 'reject', reason: 'corrected version failed the independent check' };
  }
  return { action, fixed, reason: String(data.reason || '').slice(0, 300) };
}

export async function generateQuestions({ slug, section, topic = null, difficulty = 'mixed', count = 10, autopilot = false }) {
  if (!llmReady()) throw new Error('AI is not configured');
  const { exam, bp } = await examInfo(slug);
  const sec = (bp?.sections || []).find((s) => s.name === section);
  const n = Math.max(1, Math.min(20, count));
  const { data: recent } = await supabase.from('mock_questions').select('stem').eq('exam_slug', slug).eq('section', section)
    .order('created_at', { ascending: false }).limit(25);
  const { data, model, provider } = await completeJson({
    temperature: 0.8, maxTokens: 6000,
    system: `You write ORIGINAL practice questions for the ${exam.full_name} (${exam.short_name}). Match the real exam's level, style and syllabus.
Rules: never copy questions from past papers, books or websites; exactly one correct option; plausible distractors; no "all/none of the above";
plain text (use Unicode for maths, e.g. x², √, π, ≤, →); self-contained (no images or diagrams); explanation shows the working in 1-4 sentences.`,
    prompt: `Section: ${section}${topic ? `\nTopic: ${topic}` : sec?.topics?.length ? `\nSpread across these topics: ${sec.topics.join(', ')}` : ''}
Difficulty: ${difficulty === 'mixed' ? 'mix of easy, medium and hard (about 30/50/20%)' : difficulty}
Number of questions: ${n}. Each has 4 options.
${recent?.length ? `Do not repeat these existing questions:\n${recent.map((r) => '- ' + r.stem.slice(0, 140)).join('\n')}\n` : ''}
Return JSON {"questions":[{"stem":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","topic":"...","difficulty":"easy|medium|hard"}]}`,
  });
  const qs = (data.questions || []).map((q) => validQuestion(q)).filter(Boolean).slice(0, n);
  const checks = await crossCheck(exam, qs, provider);
  const auto = autopilot || Boolean(bp?.auto_publish_verified);
  const rows = [];
  for (const [i, q] of qs.entries()) {
    const agree = checks[i] === q.answer ? 'agree' : Number.isInteger(checks[i]) ? 'disagree' : 'unchecked';
    const row = { exam_slug: slug, section, topic: topic || q.topic, difficulty: q.difficulty, stem: q.stem, options: q.options, answer: q.answer,
      explanation: q.explanation, ai_check: agree, status: auto && agree === 'agree' ? 'approved' : 'draft', auto_approved: auto && agree === 'agree',
      source: 'ai', model, ai_review: agree === 'agree' ? 'Second AI pass agreed with the key' : null };
    if (autopilot && agree === 'disagree') {
      // a third, careful pass decides: keep the key, switch to the other answer, or throw the question away
      const v = await judge(exam, q, checks[i], provider);
      if (v.action === 'keep') Object.assign(row, { status: 'approved', auto_approved: true, ai_review: `Re-checked: key kept. ${v.reason}` });
      else if (v.action === 'fix') Object.assign(row, { status: 'approved', auto_approved: true, answer: v.answer, explanation: v.explanation || row.explanation, ai_check: 'agree', ai_review: `Re-checked: key corrected. ${v.reason}` });
      else Object.assign(row, { status: 'rejected', ai_review: `Rejected on re-check: ${v.reason}` });
    }
    rows.push(row);
  }
  if (rows.length) {
    const { error } = await supabase.from('mock_questions').insert(rows);
    if (error) throw error;
  }
  return { created: rows.length, agree: rows.filter((r) => r.ai_check === 'agree').length, disagree: rows.filter((r) => r.ai_check === 'disagree').length,
    approved: rows.filter((r) => r.status === 'approved').length, rejected: rows.filter((r) => r.status === 'rejected').length,
    repaired: rows.filter((r) => /key corrected/.test(r.ai_review || '')).length, model };
}

// Fill a whole exam: every section × topic, `perTopic` questions each (runs in the background)
const jobs = new Map();
export function jobStatus(id) { return jobs.get(id) || null; }

export function startBankJob({ slug, perTopic = 3 }) {
  const id = `${slug}-${Date.now()}`;
  const job = { id, slug, status: 'running', done: 0, total: 0, created: 0, agree: 0, errors: [], started_at: new Date().toISOString() };
  jobs.set(id, job);
  (async () => {
    try {
      const { bp } = await examInfo(slug);
      if (!bp) throw new Error('Create the test pattern first');
      const tasks = [];
      for (const s of bp.sections) {
        const topics = s.topics?.length ? s.topics : [null];
        for (const t of topics) tasks.push({ section: s.name, topic: t });
      }
      job.total = tasks.length;
      for (const t of tasks) {
        try {
          const r = await generateQuestions({ slug, section: t.section, topic: t.topic, count: perTopic });
          job.created += r.created; job.agree += r.agree;
        } catch (e) { job.errors.push(`${t.section}/${t.topic || '-'}: ${e.message}`); }
        job.done++;
      }
      job.status = 'done';
    } catch (e) { job.status = 'failed'; job.errors.push(e.message); }
    job.finished_at = new Date().toISOString();
    setTimeout(() => jobs.delete(id), 6 * 3600e3).unref?.();
  })();
  return job;
}
