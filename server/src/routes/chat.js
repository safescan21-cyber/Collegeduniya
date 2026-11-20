import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase.js';
import { chatSchema } from '../schemas.js';

// AI assistant that answers from StudyEarnstay's own database.
// 1) find colleges / PGs / jobs / exams matching the question
// 2) send them as context to Claude (if ANTHROPIC_API_KEY is set)
// 3) without a key, reply with the matching links only

const router = Router();
router.use(rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: true, legacyHeaders: false,
  message: { error: 'You are sending messages too fast — wait a minute.' } }));

const STOP = new Set(('a an the and or of in on at to for with near best top good cheap low under me my i is are what which ' +
  'how can do does college colleges university universities pg hostel hostels job jobs part time parttime fees fee course courses ' +
  'show find list tell about please want need get any some there study abroad india').split(' '));

const keywords = (text) => Array.from(new Set(
  text.toLowerCase().replace(/[^a-z0-9ऀ-ॿ\s.+-]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w)),
)).slice(0, 5);

const clean = (s) => s.replace(/[%,()*"]/g, ' ');

async function retrieve(question) {
  const words = keywords(question);
  const lower = question.toLowerCase();
  const wantHostel = /\b(pg|hostel|room|stay|flat|accommodation|rent)\b/.test(lower);
  const wantJob = /\b(job|jobs|part[- ]?time|intern|internship|earn|work)\b/.test(lower);
  const wantExam = /\b(exam|entrance|jee|neet|cat|cuet|gate|ielts|cutoff|cut-off)\b/.test(lower);
  const or = (cols) => words.flatMap((w) => cols.map((c) => `${c}.ilike.%${clean(w)}%`)).join(',');

  const ctx = { colleges: [], hostels: [], jobs: [], exams: [] };
  if (!words.length) {
    const { data } = await supabase.from('colleges').select('slug,name,city,country,fees_min,fees_max,currency,ranking,streams')
      .eq('is_published', true).order('ranking', { ascending: true, nullsFirst: false }).limit(5);
    ctx.colleges = data || [];
    return ctx;
  }

  const tasks = [
    supabase.from('colleges').select('id,slug,name,city,country,type,fees_min,fees_max,currency,ranking,streams,accepts_applications')
      .eq('is_published', true).or(or(['name', 'short_name', 'city', 'country', 'state'])).limit(6)
      .then(({ data }) => { ctx.colleges = data || []; }),
  ];
  if (wantHostel || !wantJob) tasks.push(
    supabase.from('hostels').select('id,name,type,gender,city,address,rent_min,rent_max,currency,amenities')
      .eq('is_published', true).or(or(['name', 'city', 'address'])).limit(wantHostel ? 6 : 3)
      .then(({ data }) => { ctx.hostels = data || []; }),
  );
  if (wantJob || !wantHostel) tasks.push(
    supabase.from('jobs').select('id,title,company,job_type,city,is_remote,pay_min,pay_max,currency,pay_unit')
      .eq('is_published', true).eq('status', 'open').or(or(['title', 'company', 'city'])).limit(wantJob ? 6 : 3)
      .then(({ data }) => { ctx.jobs = data || []; }),
  );
  if (wantExam) tasks.push(
    supabase.from('exams').select('slug,short_name,full_name,stream,level,conducting_body,exam_date,eligibility,website')
      .eq('is_published', true).or(or(['short_name', 'full_name', 'stream'])).limit(4)
      .then(({ data }) => { ctx.exams = data || []; }),
  );
  await Promise.all(tasks);

  // Add courses + fees for the first colleges found
  if (ctx.colleges.length) {
    const ids = ctx.colleges.slice(0, 4).map((c) => c.id);
    const { data } = await supabase.from('courses').select('college_id,name,level,duration,fees,currency').in('college_id', ids).limit(40);
    ctx.colleges = ctx.colleges.map((c) => ({ ...c, courses: (data || []).filter((x) => x.college_id === c.id).map(({ college_id, ...r }) => r) }));
  }
  return ctx;
}

function links(ctx) {
  return [
    ...ctx.colleges.map((c) => ({ label: `${c.name}, ${c.city}`, href: `/colleges/${c.slug}` })),
    ...ctx.hostels.map((h) => ({ label: `${h.name} (${h.type}, ${h.city})`, href: `/hostels/${h.id}` })),
    ...ctx.jobs.map((j) => ({ label: `${j.title} — ${j.company}`, href: `/jobs/${j.id}` })),
    ...ctx.exams.map((e) => ({ label: e.short_name, href: `/exams/${e.slug}` })),
  ].slice(0, 10);
}

const SYSTEM = `You are the StudyEarnstay.com assistant. StudyEarnstay helps students find colleges worldwide, PG/hostels near campus and part-time jobs.
Rules:
- Use the JSON "site data" for facts about specific colleges, fees, PGs, jobs and exams. Never invent fees, ranks, cutoffs, dates or contact details.
- If the site data has nothing relevant, say so briefly and suggest a search on the site, the college predictor (/predictor), or the free counselling form.
- Link to pages using relative links in Markdown, e.g. [IIT Delhi](/colleges/iit-delhi), [PG](/hostels/<id>), [job](/jobs/<id>), [exam](/exams/<slug>).
- General advice (how to choose a college, documents for admission, PG safety tips) is fine; mark dates and exam rules as "check the official website".
- Keep answers short: 3–8 sentences or a short list. Reply in the user's language (English or Hindi).`;

router.post('/', async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Invalid message' });
  const { messages } = parsed.data;
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  let ctx;
  try { ctx = await retrieve(question); } catch (e) {
    console.error('[chat] retrieve', e.message);
    ctx = { colleges: [], hostels: [], jobs: [], exams: [] };
  }
  const found = links(ctx);
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    const reply = found.length
      ? 'Here is what I found on StudyEarnstay:'
      : 'I could not find a match. Try searching colleges, PGs or jobs, or ask for free counselling.';
    return res.json({ reply, links: found, ai: false });
  }

  try {
    const convo = messages.slice(-8);
    // Messages API needs the conversation to start with a user turn
    while (convo.length && convo[0].role !== 'user') convo.shift();
    convo[convo.length - 1] = {
      role: 'user',
      content: `Site data (JSON):\n${JSON.stringify(ctx).slice(0, 12000)}\n\nQuestion: ${question}`,
    };
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
        max_tokens: 700,
        system: SYSTEM,
        messages: convo,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `AI error ${r.status}`);
    const reply = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    res.json({ reply: reply || 'Sorry, I could not answer that.', links: found, ai: true });
  } catch (e) {
    console.error('[chat]', e.message);
    res.json({ reply: 'The assistant is busy right now. Here are matching pages:', links: found, ai: false });
  }
});

export default router;
