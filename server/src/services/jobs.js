import { fetchJson } from './http.js';
import { cached } from './cache.js';

// Local job listings for the city a student is looking at.
// Providers are optional — each one is used only if its key is set in .env:
//   Adzuna  (ADZUNA_APP_ID + ADZUNA_APP_KEY) — ~19 countries, free developer tier
//   Jooble  (JOOBLE_API_KEY)                  — 60+ countries, free key on request (limited calls → cached)
// Results are cached per city for JOBS_CACHE_HOURS (default 12h) to stay inside free quotas.

const ADZUNA_COUNTRIES = new Set(['gb', 'us', 'at', 'au', 'be', 'br', 'ca', 'ch', 'de', 'es', 'fr', 'in', 'it', 'mx', 'nl', 'nz', 'pl', 'sg', 'za']);
const HOURS = Number(process.env.JOBS_CACHE_HOURS || 12);
const strip = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// one small real search to check a key right after it is saved in the admin panel
export async function testJobsProvider(name) {
  const args = { city: 'Delhi', countryName: 'India', what: 'engineer' };
  const list = name === 'jooble' ? await jooble(args) : await adzuna({ ...args, country: 'in' });
  return { ok: true, sample: list.length };
}

export function providersStatus() {
  return {
    adzuna: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    jooble: Boolean(process.env.JOOBLE_API_KEY),
  };
}

async function adzuna({ country, city, what, page = 1 }) {
  const cc = (country || '').toLowerCase();
  if (!ADZUNA_COUNTRIES.has(cc)) return [];
  const p = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID, app_key: process.env.ADZUNA_APP_KEY,
    results_per_page: '20', where: city, 'content-type': 'application/json', sort_by: 'date',
  });
  if (what) p.set('what', what);
  const data = await fetchJson(`${process.env.ADZUNA_API_URL || 'https://api.adzuna.com/v1/api'}/jobs/${cc}/search/${page}?${p}`);
  return (data?.results || []).map((j) => ({
    id: `adzuna:${j.id}`, source: 'Adzuna', title: strip(j.title), company: j.company?.display_name || null,
    location: j.location?.display_name || city, snippet: strip(j.description).slice(0, 220),
    salary_min: j.salary_min ?? null, salary_max: j.salary_max ?? null, salary_text: null,
    contract: [j.contract_time, j.contract_type].filter(Boolean).join(' · ') || null,
    url: j.redirect_url, posted_at: j.created || null,
    latitude: j.latitude ?? null, longitude: j.longitude ?? null,
  }));
}

async function jooble({ city, countryName, what }) {
  const body = { keywords: what || '', location: [city, countryName].filter(Boolean).join(', '), page: 1, ResultOnPage: 20 };
  const data = await fetchJson(`${process.env.JOOBLE_API_URL || 'https://jooble.org/api'}/${process.env.JOOBLE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return (data?.jobs || []).map((j) => ({
    id: `jooble:${j.id}`, source: 'Jooble', title: strip(j.title), company: j.company || null,
    location: j.location || city, snippet: strip(j.snippet).slice(0, 220),
    salary_min: null, salary_max: null, salary_text: j.salary || null,
    contract: j.type || null, url: j.link, posted_at: j.updated || null, latitude: null, longitude: null,
  }));
}

// what: keywords. Default favours student-friendly roles.
export async function localJobs({ city, country, countryName, what = 'part time', fresh = false }) {
  if (!city) return { jobs: [], providers: providersStatus() };
  const status = providersStatus();
  const key = `jobs:${(country || '').toLowerCase()}:${city.toLowerCase()}:${what.toLowerCase()}`;
  const run = async () => {
    const tasks = [];
    if (status.adzuna) tasks.push(adzuna({ country, city, what }).catch((e) => { console.warn('[adzuna]', e.message); return []; }));
    if (status.jooble) tasks.push(jooble({ city, countryName, what }).catch((e) => { console.warn('[jooble]', e.message); return []; }));
    const lists = await Promise.all(tasks);
    // de-duplicate by title+company
    const seen = new Set();
    const jobs = lists.flat().filter((j) => {
      const k = `${j.title}|${j.company}`.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    jobs.sort((a, b) => String(b.posted_at || '').localeCompare(String(a.posted_at || '')));
    return jobs.slice(0, 40);
  };
  if (!status.adzuna && !status.jooble) return { jobs: [], providers: status };
  const jobs = fresh ? await run() : await cached(key, HOURS * 3600e3, run);
  return { jobs, providers: status };
}
