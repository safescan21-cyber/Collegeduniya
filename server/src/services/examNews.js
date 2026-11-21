import { supabase } from '../supabase.js';
import { sendMail, mailEnabled } from './mailer.js';
import { USER_AGENT, throttle } from './http.js';
import { llmReady, completeJson } from './llm.js';

// Exam news alerts (migration 021)
//  1. collect: every EXAM_NEWS_EVERY_HOURS (3) the server searches worldwide news for each exam.
//     Source: GDELT DOC 2.0 API — free, no key, 65+ languages, "free for any purpose" with attribution.
//     Optional second source: NewsData.io (set NEWSDATA_API_KEY; its free tier is 200 credits/day).
//     Google News is NOT used: its terms allow personal, non-commercial use only.
//  2. keep only real exam news: the exam's name must be in the headline together with an exam word
//     (result, admit card, registration, answer key, cutoff …). If an AI key is set, AI double-checks the list.
//  3. email: one digest per student per day at most, for the exams they follow, with one-click unsubscribe.
// Only headline + publisher + link are stored and sent; every item opens the original article.

const SITE = (process.env.SITE_URL || 'https://www.collegeolo.com').replace(/\/$/, '');
const env = (k, d) => process.env[k] ?? d;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const INTENT = [
  'exam', 'exams', 'examination', 'result', 'results', 'admit card', 'hall ticket', 'registration', 'register', 'apply', 'application',
  'answer key', 'cutoff', 'cut-off', 'cut off', 'syllabus', 'date', 'dates', 'date sheet', 'datesheet', 'schedule', 'timetable', 'notification',
  'counselling', 'counseling', 'seat allotment', 'allotment', 'scorecard', 'score card', 'score', 'scores', 'topper', 'toppers', 'rank', 'ranks',
  'merit list', 'question paper', 'paper', 'analysis', 'pattern', 'eligibility', 'postponed', 'rescheduled', 'cancelled', 'canceled', 'leak',
  'marks', 'percentile', 'candidates', 'aspirants', 'students', 'slot', 'form', 'correction window', 'city slip', 'exam centre', 'exam center',
  'test', 'deadline', 'last date', 'fee', 'fees', 'mock', 'preparation', 'session', 'attempt', 'qualifying', 'qualified', 'board',
  'परीक्षा', 'रिजल्ट', 'परिणाम', 'एडमिट कार्ड', 'आवेदन', 'पंजीकरण', 'कटऑफ', 'आंसर की', 'सिलेबस', 'काउंसलिंग',
];
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w, caseSensitive) => new RegExp(`(^|[^\\p{L}\\p{N}])${reEsc(w)}(?=$|[^\\p{L}\\p{N}])`, caseSensitive ? 'u' : 'iu');
const INTENT_RE = INTENT.map((w) => wordRe(w, false));

export function examTerms(e) {
  const t = [e.short_name, e.full_name && e.full_name.length <= 90 ? e.full_name : null, ...(e.news_terms || [])]
    .map((x) => String(x || '').trim()).filter((x) => x.length >= 2);
  return [...new Map(t.map((x) => [x.toLowerCase(), x])).values()].slice(0, 6);
}
// acronyms (CAT, GATE, SAT, NEET) must match in capitals, so "cat video" or "gate crash" don't count
const termRe = (t) => wordRe(t, /^[A-Z0-9-]{2,8}$/.test(t));

