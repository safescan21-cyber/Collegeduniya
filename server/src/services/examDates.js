// Exam dates, collected automatically from each exam's OFFICIAL website — admins only review.
//
// Once a day (when the server is idle) it takes the exams checked longest ago that have an official website, and for each:
//   1. opens the website, plus up to 6 pages / PDFs it links to that look like a schedule ("inviting applications", "information
//      bulletin", "public notice", "schedule", "calendar"), on the same site or a government file server (gov.in / nic.in)
//   2. asks the AI pool (services/llm.js) to list the dates that are written there, each with the exact sentence it came from
//   3. keeps a date ONLY if that sentence really is on the page and contains that day and month — so nothing invented gets in
//   4. saves it as live (origin 'auto', review 'pending'); admins approve or reject in Admin → Exam dates → Needs review
// Rejected dates are never re-added (unique key + on-conflict-ignore). Honest User-Agent; nothing is downloaded beyond 5 MB.
import { supabase } from '../supabase.js';
import { USER_AGENT, fetchJson } from './http.js';
import { completeJson, llmReady } from './llm.js';
import { whenIdle } from './loadGuard.js';

const env = (k, d) => (process.env[k] ?? d);
const EVENTS = ['registration_start', 'registration_end', 'correction_window', 'admit_card', 'exam', 'answer_key', 'result', 'counselling'];
const KEYWORDS = /important\s*date|schedule|calendar|information\s*bulletin|brochure|public\s*notice|notification|press\s*release|date\s*sheet|admit\s*card|time\s*table|timetable|inviting|online\s*application|application\s*form|advertisement|exam\s*city|correction|answer\s*key|result|notice/i;
// strongest hints that a notice holds the schedule (opened first)
const SCHEDULE = /inviting|information\s*bulletin|important\s*date|schedule|calendar|time\s*table|timetable|date\s*sheet|notification|advertisement|brochure/i;

// Indian exam bodies put their notices (PDFs) on government file servers, e.g. NTA → cdnbbsr.s3waas.gov.in — a different
// address from the exam site. Those count as official too.
export const officialHost = (u, site) => { try { const h = new URL(u).hostname.toLowerCase(); return sameSite(u, site) || /(^|\.)(gov\.in|nic\.in|s3waas\.gov\.in)$/.test(h); } catch { return false; } };
// date written into a government upload path: /uploads/2026/11/20261127653356155.pdf → 2026-11-27
export function dateFromUrl(u) {
  const m = String(u).match(/\/uploads\/(20\d\d)\/(\d\d)\/(20\d\d)(\d\d)(\d\d)\d*/i) || String(u).match(/[/_-](20\d\d)(\d\d)(\d\d)(?:\d{6,})?\.pdf$/i);
  if (!m) return null;
  const [y, mo, d] = m.length === 6 ? [m[3], m[4], m[5]] : [m[1], m[2], m[3]];
  const iso = `${y}-${mo}-${d}`; const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(t) && t <= Date.now() + 864e5 && t > Date.now() - 3 * 365 * 864e5 ? iso : null;
}
// links on the official site that look like notices / schedules: own site or government file servers, newest first, schedules first
export function noticeLinks(page, { max = 6 } = {}) {
  const seen = new Map();
  for (const l of page.links || []) {
    if (!KEYWORDS.test(`${l.label} ${l.href}`) || /question\s*paper|syllabus|mock\s*test|login|sign\s*in|contact\s*us/i.test(l.label)) continue;
    let u; try { u = new URL(l.href, page.url).toString(); } catch { continue; }
    if (!/^https?:/i.test(u) || !officialHost(u, page.url) || seen.has(u)) continue;
    seen.set(u, { url: u, label: l.label, date: dateFromUrl(u), schedule: SCHEDULE.test(l.label), pdf: /\.pdf($|\?)/i.test(u) });
  }
  return [...seen.values()].sort((a, b) => (Number(b.schedule) - Number(a.schedule)) || String(b.date || '').localeCompare(String(a.date || '')) || (Number(b.pdf) - Number(a.pdf))).slice(0, max);
}
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MAX_BYTES = 5 * 1024 * 1024;

// compare text ignoring punctuation and spacing (PDF/HTML tables collapse differently), but the words must match in order
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export async function grab(url) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.5' }, redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) return null;
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return null;
    const type = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    if (type.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      return { url: res.url || url, text: String(text || ''), links: [] };
    }
    const html = buf.toString('utf8');
    const links = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: m[1], label: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }));
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
    return { url: res.url || url, text, links };
  } catch { return null; } finally { clearTimeout(t); }
}

