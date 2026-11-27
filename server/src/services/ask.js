// "Ask Collegeolo" — answers questions ONLY from our own data (colleges, cutoffs, fees, rankings, exam dates,
// scholarships). It first collects facts from the database, each with the page it came from; the AI (if a key is set)
// only rewrites those facts into a short answer and must not add anything. With no AI key the facts are shown as a list.
// Nothing is invented: if no fact matches, the answer says so and points to search.
import { supabase } from '../supabase.js';
import { complete, llmReady } from './llm.js';

const SITE = (process.env.SITE_URL || 'https://www.collegeolo.com').replace(/\/$/, '');
const inr = (n) => (n == null ? null : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`);
const money = (n, cur) => (n == null ? null : cur && cur !== 'INR' ? `${cur} ${Math.round(Number(n)).toLocaleString('en-IN')}` : inr(n));
const CATS = [[/\bobc\b/i, 'OBC-NCL'], [/\bsc\b/i, 'SC'], [/\bst\b/i, 'ST'], [/\bews\b/i, 'EWS'], [/\b(general|open|gen)\b/i, 'General']];

let examCache = { at: 0, list: [] };
async function exams() {
  if (Date.now() - examCache.at < 30 * 60_000) return examCache.list;
  const { data } = await supabase.from('exams').select('id, slug, short_name, full_name, website').eq('is_published', true).limit(1000);
  examCache = { at: Date.now(), list: data || [] };
  return examCache.list;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseQuestion(q, examList) {
  const text = ` ${q} `;
  const exam = examList
    .map((e) => ({ e, len: e.short_name.length }))
    .filter(({ e }) => new RegExp(`(^|[^a-z0-9])${esc(e.short_name.toLowerCase()).replace(/\\ /g, '[\\s-]*')}([^a-z0-9]|$)`, 'i').test(text) || text.toLowerCase().includes(` ${e.slug} `))
    .sort((a, b) => b.len - a.len)[0]?.e || null;
  const rankM = q.match(/(?:rank|air|crl)\D{0,12}([\d,]{1,9})|([\d,]{1,9})\s*(?:rank|air)/i);
  const rank = rankM ? parseInt((rankM[1] || rankM[2]).replace(/,/g, ''), 10) : null;
  const category = (CATS.find(([re]) => re.test(q)) || [null, 'General'])[1];
  const female = /\b(girls?|female|wom[ae]n)\b/i.test(q);
  const topics = {
    fees: /\bfee|fees|cost|tuition|expensive|cheap|afford/i.test(q),
    cutoff: /cut ?off|closing rank|rank|chance|admission|get into|predict/i.test(q),
    placement: /placement|package|salary|lpa|ctc|job/i.test(q),
    ranking: /\bnirf|ranking|ranked|best|top\b/i.test(q),
    dates: /\bdate|deadline|when|last day|registration|admit card|result|exam day/i.test(q),
    scholarship: /scholarship|stipend|financial aid|free study|fellowship/i.test(q),
  };
  // college words = question minus exam name, numbers and common words
  const stop = /\b(what|which|is|are|the|a|an|of|for|in|at|to|my|me|i|can|get|with|and|or|how|much|does|do|it|college|colleges|university|fees?|cut ?offs?|closing|rank|ranks|placements?|package|average|highest|nirf|ranking|best|top|chance|chances|admission|general|obc|sc|st|ews|girl|female|boy|male|category|ncl|year|per|annum|course|btech|b\.tech|cse|seats?|when|where|who|will|should|about|tell|give|list|there|any|good|registration|dates?|deadline|last|day|results?|apply|admit|card|exam|scholarships?|girls?|boys?|engineering|medical|students?|nits|iits|iiits|this|that|be|was|from|than|under|lakhs?|lpa)\b/gi;
  let rest = q.replace(/[\d,]+/g, ' ');
  if (exam) rest = rest.replace(new RegExp(esc(exam.short_name), 'ig'), ' ');
  rest = rest.replace(stop, ' ').replace(/[^\p{L}\s.&-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return { exam, rank, category, female, topics, collegeQuery: rest.length >= 3 ? rest : null };
}

async function collegeFacts(q, topics, facts) {
  const { data: hits } = await supabase.rpc('search_colleges', { p_q: q, p_limit: 3 });
  const ids = (hits || []).map((h) => h.id).slice(0, 2);
  if (!ids.length) return [];
  const { data: rows } = await supabase.rpc('rank_card_facts', { p_ids: ids });
  const { data: names } = await supabase.from('colleges').select('id, name, slug').in('id', ids);
  const nameOf = new Map((names || []).map((n) => [n.id, n]));
  for (const r of rows || []) {
    const c = nameOf.get(r.id); if (!c) continue;
    const url = `${SITE}/colleges/${c.slug}`;
    const where = [r.city, r.state, r.country].filter(Boolean).join(', ');
    facts.push({ text: `${c.name} is in ${where}${r.courses ? ` and lists ${r.courses} courses on Collegeolo` : ''}.`, url, title: c.name });
    if (r.fee_min != null) facts.push({ text: `Lowest listed yearly fee at ${c.name}: ${money(r.fee_min, r.fee_currency)}${r.fee_currency && r.fee_currency !== 'INR' && r.fee_min_inr ? ` (about ${inr(r.fee_min_inr)})` : ''}. Fees differ by course — see the college page.`, url: `${url}#courses`, title: `${c.name} fees` });
    if (r.placement != null && (topics.placement || !topics.fees)) facts.push({ text: `${c.name} ${r.placement_kind === 'median' ? 'median' : 'average'} placement package${r.placement_year ? ` (${r.placement_year})` : ''}: ${money(r.placement, r.placement_currency)} a year.`, url: `${url}#placements`, title: `${c.name} placements` });
    const { data: rk } = await supabase.from('college_rankings').select('source, category, year, rank, rank_band').eq('college_id', r.id).order('year', { ascending: false }).limit(3);
    for (const x of rk || []) facts.push({ text: `${c.name}: ${x.source} ${x.category} ${x.year} rank ${x.rank ?? x.rank_band}.`, url: `${SITE}/rankings`, title: `${x.source} ${x.year}` });
    if (topics.cutoff) {
      const { data: cut } = await supabase.from('cutoffs').select('exam_slug, year, round, course, category, quota, gender, closing_rank')
        .eq('college_id', r.id).eq('category', 'General').order('year', { ascending: false }).order('closing_rank', { ascending: true }).limit(4);
      for (const x of cut || []) facts.push({ text: `${c.name} ${x.course}: ${x.year} ${x.round || ''} closing rank ${x.closing_rank.toLocaleString('en-IN')} (${x.exam_slug}, ${x.category}, ${x.quota || 'All India'}${/female/i.test(x.gender || '') ? ', female-only seat' : ''}).`, url: `${url}#cutoffs`, title: `${c.name} cutoffs` });
    }
  }
  return ids;
}