export function titleKey(t) {
  return String(t).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

// score a headline for one exam; null = not about this exam
export function scoreItem(e, item) {
  const title = String(item.title || '').trim();
  if (title.length < 15 || title.length > 400) return null;
  const terms = examTerms(e);
  if (!terms.some((t) => termRe(t).test(title))) return null;
  const intents = INTENT_RE.filter((re) => re.test(title)).length;
  const officialHost = host(e.website || '');
  const official = !!officialHost && (item.source === officialHost || item.source?.endsWith(`.${officialHost}`) || officialHost.endsWith(`.${item.source}`));
  if (!intents && !official) return null;
  const ageH = (Date.now() - Date.parse(item.published_at)) / 3600e3;
  return { score: 3 + Math.min(intents, 3) + (official ? 5 : 0) + (ageH < 24 ? 1 : 0), official };
}

const LANGS = () => env('EXAM_NEWS_LANGS', 'english,hindi').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

// GDELT DOC 2.0 — https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
export function gdeltQuery(e) {
  const q = [...new Set(examTerms(e).map((t) => t.replace(/[^\p{L}\p{N}&.' -]+/gu, ' ').replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 3))].map((t) => `"${t}"`);
  return q.length > 1 ? `(${q.join(' OR ')})` : q[0];
}
const gdeltDate = (s) => { const m = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/.exec(s || ''); return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : new Date().toISOString(); };

async function getText(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: ctl.signal });
    const body = await r.text();
    if (r.status === 429) { const err = new Error('rate limited'); err.rateLimited = true; throw err; }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.slice(0, 120)}`);
    return body;
  } finally { clearTimeout(t); }
}

export async function fromGdelt(e, { hours = 72 } = {}) {
  const q = gdeltQuery(e);
  if (!q) return [];
  await throttle('api.gdeltproject.org', Number(env('GDELT_GAP_MS', 6000)));
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({ query: q, mode: 'artlist', format: 'json', maxrecords: '75', sort: 'datedesc', timespan: `${Math.min(Math.max(hours, 1), 168)}h` })}`;
  const body = await getText(url);
  let j; try { j = JSON.parse(body); } catch { throw new Error(`GDELT: ${body.slice(0, 120)}`); }   // GDELT answers query errors as plain text
  const langs = LANGS();
  return (j.articles || []).filter((a) => !langs.length || langs.includes(String(a.language || '').toLowerCase()))
    .map((a) => ({ title: a.title, url: a.url, source: (a.domain || host(a.url)).replace(/^www\./, ''), source_country: a.sourcecountry || null,
      language: a.language || null, published_at: gdeltDate(a.seendate), provider: 'gdelt' }));
}

// NewsData.io (optional) — https://newsdata.io/documentation
export async function fromNewsData(e) {
  const key = env('NEWSDATA_API_KEY', '');
  if (!key) return [];
  const q = examTerms(e).slice(0, 3).map((t) => `"${t}"`).join(' OR ').slice(0, 100);
  await throttle('newsdata.io', 1500);
  const code = { english: 'en', hindi: 'hi' };
  const lang = LANGS().map((l) => code[l] || l.slice(0, 2)).slice(0, 5).join(',');
  const j = JSON.parse(await getText(`https://newsdata.io/api/1/latest?${new URLSearchParams({ apikey: key, q, ...(lang ? { language: lang } : {}) })}`));
  return (j.results || []).map((a) => ({ title: a.title, url: a.link, source: host(a.source_url || a.link) || a.source_id, source_country: (a.country || [])[0] || null,
    language: a.language || null, published_at: a.pubDate ? new Date(`${a.pubDate.replace(' ', 'T')}Z`).toISOString() : new Date().toISOString(), provider: 'newsdata' }));
}

// AI second opinion (only when an AI key is configured): drops items that mention the exam in passing
async function aiFilter(e, items) {
  if (!items.length || env('EXAM_NEWS_AI', 'on') === 'off' || !llmReady()) return items;
  try {
    const r = await completeJson({
      system: 'You filter news headlines for students preparing for an entrance or admission exam. Reply with JSON only.',
      prompt: `Exam: ${e.short_name}${e.full_name ? ` (${e.full_name})` : ''}${e.country ? `, ${e.country}` : ''}.\nKeep a headline only if a student taking THIS exam would want it (dates, registration, admit card, results, answer key, cutoffs, counselling, pattern or rule changes, postponement, paper leak, toppers). Drop opinion pieces, unrelated exams with similar names, ads and coaching promotions.\n${items.map((x, i) => `${i}. ${x.title}`).join('\n')}\nReturn {"keep":[indexes]}`,
      maxTokens: 300, temperature: 0,
    });
    if (!Array.isArray(r?.keep)) return items;
    const keep = new Set(r.keep.map(Number));
    return items.filter((_, i) => keep.has(i));
  } catch { return items; }
}

export async function collectForExam(e) {
  const hours = e.news_fetched_at ? Math.ceil((Date.now() - Date.parse(e.news_fetched_at)) / 3600e3) + 6 : 72;
  const [a, b] = await Promise.all([fromGdelt(e, { hours }), fromNewsData(e).catch((x) => { console.warn('[exam-news] newsdata', x.message); return []; })]);
  const seen = new Set(); let items = [];
  for (const it of [...a, ...b]) {
    if (!it.title || !/^https?:\/\//.test(it.url || '')) continue;
    const k = titleKey(it.title);
    if (seen.has(k) || seen.has(it.url)) continue;
    const s = scoreItem(e, it);
    if (!s) continue;
    seen.add(k); seen.add(it.url);
    items.push({ ...it, ...s, title: it.title.trim().slice(0, 400), title_key: k });
  }
  if (!items.length) return 0;
  const [{ data: haveUrl }, { data: haveKey }] = await Promise.all([
    supabase.from('exam_news').select('url').eq('exam_id', e.id).in('url', items.map((x) => x.url)),
    supabase.from('exam_news').select('title_key').eq('exam_id', e.id).in('title_key', items.map((x) => x.title_key)),
  ]);
  const old = new Set([...(haveUrl || []).map((x) => x.url), ...(haveKey || []).map((x) => x.title_key)]);
  items = items.filter((x) => !old.has(x.url) && !old.has(x.title_key));
  items = await aiFilter(e, items.slice(0, 40));
  let added = 0;
  for (const x of items) {   // one by one: a duplicate headline from another site must not fail the rest
    const { error } = await supabase.from('exam_news').insert({ exam_id: e.id, title: x.title, url: x.url, source: x.source, source_country: x.source_country,
      language: x.language, published_at: x.published_at, provider: x.provider, score: x.score, official: x.official, title_key: x.title_key });
    if (!error) added++; else if (error.code !== '23505') console.warn('[exam-news] insert', error.message);
  }
  return added;
}

let collecting = false; let lastCollect = null; let lastDigest = null;

export async function collectExamNews({ limit = Number(env('EXAM_NEWS_PER_RUN', 40)), examId = null } = {}) {
  if (collecting) return { skipped: 'already running' };
  collecting = true;
  const stats = { exams: 0, added: 0, errors: 0, at: new Date().toISOString() };
  try {
    let exams;
    if (examId) ({ data: exams } = await supabase.from('exams').select('id, slug, short_name, full_name, country, website, news_terms, news_fetched_at').eq('id', examId));
    else {
      const [{ data: all }, { data: fol }] = await Promise.all([
        supabase.from('exams').select('id, slug, short_name, full_name, country, website, news_terms, news_fetched_at').eq('is_published', true).eq('news_enabled', true).limit(2000),
        supabase.from('exam_follows').select('exam_id').limit(50000),
      ]);
      const n = new Map(); for (const f of fol || []) n.set(f.exam_id, (n.get(f.exam_id) || 0) + 1);
      // followed exams first, then the ones checked longest ago
      exams = (all || []).sort((x, y) => (n.get(y.id) ? 1 : 0) - (n.get(x.id) ? 1 : 0)
        || (Date.parse(x.news_fetched_at || 0) - Date.parse(y.news_fetched_at || 0))).slice(0, limit);
    }
    for (const e of exams || []) {
      stats.exams++;
      try { stats.added += await collectForExam(e); }
      catch (x) { stats.errors++; console.warn('[exam-news]', e.short_name, x.message); if (x.rateLimited) break; }
      await supabase.from('exams').update({ news_fetched_at: new Date().toISOString() }).eq('id', e.id);
    }
  } finally { collecting = false; lastCollect = stats; }
  if (stats.added) console.log('[exam-news] collected', stats);
  return stats;
}

const withExam = (exam, title) => (termRe(exam.short_name).test(title) ? title : `${exam.short_name}: ${title}`);

function digestEmail(name, groups) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const subject = groups.length === 1 ? withExam(groups[0].exam, groups[0].items[0].title).slice(0, 140)
    : `${total} news updates for ${groups.map((g) => g.exam.short_name).join(', ')}`.slice(0, 140);
  const when = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const text = [`Hi ${name || 'there'},`, '', ...groups.flatMap((g) => [`${g.exam.short_name}`,
    ...g.items.map((x) => `• ${x.title}${x.official ? ' [Official]' : ''} — ${x.source}, ${when(x.published_at)}\n  ${x.url}`),
    `  More: ${SITE}/exams/${g.exam.slug}#news   ·   Stop ${g.exam.short_name} emails: ${SITE}/unsubscribe/exam-news?t=${g.token}`, '']),
  'Always confirm dates and rules on the official exam website.', `Manage your exams: ${SITE}/dashboard?tab=exams`].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;color:#0f172a">
  <p>Hi ${esc(name || 'there')},</p><p>New headlines about the exams you follow:</p>
  ${groups.map((g) => `<h3 style="margin:22px 0 6px;color:#1d4ed8">${esc(g.exam.short_name)}</h3>
    ${g.items.map((x) => `<p style="margin:0 0 12px"><a href="${esc(x.url)}" style="color:#0f172a;font-weight:bold;text-decoration:none">${esc(x.title)}</a>${x.official ? ' <span style="background:#dcfce7;color:#166534;font-size:11px;padding:1px 6px;border-radius:8px">Official</span>' : ''}<br><span style="color:#64748b;font-size:13px">${esc(x.source)} · ${when(x.published_at)}</span></p>`).join('')}
    <p style="font-size:13px"><a href="${SITE}/exams/${g.exam.slug}#news">All ${esc(g.exam.short_name)} news</a> · <a href="${SITE}/unsubscribe/exam-news?t=${g.token}" style="color:#64748b">Stop ${esc(g.exam.short_name)} emails</a></p>`).join('')}
  <p style="background:#fffbeb;color:#92400e;padding:10px;border-radius:8px;font-size:13px">Dates and rules change — always confirm on the official exam website.</p>
  <p style="color:#94a3b8;font-size:12px">You get this because you follow these exams on Collegeolo. Headlines are found with the GDELT Project and link to the original publishers. <a href="${SITE}/dashboard?tab=exams">Manage your exams</a>.</p></div>`;
  return { subject, text, html };
}

export async function sendExamNewsDigests({ dryRun = false } = {}) {
  const gap = Number(env('EXAM_NEWS_MIN_GAP_HOURS', 20)) * 3600e3;
  const { data: follows, error } = await supabase.from('exam_follows')
    .select('user_id, exam_id, last_sent_at, unsub_token, created_at, profiles(email, full_name, is_blocked), exams(short_name, slug)')
    .eq('email', true).or(`last_sent_at.is.null,last_sent_at.lt.${new Date(Date.now() - gap).toISOString()}`).limit(20000);
  if (error) throw error;
  const live = (follows || []).filter((f) => f.profiles?.email && !f.profiles.is_blocked && f.exams);
  const stats = { users: 0, sent: 0, failed: 0, app_only: 0, at: new Date().toISOString() };
  if (!live.length) { lastDigest = stats; return stats; }
  const since = new Date(Math.min(...live.map((f) => Date.parse(f.last_sent_at || f.created_at)))).toISOString();
  const examIds = [...new Set(live.map((f) => f.exam_id))];
  const news = [];
  for (let i = 0; i < examIds.length; i += 100) {
    const { data } = await supabase.from('exam_news').select('exam_id, title, url, source, published_at, official, score, fetched_at')
      .in('exam_id', examIds.slice(i, i + 100)).eq('is_hidden', false).gt('fetched_at', since).order('score', { ascending: false }).limit(3000);
    news.push(...(data || []));
  }
  const byUser = new Map();
  for (const f of live) { if (!byUser.has(f.user_id)) byUser.set(f.user_id, []); byUser.get(f.user_id).push(f); }
  const perExam = Number(env('EXAM_NEWS_PER_EXAM', 5));
  for (const [uid, fs] of byUser) {
    const groups = fs.map((f) => ({ exam: f.exams, token: f.unsub_token, examId: f.exam_id,
      items: news.filter((n) => n.exam_id === f.exam_id && Date.parse(n.fetched_at) > Date.parse(f.last_sent_at || f.created_at))
        .sort((a, b) => b.score - a.score || Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, perExam) }))
      .filter((g) => g.items.length);
    if (!groups.length) continue;   // nothing new: try again next hour
    stats.users++;
    if (dryRun) continue;
    const p = fs[0].profiles; const mail = digestEmail(p.full_name?.split(' ')[0], groups);
    let ok = false;
    try {
      ok = await sendMail({ to: p.email, ...mail, headers: { 'List-Unsubscribe': `<${SITE}/unsubscribe/exam-news/confirm?t=${groups[0].token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
    } catch (x) { console.warn('[exam-news] mail', x.message); }
    if (ok) stats.sent++; else if (mailEnabled()) stats.failed++; else stats.app_only++;
    const now = new Date().toISOString();
    await supabase.from('exam_follows').update({ last_sent_at: now }).eq('user_id', uid).in('exam_id', groups.map((g) => g.examId));
    await supabase.from('notifications').insert(groups.map((g) => ({ user_id: uid, kind: 'exam_news', title: withExam(g.exam, g.items[0].title).slice(0, 200),
      body: g.items.length > 1 ? `+${g.items.length - 1} more update${g.items.length > 2 ? 's' : ''}` : g.items[0].source, link: `/exams/${g.exam.slug}#news`, ref_id: g.examId,
      status: ok ? 'sent' : 'skipped', channel: ok ? 'email' : null, sent_at: ok ? now : null, error: ok ? null : (mailEnabled() ? 'email failed' : 'SMTP_URL not set') })));
  }
  lastDigest = stats;
  if (stats.users) console.log('[exam-news] digests', stats);
  return stats;
}

export const examNewsStatus = () => ({ enabled: env('EXAM_NEWS', 'on') !== 'off', every_hours: Number(env('EXAM_NEWS_EVERY_HOURS', 3)),
  digest_hour_ist: Number(env('EXAM_NEWS_DIGEST_HOUR', 7)), email_ready: mailEnabled(), ai_check: llmReady() && env('EXAM_NEWS_AI', 'on') !== 'off',
  newsdata: Boolean(env('NEWSDATA_API_KEY', '')), collecting, last_collect: lastCollect, last_digest: lastDigest });

export function startExamNews() {
  if (env('EXAM_NEWS', 'on') === 'off') return;
  const every = Math.max(1, Number(env('EXAM_NEWS_EVERY_HOURS', 3))) * 3600e3;
  const collect = () => collectExamNews().catch((e) => console.warn('[exam-news]', e.message));
  setTimeout(collect, 3 * 60e3); setInterval(collect, every).unref();
  // digests go out from EXAM_NEWS_DIGEST_HOUR (India time) onward, at most once per EXAM_NEWS_MIN_GAP_HOURS per student
  const digest = () => {
    const h = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
    if (h < Number(env('EXAM_NEWS_DIGEST_HOUR', 7)) || h >= 22) return;
    sendExamNewsDigests().catch((e) => console.warn('[exam-news] digest', e.message));
  };
  setTimeout(digest, 8 * 60e3); setInterval(digest, 60 * 60e3).unref();
}
