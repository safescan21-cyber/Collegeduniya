// Admin → Fetch data: every college-data collector as a one-click job. Runs in the background on the server;
// the page polls /api/admin/fetch/status. Same code as the scheduled runs and `npm run fetch` (scripts/fetch.js).
import { supabase } from '../supabase.js';

const COUNTRY = /^[A-Za-z][A-Za-z .'-]{1,40}$/;
export const JOBS = {
  courses_jp: { label: 'Japan: courses from university websites', hint: '6 universities a click', run: async () => (await import('./officialCourses.js')).collectCourses('JP', { limit: 6, force: true }) },
  courses_de: { label: 'Germany: courses from university websites', hint: '6 universities a click', run: async () => (await import('./officialCourses.js')).collectCourses('DE', { limit: 6, force: true }) },
  fees: { label: 'Fees from official fee pages', hint: '10 colleges a click — review them in Official fees', run: async () => (await import('./officialFees.js')).collectOfficialFees({ limit: 10, force: true }) },
  photos: { label: 'Photos, logos & descriptions', hint: 'Wikipedia / Wikimedia — 200 colleges of the country you type (blank = any)', param: 'country code, e.g. JP',
    run: async (p, log) => (await import('./wikimedia.js')).enrichMany({ country: /^[A-Za-z]{2}$/.test(p || '') ? p.toUpperCase() : null, limit: 200, onlyMissingPhotos: true, log }) },
  autofill: { label: 'Fill missing details (any country)', hint: 'one batch of photos/descriptions', run: async () => (await import('./collegeAutofill.js')).runAutofill({ reason: 'admin' }) },
  exams: { label: 'Exam dates from official sites', hint: '12 exams a click', run: async () => (await import('./examDates.js')).collectExamDates({ limit: 12 }) },
  names: { label: 'Clean up college names', hint: 'up to 300 imported names', run: async () => { const { data, error } = await supabase.rpc('fix_college_names', { p_lim: 300 }); if (error) throw error; return data; } },
  country: { label: 'Add / update a whole country', hint: 'all universities of the country you type', param: 'country, e.g. Japan or FR', heavy: true,
    run: async (p, log) => { if (!COUNTRY.test(p || '')) throw new Error('Type a country name or 2-letter code'); return (await import('./universities.js')).importCountry(p.trim(), { log }); } },
  us: { label: 'U.S. colleges (Scorecard)', hint: 'fees, admission rate, SAT/ACT, courses — about 6,000 colleges, takes minutes', heavy: true,
    run: async (_p, log) => { const m = await import('./scorecard.js'); if (!m.scorecardEnabled()) throw new Error('COLLEGE_SCORECARD_API_KEY missing in server/.env'); return m.importScorecard({ log }); } },
  australia: { label: 'Australia courses & fees (CRICOS)', hint: 'downloads the latest government file', heavy: true, run: async (_p, log) => (await import('./cricos.js')).importCricos({ log }) },
};

const state = {};   // job → { running, param, started_at, finished_at, result, error, log[] }
const short = (r) => { try { const s = JSON.stringify(r); return s && s.length > 600 ? `${s.slice(0, 600)}…` : r; } catch { return String(r); } };

export function startJob(key, param = '') {
  const job = JOBS[key];
  if (!job) throw Object.assign(new Error('Unknown job'), { status: 404 });
  if (state[key]?.running) throw Object.assign(new Error('Already running — wait for it to finish'), { status: 409 });
  if (job.heavy && Object.entries(state).some(([k, s]) => s.running && JOBS[k]?.heavy)) throw Object.assign(new Error('Another big import is running — start this after it finishes'), { status: 409 });
  const s = state[key] = { running: true, param: param || null, started_at: new Date().toISOString(), log: [] };
  const log = (m) => { s.log.push(String(m).slice(0, 200)); if (s.log.length > 8) s.log.shift(); };
  job.run(param, log)
    .then((r) => { s.result = short(r); })
    .catch((e) => { s.error = e.message; console.warn(`[fetch ${key}]`, e.message); })
    .finally(() => { s.running = false; s.finished_at = new Date().toISOString(); });
  return s;
}

export function jobStatus() {
  return Object.fromEntries(Object.entries(JOBS).map(([k, j]) => [k, { label: j.label, hint: j.hint, param: j.param || null, heavy: !!j.heavy, ...(state[k] || {}) }]));
}
