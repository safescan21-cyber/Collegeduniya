import { supabase } from '../supabase.js';
import { completeJson, llmReady } from './llm.js';
import { sendMail, mailEnabled } from './mailer.js';

// After a mock test is submitted (scored in the database): build "where to improve" feedback,
// save it on the attempt, email the result and drop an in-app / WhatsApp notification.
const SITE = (process.env.SITE_URL || 'https://www.collegeolo.com').replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) : 0);
const num = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2));

// Works without AI: weak / strong topics from accuracy and skips
export function ruleFeedback(a) {
  const topics = (a.topic_stats || []).map((t) => ({ ...t, attempted: t.correct + t.wrong }));
  const weak = topics.filter((t) => (t.attempted > 0 && t.correct / t.attempted < 0.5) || (t.skipped > 0 && t.skipped >= t.total / 2))
    .sort((x, y) => (x.correct - x.wrong) / x.total - (y.correct - y.wrong) / y.total).slice(0, 6);
  const strong = topics.filter((t) => t.attempted >= 2 && t.correct / t.attempted >= 0.8).sort((x, y) => y.correct - x.correct).slice(0, 4);
  const lostToNegative = (a.sections || []).reduce((s, sec) => {
    const st = (a.section_stats || []).find((x) => x.section === sec.name);
    return s + (st ? st.wrong * Math.abs(Number(sec.wrong) || 0) : 0);
  }, 0);
  const attempted = a.correct + a.wrong; const total = attempted + a.unanswered;
  const plan = [];
  weak.slice(0, 3).forEach((t) => plan.push(`Revise ${t.topic} (${t.section}): you got ${t.correct} of ${t.total} right. Re-read the theory, then solve 20–30 questions on it.`));
  if (lostToNegative > 0 && a.wrong > a.correct / 3) plan.push(`You lost ${num(lostToNegative)} mark${Number(lostToNegative) === 1 ? '' : 's'} to negative marking. Skip a question unless you can rule out at least two options.`);
  if (a.unanswered > total * 0.25) plan.push(`You left ${a.unanswered} of ${total} questions unanswered. Practise timed section-wise tests to improve speed.`);
  if (!plan.length) plan.push('Good balance. Keep taking full-length mock tests under exam timing and review every mistake.');
  return {
    summary: `You scored ${num(a.score)} out of ${num(a.max_score)} with ${a.correct} correct, ${a.wrong} wrong and ${a.unanswered} unanswered (accuracy ${pct(a.correct, attempted)}%).`,
    strengths: strong.map((t) => `${t.topic} (${t.section}) — ${t.correct}/${t.total} correct`),
    weaknesses: weak.map((t) => `${t.topic} (${t.section}) — ${t.correct}/${t.total} correct${t.skipped ? `, ${t.skipped} skipped` : ''}`),
    plan, ai: false,
  };
}

async function aiFeedback(a, base) {
  if (!llmReady()) return base;
  try {
    const { data } = await completeJson({
      temperature: 0.4, maxTokens: 1200,
      system: 'You are an encouraging, practical exam coach for Indian and international students. Use only the numbers given; never invent scores.',
      prompt: `Mock test: ${a.title}. Duration ${a.duration_min} min, time used ${Math.round((new Date(a.submitted_at) - new Date(a.started_at)) / 60000)} min.
Score ${num(a.score)}/${num(a.max_score)}, correct ${a.correct}, wrong ${a.wrong}, unanswered ${a.unanswered}, percentile among our test-takers ${a.percentile}.
Marking: ${JSON.stringify(a.sections.map((s) => ({ section: s.name, correct: s.correct, wrong: s.wrong })))}
Sections: ${JSON.stringify(a.section_stats)}
Topics: ${JSON.stringify(a.topic_stats)}
Return JSON {"summary":"2 sentences","strengths":["max 4"],"weaknesses":["max 6, name the topic and why"],"plan":["4-7 concrete steps for the next 2 weeks, most important first"]}`,
    });
    const arr = (x, n) => (Array.isArray(x) ? x.map((s) => String(s).slice(0, 300)).filter(Boolean).slice(0, n) : []);
    const fb = { summary: String(data.summary || base.summary).slice(0, 600), strengths: arr(data.strengths, 4), weaknesses: arr(data.weaknesses, 6), plan: arr(data.plan, 7), ai: true };
    return fb.plan.length ? fb : base;
  } catch (e) {
    console.warn('[mock feedback]', e.message);
    return base;
  }
}

