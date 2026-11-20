import { supabase } from '../supabase.js';
import { llmReady } from './llm.js';
import { draftBlueprint, generateQuestions, reviewReported, examInfo } from './mockGen.js';

// Mock-test AUTOPILOT — the AI does the work, admins only spot-check.
// Every MOCK_AUTOPILOT_MINUTES (default 60), when Admin → Mock tests → Autopilot is ON:
//   1. exams without a test pattern get one drafted by the AI (marked "AI-drafted, not yet checked")
//   2. every topic's question bank is topped up to the target size; questions the second AI pass agrees with are
//      approved, disagreements go to a third pass that keeps, corrects or rejects them
//   3. questions students reported are re-reviewed: kept, corrected (and re-checked) or rejected
//   4. tests are published once each section has enough approved questions
// A daily budget caps how many questions the AI writes per day (cost control).
let running = null;
const log = (exam_slug, action, detail) => supabase.from('mock_autopilot_log').insert({ exam_slug, action, detail: String(detail ?? '').slice(0, 1000) }).then(() => undefined, () => undefined);
export const autopilotRunning = () => running;

async function settings() {
  const { data } = await supabase.from('mock_settings').select('*').eq('id', 1).maybeSingle();
  return data || { autopilot: false, auto_publish: true, target_per_topic: 10, daily_budget: 300, min_ready_ratio: 1 };
}

async function usedToday() {
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase.from('mock_questions').select('id', { count: 'exact', head: true }).eq('source', 'ai').gte('created_at', since.toISOString());
  return count || 0;
}

async function handleReports(slug, exam, maxItems = 10) {
  const { data: reps } = await supabase.from('mock_question_reports').select('id, question_id, reason').eq('status', 'open').limit(500);
  const qids = Array.from(new Set((reps || []).map((r) => r.question_id)));
  if (!qids.length) return;
  const { data: qs } = await supabase.from('mock_questions').select('id, exam_slug, section, topic, difficulty, stem, options, answer, explanation, status').in('id', qids);
  const byQ = new Map();
  for (const q of (qs || []).filter((x) => x.exam_slug === slug && x.status !== 'rejected' && qids.includes(x.id))) byQ.set(q.id, { q, ids: [], reasons: [] });
  for (const r of reps || []) { const e = byQ.get(r.question_id); if (e) { e.ids.push(r.id); e.reasons.push(r.reason); } }
  let n = 0;
  for (const { q, ids, reasons } of byQ.values()) {
    if (n++ >= maxItems) break;
    try {
      const v = await reviewReported(q, reasons, exam);
      if (v.action === 'keep') {
        await supabase.from('mock_questions').update({ status: 'approved', ai_review: `Report reviewed — question is correct. ${v.reason}` }).eq('id', q.id);
        await supabase.from('mock_question_reports').update({ status: 'dismissed' }).in('id', ids);
        await log(slug, 'report_dismissed', `${q.stem.slice(0, 80)} — ${v.reason}`);
      } else if (v.action === 'fix') {
        await supabase.from('mock_questions').update({ ...v.fixed, topic: q.topic, status: 'approved', auto_approved: true, checked_by_admin: false, ai_check: 'agree', reports: 0, ai_review: `Corrected after student report. ${v.reason}` }).eq('id', q.id);
        await supabase.from('mock_question_reports').update({ status: 'fixed' }).in('id', ids);
        await log(slug, 'report_fixed', `${q.stem.slice(0, 80)} — ${v.reason}`);
      } else {
        await supabase.from('mock_questions').update({ status: 'rejected', ai_review: `Rejected after student report. ${v.reason}` }).eq('id', q.id);
        await supabase.from('mock_question_reports').update({ status: 'fixed' }).in('id', ids);
        await log(slug, 'rejected', `Reported question removed — ${v.reason}`);
      }
    } catch (e) { await log(slug, 'error', `report review: ${e.message}`); }
  }
}