export async function answerQuestion(question) {
  const q = String(question || '').trim().slice(0, 300);
  if (q.length < 4) throw Object.assign(new Error('Type a question, e.g. “Which NITs can I get with JEE Main rank 15000?”'), { status: 422 });
  const p = parseQuestion(q, await exams());
  const facts = [];

  // 1. rank → colleges (official closing ranks)
  if (p.exam && p.rank) {
    const { data } = await supabase.rpc('predict_colleges_v2', { p_exam: p.exam.slug, p_rank: p.rank, p_category: p.category, p_gender: p.female ? 'Female' : null });
    const good = (data || []).filter((r) => r.chance !== 'Low').slice(0, 8);
    const url = `${SITE}/predictor/${p.exam.slug}?rank=${p.rank}${p.female ? '&gender=Female' : ''}`;
    if (good.length) {
      facts.push({ text: `With ${p.exam.short_name} rank ${p.rank.toLocaleString('en-IN')} (${p.category}${p.female ? ', female' : ''}), options based on the last official closing ranks include: ` +
        good.map((r) => `${r.name} – ${r.course} (closed at ${r.closing_rank.toLocaleString('en-IN')} in ${r.year}${r.round && r.round !== 'Final' ? ` ${r.round}` : ''}; ${r.chance} chance)`).join('; ') + '.', url, title: `${p.exam.short_name} college predictor` });
    } else if (data) {
      facts.push({ text: `No college in our ${p.exam.short_name} cutoff data closed at or near rank ${p.rank.toLocaleString('en-IN')} for ${p.category}${(data || []).length ? '' : ' (we may not have this exam’s cutoffs yet)'}.`, url, title: `${p.exam.short_name} college predictor` });
    }
  }
  // 2. a named college
  if (p.collegeQuery) await collegeFacts(p.collegeQuery, p.topics, facts);
  // 3. exam dates
  if (p.exam && (p.topics.dates || !facts.length)) {
    const { data } = await supabase.rpc('exam_calendar', { p_exam: p.exam.slug, p_days: 400 });
    const rows = (data || []).slice(0, 5);
    for (const r of rows) facts.push({ text: `${p.exam.short_name} ${String(r.event).replace(/_/g, ' ')}${r.title ? ` (${r.title})` : ''}: ${r.date_start}${r.date_end ? ` to ${r.date_end}` : ''}${r.tentative ? ' (tentative)' : ''}.`, url: r.source_url || `${SITE}/exams/${p.exam.slug}`, title: `${p.exam.short_name} official notice` });
    if (!rows.length) facts.push({ text: `${p.exam.full_name || p.exam.short_name}: we don't have confirmed dates for the next session yet. Check the official website.`, url: p.exam.website || `${SITE}/exams/${p.exam.slug}`, title: `${p.exam.short_name} official website` });
  }
  // 4. scholarships
  if (p.topics.scholarship) {
    const { data } = await supabase.from('scholarships').select('slug, name, amount, currency, amount_note, deadline').eq('is_published', true).limit(40);
    const list = (data || []).slice(0, 6);
    for (const s of list) facts.push({ text: `${s.name}: ${s.amount_note || (s.amount ? money(s.amount, s.currency) : 'see the official site')}${s.deadline ? `; deadline ${s.deadline}` : ''}.`, url: `${SITE}/scholarships/${s.slug}`, title: s.name });
  }

  const sources = [...new Map(facts.map((f) => [f.url, { title: f.title, url: f.url }])).values()].slice(0, 8);
  if (!facts.length) {
    return { answer: 'I couldn’t find this in Collegeolo’s data yet. Try naming the college or exam (for example “IIT Bombay fees” or “JEE Main rank 15000 OBC”), or search the colleges list.', sources: [{ title: 'Search colleges', url: `${SITE}/colleges` }], facts: [], ai: false };
  }
  let answer = null, ai = false;
  if (llmReady()) {
    const numbered = facts.slice(0, 14).map((f, i) => `[${i + 1}] ${f.text}`).join('\n');
    try {
      const out = await complete({
        system: 'You answer students’ questions for Collegeolo, an Indian college guide. Use ONLY the numbered facts given. Never add numbers, names, dates or claims that are not in the facts. If the facts do not fully answer, say what is missing. Write simple English (Class 10 level), 2–6 short sentences or a short list. Do not mention "facts" or numbering.',
        prompt: `Question: ${q}\n\nFacts:\n${numbered}`, maxTokens: 500, temperature: 0.2,
      });
      answer = String(out?.text || '').trim() || null; ai = !!answer;
    } catch { answer = null; }
  }
  if (!answer) answer = facts.slice(0, 8).map((f) => `• ${f.text}`).join('\n');
  return { answer, sources, facts: facts.slice(0, 14).map((f) => f.text), ai };
}