function resultEmail(a, fb, name) {
  const link = `${SITE}/mock-tests/result/${a.id}`;
  const rows = (a.section_stats || []).map((s) => `<tr><td style="padding:6px 10px;border-top:1px solid #eee">${esc(s.section)}</td><td style="padding:6px 10px;border-top:1px solid #eee">${num(s.score)} / ${num(s.max)}</td><td style="padding:6px 10px;border-top:1px solid #eee">${s.correct} ✓ · ${s.wrong} ✗ · ${s.skipped} –</td></tr>`).join('');
  const list = (title, items) => (items.length ? `<h3 style="margin:18px 0 6px">${title}</h3><ul style="margin:0;padding-left:18px">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;color:#1e293b">
    <h2 style="color:#4f46e5;margin-bottom:4px">${esc(a.title)} — your result</h2>
    <p style="margin-top:0;color:#64748b">Hi ${esc(name || 'there')}, here is how you did.</p>
    <p style="font-size:28px;font-weight:bold;margin:8px 0">${num(a.score)} <span style="font-size:16px;color:#64748b">/ ${num(a.max_score)}</span></p>
    <p style="margin:0;color:#475569">${a.rank ? `Rank <b>${a.rank.rank}</b> of ${a.rank.total} · ` : ''}Better than or equal to <b>${a.percentile}%</b> of Collegeolo test-takers.</p>
    <table style="border-collapse:collapse;margin-top:14px;width:100%;font-size:14px"><tr style="background:#f1f5f9"><th align="left" style="padding:6px 10px">Section</th><th align="left" style="padding:6px 10px">Score</th><th align="left" style="padding:6px 10px">Right · wrong · skipped</th></tr>${rows}</table>
    <p style="margin-top:16px">${esc(fb.summary)}</p>
    ${list('Where to improve', fb.weaknesses)}${list('Your study plan', fb.plan)}${list('Strengths', fb.strengths)}
    <p style="margin-top:20px"><a href="${link}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Review answers & explanations</a></p>
    <p style="color:#94a3b8;font-size:12px">Practice questions are AI-generated and reviewed; scores are indicative and do not predict your real exam result.</p></div>`;
  const text = [`${a.title} — your result`, `Score: ${num(a.score)} / ${num(a.max_score)} (percentile ${a.percentile})`, '',
    ...(a.section_stats || []).map((s) => `${s.section}: ${num(s.score)}/${num(s.max)} (${s.correct} right, ${s.wrong} wrong, ${s.skipped} skipped)`), '',
    fb.summary, '', 'Where to improve:', ...fb.weaknesses.map((x) => `- ${x}`), '', 'Study plan:', ...fb.plan.map((x) => `- ${x}`), '', `Review: ${link}`].join('\n');
  return { html, text };
}

export async function finishAttempt(id) {
  const { data: a, error } = await supabase.from('mock_attempts').select('*, profiles(email, full_name)').eq('id', id).maybeSingle();
  if (error || !a) throw new Error('Attempt not found');
  if (a.status !== 'submitted') throw new Error('Test not submitted yet');
  let fb = a.feedback;
  if (!fb) {
    fb = await aiFeedback(a, ruleFeedback(a));
    await supabase.from('mock_attempts').update({ feedback: fb }).eq('id', id);
  }
  if (!a.emailed_at) {
    // claim the send first so two callers can't email twice
    const { data: claimed } = await supabase.from('mock_attempts').update({ emailed_at: new Date().toISOString() }).eq('id', id).is('emailed_at', null).select('id');
    if (claimed?.length) {
      if (a.profiles?.email && mailEnabled()) {
        if (a.paper_id) {   // rank among everyone's first attempt at this paper
          const { data: firsts } = await supabase.from('mock_attempts').select('user_id, score, submitted_at').eq('paper_id', a.paper_id).eq('status', 'submitted').order('submitted_at').limit(20000);
          const best = new Map(); (firsts || []).forEach((x) => { if (!best.has(x.user_id)) best.set(x.user_id, Number(x.score)); });
          const mineS = best.get(a.user_id) ?? Number(a.score);
          a.rank = { rank: [...best.values()].filter((v) => v > mineS).length + 1, total: best.size || 1 };
        }
        const { html, text } = resultEmail(a, fb, a.profiles.full_name?.split(' ')[0]);
        await sendMail({ to: a.profiles.email, subject: `Your ${a.title} result: ${num(a.score)}/${num(a.max_score)}`, html, text }).catch((e) => console.warn('[mock email]', e.message));
      }
      // in-app + WhatsApp (via the notifications outbox). Email is already sent above, so mark email-only users as sent.
      await supabase.from('notifications').insert({
        user_id: a.user_id, kind: 'mock_result', title: `${a.title}: ${num(a.score)}/${num(a.max_score)}`,
        body: `Percentile ${a.percentile}. ${fb.weaknesses[0] ? `Focus next on: ${fb.weaknesses[0]}` : 'See your detailed analysis.'}`,
        link: `/mock-tests/result/${a.id}`, ref_id: a.id,
      });
    }
  }
  return fb;
}

// every 2 minutes: auto-submit tests whose time ran out, then send feedback for anything not yet processed
export function startMockSweeper() {
  if (process.env.MOCK_SWEEPER === 'off') return;
  const tick = async () => {
    try {
      await supabase.rpc('expire_mock_attempts');
      const { data } = await supabase.from('mock_attempts').select('id').eq('status', 'submitted').is('emailed_at', null)
        .lt('submitted_at', new Date(Date.now() - 60_000).toISOString()).limit(20);
      for (const r of data || []) await finishAttempt(r.id).catch((e) => console.warn('[mock sweeper]', r.id, e.message));
    } catch (e) { console.warn('[mock sweeper]', e.message); }
  };
  setTimeout(tick, 30_000);
  setInterval(tick, 120_000).unref();
}