async function runExam(exam, s, budget) {
  const slug = exam.slug;
  let { data: bp } = await supabase.from('mock_blueprints').select('*').eq('exam_slug', slug).maybeSingle();
  if (!bp) {
    if (budget <= 0) return budget;
    const d = await draftBlueprint(slug);
    const { note, ...row } = d;
    const ins = await supabase.from('mock_blueprints').insert({ ...row, is_published: false, autopilot: true, ai_drafted: true, pattern_checked: false,
      instructions: row.instructions }).select().single();
    if (ins.error) throw ins.error;
    bp = ins.data;
    await log(slug, 'pattern_drafted', `${bp.sections.length} sections, ${bp.duration_min} min. Admin should verify: ${note || 'against the official notice'}`);
  }
  if (!bp.autopilot) return budget;
  const { exam: info } = await examInfo(slug);
  await handleReports(slug, info);

  // bank size per section/topic
  const { data: have } = await supabase.from('mock_questions').select('section, topic').eq('exam_slug', slug).eq('status', 'approved').limit(20000);
  const count = new Map();
  for (const r of have || []) { const k = `${r.section}|${r.topic || ''}`; count.set(k, (count.get(k) || 0) + 1); }
  let made = 0;
  for (const sec of bp.sections) {
    const topics = sec.topics?.length ? sec.topics : [null];
    // each topic needs enough for its share of a paper, and at least the configured target
    const perTopic = Math.max(s.target_per_topic, Math.ceil((sec.questions * Number(s.min_ready_ratio)) / topics.length));
    for (const t of topics) {
      if (budget <= 0) break;
      const deficit = perTopic - (count.get(`${sec.name}|${t || ''}`) || 0);
      if (deficit <= 0) continue;
      const n = Math.min(deficit, 10, budget);
      try {
        const r = await generateQuestions({ slug, section: sec.name, topic: t, count: n, autopilot: true });
        budget -= r.created; made += r.created;
        await log(slug, 'generated', `${sec.name}/${t || 'mixed'}: ${r.created} written, ${r.approved} approved${r.repaired ? `, ${r.repaired} corrected` : ''}${r.rejected ? `, ${r.rejected} rejected` : ''}`);
      } catch (e) { await log(slug, 'error', `${sec.name}/${t || 'mixed'}: ${e.message}`); }
    }
  }

  // publish when every section has enough approved questions for a full paper
  if (!bp.is_published && s.auto_publish) {
    const { data: ok } = await supabase.from('mock_questions').select('section').eq('exam_slug', slug).eq('status', 'approved').limit(20000);
    const per = new Map(); (ok || []).forEach((r) => per.set(r.section, (per.get(r.section) || 0) + 1));
    if (bp.sections.every((x) => (per.get(x.name) || 0) >= x.questions)) {
      await supabase.from('mock_blueprints').update({ is_published: true }).eq('exam_slug', slug);
      await log(slug, 'published', `Test is live (${bp.ai_drafted && !bp.pattern_checked ? 'AI-drafted pattern — please confirm it' : 'pattern confirmed'})`);
    }
  }
  await supabase.from('mock_blueprints').update({ last_autopilot_at: new Date().toISOString() }).eq('exam_slug', slug);
  return budget;
}

export async function runAutopilot({ force = false, only = null } = {}) {
  if (running) return { already: true, started_at: running };
  const s = await settings();
  if (!s.autopilot && !force) return { skipped: 'autopilot is off' };
  if (!llmReady()) { await log(null, 'error', 'AI is not configured'); return { skipped: 'AI not configured' }; }
  running = new Date().toISOString();
  try {
    let budget = Math.max(0, s.daily_budget - (await usedToday()));
    const startBudget = budget;
    let q = supabase.from('exams').select('slug, short_name').eq('is_published', true);
    if (only) q = q.eq('slug', only);
    const { data: exams } = await q;
    const { data: bps } = await supabase.from('mock_blueprints').select('exam_slug, last_autopilot_at');
    const last = new Map((bps || []).map((b) => [b.exam_slug, b.last_autopilot_at ? Date.parse(b.last_autopilot_at) : 0]));
    // exams that waited longest go first, so the daily budget is shared fairly
    const order = (exams || []).sort((a, b) => (last.get(a.slug) ?? -1) - (last.get(b.slug) ?? -1));
    for (const e of order) {
      try { budget = await runExam(e, s, budget); } catch (err) { await log(e.slug, 'error', err.message); }
    }
    if (budget <= 0 && startBudget > 0) await log(null, 'budget_reached', `Daily budget of ${s.daily_budget} new questions used — writing resumes tomorrow (reports and publishing keep running)`);
    return { ok: true, budget_left: budget };
  } finally { running = null; }
}

export function startAutopilot() {
  if (process.env.MOCK_AUTOPILOT === 'off') return;
  const every = Math.max(10, Number(process.env.MOCK_AUTOPILOT_MINUTES || 60)) * 60_000;
  const tick = () => runAutopilot().catch((e) => console.error('[autopilot]', e.message));
  setTimeout(tick, 90_000);
  setInterval(tick, every).unref();
}
