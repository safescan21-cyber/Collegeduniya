import { supabase } from '../supabase.js';
import { fetchJson } from './http.js';
import { slugify } from '../schemas.js';
import { cityLocator, upsertColleges, dropManualDuplicates, host, normName } from './collegeUpsert.js';

// United States: every college in the federal College Scorecard (~6,000+ institutions) with
// real tuition, size, admission rate and location. Free key: https://api.data.gov/signup/
const BASE = process.env.SCORECARD_API_URL || 'https://api.data.gov/ed/collegescorecard/v1/schools';
const FIELDS = [
  'id', 'school.name', 'school.alias', 'school.city', 'school.state', 'school.zip', 'school.school_url', 'school.ownership',
  'location.lat', 'location.lon', 'latest.student.size', 'latest.cost.tuition.in_state', 'latest.cost.tuition.out_of_state',
  'latest.admissions.admission_rate.overall', 'latest.completion.rate_suppressed.overall',
  'latest.earnings.10_yrs_after_entry.median', 'school.degrees_awarded.predominant',
  'latest.programs.cip_4_digit',   // every programme the college awards: subject + degree level → its course list
].join(',');
// Last year's admitted students: middle 50% (25th–75th percentile) SAT section scores and ACT composite (IPEDS via Scorecard)
const SCORE_FIELDS = ['latest.admissions.sat_scores.25th_percentile.critical_reading', 'latest.admissions.sat_scores.75th_percentile.critical_reading',
  'latest.admissions.sat_scores.25th_percentile.math', 'latest.admissions.sat_scores.75th_percentile.math',
  'latest.admissions.act_scores.25th_percentile.cumulative', 'latest.admissions.act_scores.75th_percentile.cumulative'].join(',');
// Scorecard credential levels → our course levels
const CRED_LEVEL = { 1: 'Certificate', 2: 'UG', 3: 'UG', 4: 'Certificate', 5: 'PG', 6: 'PhD', 7: 'PG', 8: 'Certificate' };
const CRED_NAME = { 1: 'Undergraduate certificate', 2: "Associate's degree", 3: "Bachelor's degree", 4: 'Post-baccalaureate certificate',
  5: "Master's degree", 6: 'Doctoral degree', 7: 'Professional degree', 8: 'Graduate certificate' };
const OWN = { 1: 'Public', 2: 'Private', 3: 'Private' };
const OWN_LABEL = { 1: 'Public', 2: 'Private nonprofit', 3: 'Private for-profit' };
const STATES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',PR:'Puerto Rico',GU:'Guam',VI:'U.S. Virgin Islands' };

export const scorecardEnabled = () => Boolean(process.env.COLLEGE_SCORECARD_API_KEY);

