import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { getUpload, startRunSafe } from './coursesSheetRuns.js';
import { normName } from './collegeUpsert.js';

// Courses for any country from one spreadsheet (CSV/XLSX): one row per course.
// Columns (names are guessed, can be changed in the admin panel):
//   college (name)  · or college id / page link (slug) · country · city · course · level · duration · fees (per year)
//   · currency · seats · eligibility / requirements · course page link · language
// A course is updated (not duplicated) when the same college + course name + level is uploaded again.

export const COURSE_TARGETS = {
  college: 'College / university name', college_ref: 'College id or page link (optional, most exact)', country: 'Country', city: 'City (helps matching)',
  name: 'Course name *', level: 'Level (UG / PG / PhD / Diploma / Certificate)', duration: 'Duration', fees: 'Fees per year', fees_total: 'Total course fee (converted to per year)',
  currency: 'Currency (EUR, USD, JPY…)', seats: 'Seats', eligibility: 'Eligibility / requirements', url: 'Course page link', language: 'Teaching language', intake: 'Intake / start month',
};
const GUESS = [
  ['college_ref', /college.?id|slug|page.?link|collegeolo/i], ['college', /^(college|university|institution|institute|school|provider)( name)?$/i],
  ['country', /country/i], ['city', /^city|town|campus/i], ['name', /^(course|programme|program|degree)( name| title)?$|title/i],
  ['level', /level|degree.?type|qualification/i], ['duration', /duration|length|years?$/i], ['fees_total', /total.*(fee|tuition|cost)/i],
  ['fees', /fee|tuition|cost/i], ['currency', /currency|curr/i], ['seats', /seat|intake.?size|capacity/i],
  ['eligibility', /eligib|requirement|entry|admission/i], ['url', /url|link|website/i], ['language', /language|medium/i], ['intake', /intake|start/i],
];
export function guessCourseMapping(headers) {
  const used = new Set(); const map = {};
  for (const [t, re] of GUESS) { const h = headers.find((x) => !used.has(x) && re.test(String(x).trim())); if (h) { map[t] = h; used.add(h); } }
  return map;
}

export function levelOf(s, name = '') {
  const v = `${s || ''} ${name || ''}`.toLowerCase();
  if (/ph\.?\s?d|doctor|doktor|dphil/.test(v)) return 'PhD';
  if (/master|\bm\.?\s?(sc|tech|a|com|ba|phil|eng|s)\b|mba|\bpg\b|post.?grad|graduate (certificate|diploma)|llm/.test(v)) return 'PG';
  if (/bachelor|\bb\.?\s?(sc|tech|a|com|ba|e|eng|s)\b|\bug\b|under.?grad|undergraduate|llb|mbbs|associate degree/.test(v)) return 'UG';
  if (/diploma/.test(v)) return 'Diploma';
  if (/certificate|cert\b|short course/.test(v)) return 'Certificate';
  return 'UG';
}
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return String(v ?? '').replace(/[^\d]/g, '') !== '' && Number.isFinite(n) ? n : null; };
const yearsIn = (d) => { const s = String(d || '').toLowerCase(); const n = Number((s.match(/[\d.]+/) || [])[0]); if (!n) return null; if (/month/.test(s)) return n / 12; if (/week/.test(s)) return n / 52; if (/semester/.test(s)) return n / 2; return n; };
const CUR = { '€': 'EUR', '$': 'USD', '£': 'GBP', '¥': 'JPY', '₹': 'INR', 'a$': 'AUD', 'c$': 'CAD', '₩': 'KRW' };

