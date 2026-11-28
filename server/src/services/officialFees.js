// Course fees from each college's OFFICIAL website — automatic, admins only review.
//
// Every hour (when the server is idle) it takes the next colleges with a website — NIRF-ranked first (best rank first), then
// world-ranked universities, then the rest (India and the UK), oldest-checked first — and for each:
//   1. reads robots.txt and skips anything it disallows; honest User-Agent; a pause between pages
//   2. opens the home page and up to 5 same-site pages / PDFs whose link looks like fees ("fee structure", "tuition",
//      "fees", "prospectus", "admission")
//   3. asks the AI pool to list courses with their fee, each with the exact sentence / table row it came from
//   4. keeps a fee ONLY if that sentence is on the page and contains that amount → saved as a course (source 'official_site')
//      and in fee_findings for Admin → Official fees. Rejected findings are deleted and never added again.
// Only the college's own website is read — never other portals.
import { supabase } from '../supabase.js';
import { USER_AGENT } from './http.js';
import { completeJson, llmReady } from './llm.js';
import { whenIdle, serverBusy } from './loadGuard.js';
import { grab, sameSite } from './examDates.js';
import { normName } from './collegeUpsert.js';

const env = (k, d) => (process.env[k] ?? d);
const LINK = /fee|tuition|prospectus|brochure|admission|programmes?|courses?|cost|scholarship|शुल्क/i;
const LEVELS = ['UG', 'PG', 'Diploma', 'PhD', 'Certificate'];
const PERIODS = ['year', 'semester', 'total', 'month'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---- robots.txt (cached per host for a day)
const robotsCache = new Map();
export async function allowedByRobots(url) {
  let u; try { u = new URL(url); } catch { return false; }
  const key = u.origin; let rules = robotsCache.get(key);
  if (!rules || Date.now() - rules.at > 864e5) {
    rules = { at: Date.now(), disallow: [], allow: [] };
    try {
      const res = await fetch(`${key}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        let applies = false;
        for (const raw of (await res.text()).split(/\r?\n/)) {
          const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
          const [k, ...rest] = line.split(':'); const v = rest.join(':').trim(); const kk = k.toLowerCase();
          if (kk === 'user-agent') applies = v === '*' || /collegeolo/i.test(v);
          else if (applies && kk === 'disallow' && v) rules.disallow.push(v);
          else if (applies && kk === 'allow' && v) rules.allow.push(v);
        }
      }
    } catch { /* no robots.txt → allowed */ }
    robotsCache.set(key, rules);
  }
  const p = u.pathname + u.search;
  const hit = (list) => list.filter((r) => p.startsWith(r.replace(/\*.*$/, ''))).reduce((m, r) => Math.max(m, r.length), -1);
  return hit(rules.disallow) <= hit(rules.allow) || hit(rules.disallow) === -1;
}

// "1,25,000" / "₹ 1,25,000" / "£9,535" → does the quote state this amount?
export function quoteHasAmount(quote, fee) {
  const digits = String(quote || '').replace(/(\d)[,\s.](?=\d{2,3}\b)/g, '$1');   // drop thousands separators (incl. Indian 1,25,000)
  const n = Math.round(Number(fee));
  return n > 0 && new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(digits);
}
const years = (d) => { const m = String(d || '').match(/(\d+(?:\.\d+)?)\s*(year|yr)/i); return m ? Number(m[1]) : null; };
function perYear(f) {
  if (f.period === 'year') return f.fee;
  if (f.period === 'semester') return f.fee * 2;
  if (f.period === 'month') return f.fee * 12;
  const y = years(f.duration); return y ? Math.round(f.fee / y) : null;   // total fee: only when the length is stated
}

export async function extract(college, page) {
  const text = page.text.replace(/\s+\n/g, '\n').slice(0, 15000);
  if (text.length < 100 || !/\d{3}/.test(text)) return [];
  const out = await completeJson({
    system: 'You extract course fees from a college\'s own web page. You never guess, never compute, never use outside knowledge. Reply with JSON only.',
    prompt: `College: ${college.name}${college.city ? `, ${college.city}` : ''}${college.country ? `, ${college.country}` : ''}.
From the text below (copied from ${page.url}), list each course of THIS college whose fee is written in the text.
Return {"items":[{"course":"exact course name, e.g. 'B.Tech Computer Science' or 'MSc Data Science'","level":one of ${JSON.stringify(LEVELS)},
"fee":number (the amount exactly as written, no conversion),"currency":"ISO code, e.g. INR, GBP, USD, EUR","period":one of ${JSON.stringify(PERIODS)},
"duration":"e.g. '4 years' if written, else null","quote":"the exact sentence or table row from the text that states this fee, copied character for character"}]}.
Rules: skip hostel, mess, exam, application or one-time fees; skip fees for other institutions; if a row gives several fees (e.g. different categories), use the general/home student tuition and say which in "course" only if the text names it. If nothing qualifies return {"items":[]}.

TEXT:
${text}`,
    maxTokens: 3000, temperature: 0, json: true,
  }).catch(() => null);
  const res = out?.data ?? out;
  const list = Array.isArray(res?.items) ? res.items : [];
  const page_ = norm(page.text);
  return list.filter((x) => {
    const fee = Number(x?.fee);
    if (!x?.course || !(fee > 0) || !LEVELS.includes(x.level) || !PERIODS.includes(x.period) || !/^[A-Z]{3}$/.test(String(x.currency || ''))) return false;
    const q = norm(x.quote);
    if (q.length < 6 || String(x.quote).length > 700 || !page_.includes(q)) return false;   // sentence must be on the official page
    return quoteHasAmount(x.quote, fee);                                                    // …and must contain that amount
  }).map((x) => ({ ...x, fee: Number(x.fee), course: String(x.course).replace(/\s+/g, ' ').trim().slice(0, 200) }));
}

async function saveFindings(college, page, found) {
  let added = 0;
  for (const f of found) {
    const course_key = normName(f.course).slice(0, 180);
    const { data: prev } = await supabase.from('fee_findings').select('id, review_status, course_id').eq('college_id', college.id).eq('course_key', course_key).eq('level', f.level).maybeSingle();
    if (prev?.review_status === 'rejected') continue;                       // an admin said no — never again
    const fpy = perYear(f);
    const course = { college_id: college.id, source: 'official_site', external_id: `${course_key}|${f.level}`, name: f.course, level: f.level,
      fees: fpy, currency: f.currency, duration: f.duration || null, url: page.url };
    const { data: c, error: ce } = await supabase.from('courses').upsert(course, { onConflict: 'college_id,source,external_id' }).select('id').single();
    if (ce) { console.warn('[official-fees] course', ce.message); continue; }
    const row = { college_id: college.id, course: f.course, course_key, level: f.level, fee: f.fee, currency: f.currency, period: f.period,
      fee_per_year: fpy, duration: f.duration || null, quote: String(f.quote).slice(0, 700), source_url: page.url, course_id: c.id, found_at: new Date().toISOString(),
      ...(prev ? {} : { review_status: 'pending' }) };
    const { error } = await supabase.from('fee_findings').upsert(row, { onConflict: 'college_id,course_key,level' });
    if (!error && !prev) added++;
  }
  // one official B.Tech fee applies to every B.Tech branch of that institute (JoSAA lists the branches, without fees)
  const btech = found.find((f) => f.level === 'UG' && /b\.?\s?tech|bachelor of technology|b\.?\s?e\.?\b/i.test(f.course) && !/dual|m\.?\s?tech|mba/i.test(f.course) && perYear(f));
  if (btech) await supabase.from('courses').update({ fees: perYear(btech), currency: btech.currency })
    .eq('college_id', college.id).eq('source', 'josaa').eq('catalog_slug', 'btech');
  if (found.length) await supabase.rpc('refresh_official_fee_range', { p_college: college.id });
  return added;
}

export async function collectOfficialFees({ limit = Number(env('FEES_PER_RUN', 12)), collegeId = null, force = false } = {}) {
  if (!llmReady()) return { skipped: 'no AI key' };
  let q = supabase.from('colleges').select('id, name, city, country, website').eq('is_published', true).not('website', 'is', null);
  if (collegeId) q = q.eq('id', collegeId);
  else {
    const countries = String(env('FEES_COUNTRIES', 'India,United Kingdom,Germany,Japan,Canada,Australia,Ireland,New Zealand,Singapore,France,Netherlands,Italy,Spain,Sweden,South Korea')).split(',').map((s) => s.trim()).filter(Boolean);
    if (countries.length && env('FEES_ALL_COUNTRIES', 'off') !== 'on') q = q.in('country', countries);
    q = q.order('fees_checked_at', { ascending: true, nullsFirst: true }).order('ranking', { ascending: true, nullsFirst: false });
  }
  // Order: every NIRF-ranked college (best rank first), then every world-ranked university (CWTS Leiden, best rank first)
  // — each until it was read once in FEES_RECHECK_DAYS — then the rest, oldest-checked first.
  let colleges = [];
  if (!collegeId) {
    const { data: top, error } = await supabase.rpc('fee_queue', { p_lim: limit, p_recheck_days: Number(env('FEES_RECHECK_DAYS', 60)) });
    if (error) console.warn('[official-fees] queue:', error.message);
    colleges = (top || []).map(({ id, name, city, country, website }) => ({ id, name, city, country, website }));
  }
  if (colleges.length < limit) {
    const { data } = await q.limit(limit - colleges.length);
    colleges.push(...(data || []).filter((c) => !colleges.some((x) => x.id === c.id)));
  }
  let checked = 0, added = 0, blocked = 0, paused = null;
  for (const college of colleges) {
    if (!collegeId && !force && serverBusy()) { paused = 'server busy'; break; }
    await supabase.from('colleges').update({ fees_checked_at: new Date().toISOString() }).eq('id', college.id);
    const home = /^https?:\/\//i.test(college.website) ? college.website : `https://${college.website}`;
    if (!(await allowedByRobots(home))) { blocked++; continue; }
    const first = await grab(home); if (!first) continue;
    checked++;
    const links = [...new Map(first.links.filter((l) => LINK.test(`${l.label} ${l.href}`))
      .map((l) => { try { return new URL(l.href, first.url).toString().split('#')[0]; } catch { return null; } })
      .filter((u) => u && sameSite(u, first.url)).map((u) => [u, u])).keys()]
      .sort((a, b) => Number(/fee|tuition/i.test(b)) - Number(/fee|tuition/i.test(a))).slice(0, 5);
    const pages = [first];
    for (const u of links) {
      if (!(await allowedByRobots(u))) continue;
      await sleep(2000);
      const p = await grab(u); if (p) pages.push(p);
    }
    for (const page of pages) added += await saveFindings(college, page, await extract(college, page));
  }
  if (added || checked) console.log(`[official-fees] ${checked} college site(s) read · ${added} new fee(s) · ${blocked} skipped by robots.txt`);
  return { checked, added, blocked, ...(paused ? { paused } : {}) };
}

export function startOfficialFees() {
  if (env('FEES_AUTO', 'on') === 'off') return;
  const run = whenIdle('official fees', () => collectOfficialFees().catch((e) => console.warn('[official-fees]', e.message)));
  setTimeout(run, 20 * 60e3);
  setInterval(run, Math.max(1, Number(env('FEES_EVERY_HOURS', 1))) * 3600e3).unref();
}