// one tiny request to check a key right after it is saved in the admin panel
export async function testScorecardKey() {
  const p = new URLSearchParams({ api_key: process.env.COLLEGE_SCORECARD_API_KEY || '', fields: 'id,school.name', per_page: '1' });
  const res = await fetch(`${BASE}?${p}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(res.status === 403 ? 'api.data.gov says the key is not valid' : `HTTP ${res.status}`);
  const j = await res.json();
  return { ok: true, sample: Number(j?.metadata?.total || 0) };
}

export async function fetchScorecard({ degreesOnly = true, log = () => {} } = {}) {
  const out = [];
  let fields = `${FIELDS},${SCORE_FIELDS}`; let per = 50;   // programme lists make each school larger → smaller pages
  for (let page = 0; page < 400; page++) {
    const p = new URLSearchParams({ api_key: process.env.COLLEGE_SCORECARD_API_KEY, fields, per_page: String(per), page: String(page) });
    if (degreesOnly) p.set('school.degrees_awarded.predominant__range', '2..4'); // associate, bachelor, graduate
    let data;
    try { data = await fetchJson(`${BASE}?${p}`, { timeoutMs: 90000 }); } catch (e) {
      // if the API refuses the test-score fields, import without them
      if (page === 0 && fields.includes('sat_scores')) { log(`test scores not available (${e.message}) — importing without them`); fields = FIELDS; page--; continue; }
      // if the API refuses the programme field, still import colleges with tuition (without course lists)
      if (page === 0 && fields.includes('programs')) { log(`programmes not available (${e.message}) — importing colleges without course lists`); fields = FIELDS.replace(',latest.programs.cip_4_digit', ''); per = 100; page--; continue; }
      throw e;
    }
    const results = data?.results || [];
    out.push(...results);
    log(`fetched ${out.length} / ${data?.metadata?.total ?? '?'}`);
    if (results.length < per) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}

// SAT total = reading/writing + math at the same percentile; only when both sections are reported
export function testScores(s) {
  const n = (k) => { const v = s[`latest.admissions.${k}`]; return v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)); };
  const r25 = n('sat_scores.25th_percentile.critical_reading'), r75 = n('sat_scores.75th_percentile.critical_reading');
  const m25 = n('sat_scores.25th_percentile.math'), m75 = n('sat_scores.75th_percentile.math');
  const a25 = n('act_scores.25th_percentile.cumulative'), a75 = n('act_scores.75th_percentile.cumulative');
  const out = {};
  if (r25 && m25 && r75 && m75) { out.sat_25 = r25 + m25; out.sat_75 = r75 + m75; }
  if (a25 && a75) { out.act_25 = a25; out.act_75 = a75; }
  return out;
}

export function mapScorecard(s, locate) {
  const site = s['school.school_url'] ? (/^https?:/i.test(s['school.school_url']) ? s['school.school_url'] : `https://${s['school.school_url']}`) : null;
  const state = STATES[s['school.state']] || s['school.state'];
  const inS = s['latest.cost.tuition.in_state']; const outS = s['latest.cost.tuition.out_of_state'];
  const loc = s['location.lat'] == null ? locate(s['school.city'], state) : null;
  return {
    source: 'scorecard', external_id: String(s.id), name: s['school.name'],
    slug: `${slugify(`${s['school.name']} ${s['school.city'] || ''}`).slice(0, 70)}-${s.id}`,
    country: 'United States', country_code: 'US', state, city: s['school.city'] || 'Not specified',
    city_geoname_id: loc?.geoname_id || null,
    latitude: s['location.lat'] ?? loc?.latitude ?? null, longitude: s['location.lon'] ?? loc?.longitude ?? null,
    website: site, type: OWN[s['school.ownership']] || 'Other', management: OWN_LABEL[s['school.ownership']] || null,
    fees_min: inS ?? outS ?? null, fees_max: outS ?? inS ?? null, currency: 'USD',
    students_count: s['latest.student.size'] ?? null,
    admission_rate: s['latest.admissions.admission_rate.overall'] ?? null,
    facts: {
      graduation_rate: s['latest.completion.rate_suppressed.overall'] ?? null,
      median_earnings_10y: s['latest.earnings.10_yrs_after_entry.median'] ?? null,
      fees_note: 'Annual tuition (in-state – out-of-state), U.S. College Scorecard',
      ...testScores(s),
    },
    is_published: true, data_updated_at: new Date().toISOString(),
  };
}

// Courses for one college from its Scorecard programmes. Fees: Scorecard publishes one undergraduate tuition per college
// (out-of-state = what international students pay at public colleges), so it is shown on undergraduate programmes only;
// graduate tuition is not in the data, so graduate programmes show no fee rather than a guess.
function programmeRows(collegeId, s) {
  const list = Array.isArray(s['latest.programs.cip_4_digit']) ? s['latest.programs.cip_4_digit'] : [];
  const ugFee = s['latest.cost.tuition.out_of_state'] ?? s['latest.cost.tuition.in_state'] ?? null;
  const seen = new Set(); const out = [];
  for (const p of list) {
    const lvl = Number(p?.credential?.level ?? p?.credential_level ?? p?.credlev); const title = String(p?.title || p?.cip4_title || '').replace(/\.$/, '').trim();
    if (!title || !CRED_LEVEL[lvl]) continue;
    const ext = `${p.code || title}|${lvl}`; if (seen.has(ext)) continue; seen.add(ext);
    const level = CRED_LEVEL[lvl];
    out.push({ college_id: collegeId, source: 'scorecard', external_id: ext, name: `${CRED_NAME[lvl]} — ${title}`.slice(0, 200), level,
      fees: level === 'UG' && ugFee ? ugFee : null, currency: 'USD', study_mode: null, duration: null, url: null });
  }
  return out;
}

export { programmeRows };
export async function importScorecard({ startedBy = null, log = () => {} } = {}) {
  if (!scorecardEnabled()) throw new Error('Set COLLEGE_SCORECARD_API_KEY in server/.env (free at api.data.gov/signup)');
  const { data: run } = await supabase.from('import_runs').insert({ kind: 'scorecard', params: { country: 'US' }, started_by: startedBy }).select('id').single();
  const finish = (patch) => run && supabase.from('import_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', run.id);
  try {
    const raw = (await fetchScorecard({ log })).filter((s) => s['school.name']);
    const locate = await cityLocator('US');
    const rows = raw.map((s) => mapScorecard(s, locate));

    // 1) U.S. colleges that already exist from the free university list (Hipolabs / Wikidata) get the Scorecard data
    //    written INTO them, so the pages students already see show tuition — instead of a second copy being added.
    //    Match by website first; by name only when the name is unique on both sides ("Columbia College" exists in several states).
    const existing = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('colleges').select('id, name, website, state, facts, latitude, longitude, city')
        .eq('country', 'United States').in('source', ['hipolabs', 'wikidata']).range(from, from + 999);
      existing.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    const byHost = new Map(); const nameCount = new Map(); const byName = new Map();
    for (const e of existing) {
      const h = host(e.website || ''); if (h && !byHost.has(h)) byHost.set(h, e);
      const n = normName(e.name); nameCount.set(n, (nameCount.get(n) || 0) + 1); byName.set(n, e);
    }
    const scNameCount = new Map(); rows.forEach((r) => scNameCount.set(normName(r.name), (scNameCount.get(normName(r.name)) || 0) + 1));
    const matchOf = (r) => {
      const h = host(r.website || ''); if (h && byHost.has(h)) return byHost.get(h);
      const n = normName(r.name); return nameCount.get(n) === 1 && scNameCount.get(n) === 1 ? byName.get(n) : null;
    };
    const collegeIdByExt = new Map(); const fresh = []; let merged = 0; const used = new Set();
    const mergeOne = async (r, e) => {
      const patch = { fees_min: r.fees_min, fees_max: r.fees_max, currency: 'USD', students_count: r.students_count, admission_rate: r.admission_rate,
        management: r.management, type: r.type, facts: { ...(e.facts || {}), ...r.facts }, data_updated_at: r.data_updated_at };
      if (!e.website && r.website) patch.website = r.website;
      if (!e.state && r.state) patch.state = r.state;
      if ((!e.city || e.city === 'Not specified') && r.city && r.city !== 'Not specified') patch.city = r.city;
      if (e.latitude == null && r.latitude != null) { patch.latitude = r.latitude; patch.longitude = r.longitude; }
      for (const k of Object.keys(patch)) if (patch[k] == null) delete patch[k];
      const { error } = await supabase.from('colleges').update(patch).eq('id', e.id);
      if (error) throw new Error(`merge ${r.name}: ${error.message}`);
    };
    const toMerge = [];
    for (const r of rows) {
      const e = matchOf(r);
      if (e && !used.has(e.id)) { used.add(e.id); toMerge.push([r, e]); collegeIdByExt.set(r.external_id, e.id); } else fresh.push(r);
    }
    for (let i = 0; i < toMerge.length; i += 8) {   // a few at a time
      await Promise.all(toMerge.slice(i, i + 8).map(([r, e]) => mergeOne(r, e))); merged += Math.min(8, toMerge.length - i);
      if (i % 400 === 0) log(`tuition added to existing colleges: ${merged} / ${toMerge.length}`);
    }
    // a copy this import added earlier for a college that has now been matched is hidden (the original keeps its links)
    const mergedExt = toMerge.map(([r]) => r.external_id);
    for (let i = 0; i < mergedExt.length; i += 500) {
      await supabase.from('colleges').update({ is_published: false }).eq('source', 'scorecard').in('external_id', mergedExt.slice(i, i + 500));
    }

    // 2) the rest are new to the site
    const { keep, skipped } = await dropManualDuplicates(fresh, 'United States');
    const { inserted, updated } = await upsertColleges(keep, { log });
    const ext = keep.map((r) => r.external_id);
    for (let i = 0; i < ext.length; i += 500) {
      const { data } = await supabase.from('colleges').select('id, external_id').eq('source', 'scorecard').in('external_id', ext.slice(i, i + 500));
      (data || []).forEach((d) => collegeIdByExt.set(d.external_id, d.id));
    }

    // 3) courses: every programme of every college
    let courses = 0; let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const { error } = await supabase.from('courses').upsert(batch, { onConflict: 'college_id,source,external_id' });
      if (error) throw new Error(`courses: ${error.message}`);
      courses += batch.length; batch = [];
    };
    for (const s of raw) {
      const id = collegeIdByExt.get(String(s.id)); if (!id) continue;
      batch.push(...programmeRows(id, s));
      if (batch.length >= 500) { await flush(); if (courses % 10000 < 500) log(`courses saved: ${courses}`); }
    }
    await flush();

    await finish({ status: 'done', inserted, updated: updated + merged, skipped,
      message: `College Scorecard: ${raw.length} institutions · tuition added to ${merged} existing U.S. colleges · ${courses.toLocaleString('en')} programmes as courses` });
    return { inserted, updated: updated + merged, skipped, courses };
  } catch (e) {
    await finish({ status: 'failed', message: e.message });
    throw e;
  }
}