// find a college: exact id/slug → name (+ country, + city) — never guesses between two similar names
async function makeFinder() {
  const cache = new Map();
  const find = async (row, m, defCountry) => {
    const ref = String(row[m.college_ref] || '').trim();
    if (ref) {
      const slug = ref.split('/college/').pop().split(/[?#/]/)[0];
      const q = /^[0-9a-f-]{36}$/i.test(slug) ? supabase.from('colleges').select('id, name, currency').eq('id', slug) : supabase.from('colleges').select('id, name, currency').eq('slug', slug);
      const { data } = await q.maybeSingle(); if (data) return data;
    }
    // "Technische Universität Berlin | Technical University of Berlin | TU Berlin": try each name the college goes by
    const names = String(row[m.college] || '').split('|').map((x) => x.trim()).filter(Boolean);
    if (names.length > 1) { for (const n of names) { const hit = await find({ ...row, [m.college]: n, [m.college_ref]: '' }, m, defCountry); if (hit) return hit; } return null; }
    const name = names[0]; if (!name) return null;
    const country = String(row[m.country] || defCountry || '').trim(); const city = String(row[m.city] || '').trim();
    const key = `${normName(name)}|${country.toLowerCase()}|${city.toLowerCase()}`;
    if (cache.has(key)) return cache.get(key);
    let q = supabase.from('colleges').select('id, name, city, country, currency').ilike('name', name.replace(/[%_,()]/g, ' ').trim()).limit(5);
    if (country) q = q.ilike('country', country);
    let { data } = await q;
    if (data?.length) data = data.filter((c) => normName(c.name) === normName(name));
    if (!data?.length) {   // same name with punctuation / "The" differences
      const { data: d2 } = await supabase.rpc('search_colleges', { p_q: name, p_limit: 10 });
      data = (d2 || []).filter((c) => normName(c.name) === normName(name) && (!country || String(c.country || '').toLowerCase() === country.toLowerCase()));
    }
    let hit = data?.length === 1 ? data[0] : (data || []).find((c) => city && String(c.city || '').toLowerCase() === city.toLowerCase()) || null;
    if (!hit && data?.length > 1 && !city) hit = null;   // ambiguous: needs city or id
    cache.set(key, hit);
    return hit;
  };
  return find;
}

export async function importCoursesSheet({ token, mapping: m, country = '', currency = '', dryRun = false, startedBy = null, log = () => {}, bundled = null }) {
  const up = getUpload(token); if (!up) throw new Error('Upload expired — upload the file again');
  if (!m?.name || (!m.college && !m.college_ref)) throw new Error('Choose the course name column and the college column (or college id)');
  const runId = dryRun ? null : await startRunSafe('courses_sheet', { file: up.filename, rows: up.rows.length, ...(bundled ? { bundled } : {}) }, startedBy);
  const finish = (patch) => runId && supabase.from('import_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', runId);
  try {
    const find = await makeFinder();
    const byCollege = new Map(); const unmatched = new Map(); let skipped = 0;
    for (const r of up.rows) {
      const name = String(r[m.name] || '').trim(); if (!name) { skipped++; continue; }
      const c = await find(r, m, country);
      if (!c) { const k = String(r[m.college] || r[m.college_ref] || '?').split('|')[0].trim(); unmatched.set(k, (unmatched.get(k) || 0) + 1); continue; }
      const level = levelOf(r[m.level], name);
      const duration = String(r[m.duration] || '').trim() || null;
      let fees = num(r[m.fees]);
      if (fees == null && m.fees_total) { const t = num(r[m.fees_total]); const y = yearsIn(duration); fees = t != null ? Math.round(y && y >= 1 ? t / y : t) : null; }
      const rawCur = String(r[m.currency] || '').trim(); const sym = String(r[m.fees] || r[m.fees_total] || '').trim().slice(0, 2).toLowerCase();
      const cur = (rawCur && /^[A-Za-z]{3}$/.test(rawCur) ? rawCur.toUpperCase() : null) || CUR[sym] || CUR[sym[0]] || currency || c.currency || 'INR';
      const notes = [String(r[m.eligibility] || '').trim(), r[m.language] ? `Language: ${String(r[m.language]).trim()}` : '', r[m.intake] ? `Intake: ${String(r[m.intake]).trim()}` : ''].filter(Boolean).join(' · ');
      const ext = crypto.createHash('sha1').update(`${normName(name)}|${level}`).digest('hex').slice(0, 16);
      (byCollege.get(c.id) || byCollege.set(c.id, []).get(c.id)).push({ college_id: c.id, source: 'sheet', external_id: ext, name: name.slice(0, 200), level, duration, fees, currency: cur,
        seats: num(r[m.seats]), eligibility: notes.slice(0, 500) || null, url: /^https?:\/\//i.test(String(r[m.url] || '')) ? String(r[m.url]).trim() : null });
    }
    const total = [...byCollege.values()].reduce((a, b) => a + b.length, 0);
    const res = { rows: up.rows.length, colleges: byCollege.size, courses: total, skipped, unmatched_colleges: unmatched.size, unmatched: [...unmatched.entries()].slice(0, 30).map(([k, n]) => `${k} (${n})`) };
    if (dryRun) return { dryRun: true, ...res };
    for (const rows of byCollege.values()) {
      const dedup = [...new Map(rows.map((x) => [x.external_id, x])).values()];
      const { error } = await supabase.from('courses').upsert(dedup, { onConflict: 'college_id,source,external_id' });
      if (error) throw new Error(`courses: ${error.message}`);
      const fees = dedup.map((x) => x.fees).filter((f) => f > 0).sort((a, b) => a - b);
      if (fees.length) await supabase.from('colleges').update({ fees_min: fees[0], fees_max: fees[fees.length - 1] }).eq('id', dedup[0].college_id).is('fees_min', null);
    }
    await finish({ status: 'done', inserted: total, skipped: skipped + [...unmatched.values()].reduce((a, b) => a + b, 0), message: JSON.stringify(res).slice(0, 1000) });
    log(`Done: ${JSON.stringify(res)}`);
    return res;
  } catch (e) { await finish({ status: 'failed', message: e.message }); throw e; }
}