export const sameSite = (a, b) => { try { const x = new URL(a).hostname.replace(/^www\./, ''); const y = new URL(b).hostname.replace(/^www\./, ''); return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`); } catch { return false; } };

// does the quote really state this date? (day number + month name/number must both be in it)
function quoteHasDate(quote, iso) {
  const q = String(quote || '').toLowerCase(); const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return false;
  const day = new RegExp(`(^|[^0-9])0?${d}(st|nd|rd|th)?([^0-9]|$)`);
  const month = MONTHS[m - 1];
  const monthHit = q.includes(month) || q.includes(month.slice(0, 3)) || new RegExp(`(^|[^0-9])0?${d}[./-]0?${m}([./-]|$)`).test(q);
  return day.test(q) && monthHit;
}

export async function extract(exam, page) {
  const text = page.text.replace(/\s+\n/g, '\n').slice(0, 14000);
  if (text.length < 80 || !/20\d\d/.test(text)) return [];
  const today = new Date().toISOString().slice(0, 10);
  const out = await completeJson({
    system: 'You extract official exam dates from text. You never guess, never compute, never use outside knowledge. Reply with JSON only.',
    prompt: `Exam: ${exam.short_name}${exam.full_name ? ` (${exam.full_name})` : ''}. Today is ${today}.
From the text below (copied from ${page.url}), list every date for THIS exam that is written explicitly and is today or later.
Return {"dates":[{"event":one of ${JSON.stringify(EVENTS)},"title":"short label like 'Session 1' or null","date_start":"YYYY-MM-DD","date_end":"YYYY-MM-DD or null","tentative":true|false,"quote":"the exact sentence or table row from the text that states this date, copied character for character"}]}.
Rules: only dates written in the text with day, month and year (or the year clearly stated nearby); skip anything about other exams or past years; "tentative" true only if the text says tentative/expected/likely. If nothing qualifies return {"dates":[]}.

TEXT:
${text}`,
    maxTokens: 2500, temperature: 0, json: true,
  }).catch(() => null);
  const res = out?.data ?? out;
  const list = Array.isArray(res?.dates) ? res.dates : [];
  const page_ = norm(page.text);
  const min = Date.now() - 2 * 864e5; const max = Date.now() + 450 * 864e5;
  return list.filter((x) => {
    if (!EVENTS.includes(x?.event) || !/^\d{4}-\d{2}-\d{2}$/.test(x?.date_start || '')) return false;
    const t = new Date(`${x.date_start}T00:00:00Z`).getTime();
    if (!(t >= min && t <= max)) return false;
    if (x.date_end && (!/^\d{4}-\d{2}-\d{2}$/.test(x.date_end) || x.date_end < x.date_start)) x.date_end = null;
    const quote = norm(x.quote);
    if (quote.length < 8 || String(x.quote).length > 600 || !page_.includes(quote)) return false;   // the sentence must be on the official page
    return quoteHasDate(x.quote, x.date_start);                                                // …and must state that date
  });
}

// Exams without a website: take the "official website" (P856) from Wikidata — only for an item whose label exactly matches
// the exam's short or full name and whose description says it is an exam/test. Saved on the exam so admins can see/correct it.
async function findWebsite(exam) {
  const names = [exam.full_name, exam.short_name].filter(Boolean);
  for (const name of names) {
    const s = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=5&search=${encodeURIComponent(name)}`).catch(() => null);
    const hit = (s?.search || []).find((h) => names.some((n) => norm(h.label) === norm(n)) && /exam|test|entrance|admission|olympiad/i.test(h.description || ''));
    if (!hit) continue;
    const e = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`).catch(() => null);
    const site = e?.entities?.[hit.id]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    if (typeof site === 'string' && /^https?:\/\//.test(site)) return site;
  }
  return null;
}

export async function collectExamDates({ limit = Number(env('EXAM_DATES_PER_RUN', 12)) } = {}) {
  if (!llmReady()) return { skipped: 'no AI key' };
  const { data: exams } = await supabase.from('exams').select('id, slug, short_name, full_name, website')
    .eq('is_published', true).order('dates_checked_at', { ascending: true, nullsFirst: true }).limit(limit);
  let added = 0; let checked = 0;
  for (const exam of exams || []) {
    await supabase.from('exams').update({ dates_checked_at: new Date().toISOString() }).eq('id', exam.id);
    let home = /^https?:\/\//i.test(exam.website || '') ? exam.website : null;
    if (!home) {
      home = await findWebsite(exam);
      if (!home) continue;
      await supabase.from('exams').update({ website: home }).eq('id', exam.id);
      console.log(`[exam-dates] ${exam.short_name}: official website from Wikidata → ${home}`);
    }
    const first = await grab(home); if (!first) continue;
    checked++;
    const pages = [first];
    const extra = noticeLinks(first, { max: Number(env('EXAM_DATES_PAGES', 6)) }).map((l) => l.url);   // incl. notice PDFs on gov file servers
    for (const u of extra) { const p = await grab(u); if (p) pages.push(p); await new Promise((r) => setTimeout(r, 1500)); }
    for (const page of pages) {
      const found = await extract(exam, page);
      for (const d of found) {
        const { error, count } = await supabase.from('exam_dates').upsert({
          exam_slug: exam.slug, event: d.event, title: d.title ? String(d.title).slice(0, 60) : '', date_start: d.date_start, date_end: d.date_end || null,
          tentative: !!d.tentative, source_url: page.url, quote: String(d.quote).slice(0, 600), origin: 'auto', review_status: 'pending',
          is_published: true, found_at: new Date().toISOString(),
        }, { onConflict: 'exam_slug,event,date_start,title', ignoreDuplicates: true, count: 'exact' });
        if (!error && count) added += count;
      }
    }
  }
  if (added) console.log(`[exam-dates] ${added} new date(s) from ${checked} official site(s)`);
  return { checked, added };
}

export function startExamDates() {
  if (env('EXAM_DATES_AUTO', 'on') === 'off') return;
  const run = whenIdle('exam dates', () => collectExamDates().catch((e) => console.warn('[exam-dates]', e.message)));
  setTimeout(run, 12 * 60e3);
  setInterval(run, Math.max(2, Number(env('EXAM_DATES_EVERY_HOURS', 6))) * 3600e3).unref();
}
