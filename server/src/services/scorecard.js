import { supabase } from '../supabase.js';
import { fetchJson } from './http.js';
import { slugify } from '../schemas.js';
import { cityLocator, upsertColleges, dropManualDuplicates } from './collegeUpsert.js';

// United States: every college in the federal College Scorecard (~6,000+ institutions) with
// real tuition, size, admission rate and location. Free key: https://api.data.gov/signup/
const BASE = process.env.SCORECARD_API_URL || 'https://api.data.gov/ed/collegescorecard/v1/schools';
const FIELDS = [
  'id', 'school.name', 'school.alias', 'school.city', 'school.state', 'school.zip', 'school.school_url', 'school.ownership',
  'location.lat', 'location.lon', 'latest.student.size', 'latest.cost.tuition.in_state', 'latest.cost.tuition.out_of_state',
  'latest.admissions.admission_rate.overall', 'latest.completion.rate_suppressed.overall',
  'latest.earnings.10_yrs_after_entry.median', 'school.degrees_awarded.predominant',
].join(',');
const OWN = { 1: 'Public', 2: 'Private', 3: 'Private' };
const OWN_LABEL = { 1: 'Public', 2: 'Private nonprofit', 3: 'Private for-profit' };
const STATES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',PR:'Puerto Rico',GU:'Guam',VI:'U.S. Virgin Islands' };

export const scorecardEnabled = () => Boolean(process.env.COLLEGE_SCORECARD_API_KEY);

export async function fetchScorecard({ degreesOnly = true, log = () => {} } = {}) {
  const out = [];
  for (let page = 0; page < 200; page++) {
    const p = new URLSearchParams({ api_key: process.env.COLLEGE_SCORECARD_API_KEY, fields: FIELDS, per_page: '100', page: String(page) });
    if (degreesOnly) p.set('school.degrees_awarded.predominant__range', '2..4'); // associate, bachelor, graduate
    const data = await fetchJson(`${BASE}?${p}`, { timeoutMs: 60000 });
    const results = data?.results || [];
    out.push(...results);
    log(`fetched ${out.length} / ${data?.metadata?.total ?? '?'}`);
    if (results.length < 100) break;
    await new Promise((r) => setTimeout(r, 300));
  }
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
    },
    is_published: true, data_updated_at: new Date().toISOString(),
  };
}

export async function importScorecard({ startedBy = null, log = () => {} } = {}) {
  if (!scorecardEnabled()) throw new Error('Set COLLEGE_SCORECARD_API_KEY in server/.env (free at api.data.gov/signup)');
  const { data: run } = await supabase.from('import_runs').insert({ kind: 'scorecard', params: { country: 'US' }, started_by: startedBy }).select('id').single();
  const finish = (patch) => run && supabase.from('import_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', run.id);
  try {
    const raw = await fetchScorecard({ log });
    const locate = await cityLocator('US');
    const rows = raw.filter((s) => s['school.name']).map((s) => mapScorecard(s, locate));
    const { keep, skipped } = await dropManualDuplicates(rows, 'United States');
    const { inserted, updated } = await upsertColleges(keep, { log });
    await finish({ status: 'done', inserted, updated, skipped, message: `College Scorecard: ${raw.length} institutions` });
    return { inserted, updated, skipped };
  } catch (e) {
    await finish({ status: 'failed', message: e.message });
    throw e;
  }
}
