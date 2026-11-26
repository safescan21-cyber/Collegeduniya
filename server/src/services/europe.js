import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { supabase } from '../supabase.js';
import { USER_AGENT } from './http.js';
import { normName, host } from './collegeUpsert.js';
import { slugify } from '../schemas.js';

// Official European data.
//  • UK — Discover Uni dataset (HESA/OfS, CC BY 4.0, credit "HESA"): every UK provider with its undergraduate courses,
//    course pages, graduate median salary, % in work or study and NSS student satisfaction.
//  • Europe — ETER, European Tertiary Education Register (European Commission): ~3,000 institutions in 36 countries
//    with legal status, founding year, city, coordinates, website and student numbers. Credit "Data source: ETER project".
// Both only fill EMPTY fields of existing colleges (never overwrite admin edits) and add colleges that are missing.

const UK_SOURCE = 'Discover Uni (HESA), CC BY 4.0';
const HESA_PAGE = 'https://www.hesa.ac.uk/data-and-analysis/discover-uni-dataset';
const ETER_API = process.env.ETER_API_URL || 'https://eter-project.com/api/4.0/HEIs/query/flattened';
const ETER_FIELDS = ['BAS.ETERID', 'BAS.REFYEAR', 'BAS.COUNTRY', 'BAS.INSTNAME', 'BAS.INSTNAMEENGL', 'BAS.WEBSITE', 'BAS.FOUNDYEAR', 'BAS.LEGALSTAT', 'BAS.INSTCATENGL',
  'GEO.CITY', 'GEO.COORDLAT', 'GEO.COORDLON', 'STUD.ISCED5_7MEN', 'STUD.ISCED5_7WOMEN', 'STUD.ISCED5_7GENUNCL', 'STUD.ISCED8MEN', 'STUD.ISCED8WOMEN'];

export async function fetchBuf(url, { timeoutMs = 300000, headers = {} } = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`${new URL(url).host}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// ---------------------------------------------------------------- shared: match / create colleges in a country
export async function collegeIndex(countryCode) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('colleges').select('id, name, short_name, website, domains, source, city, latitude, longitude, established, students_count, type, facts, is_published')
      .eq('country_code', countryCode).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const byHost = new Map(); const byName = new Map();
  for (const c of rows) {
    for (const h of [host(c.website || ''), ...(c.domains || [])].filter(Boolean)) byHost.set(h.replace(/^www\./, ''), c);
    byName.set(normName(c.name), c); if (c.short_name) byName.set(normName(c.short_name), c);
  }
  return { rows, find: ({ website, names }) => {
    const h = host(website || ''); if (h) { const hit = byHost.get(h) || byHost.get(h.split('.').slice(-3).join('.')); if (hit) return hit; }
    for (const n of names || []) { const hit = n && byName.get(normName(n)); if (hit) return hit; }
    return null;
  } };
}

// Prefer the dataset's own city name (nearest_city can land on a district); fall back to coordinates
export async function cityByName(cc, name) {
  if (!name || !cc) return null;
  const { data } = await supabase.from('cities').select('geoname_id, name, admin1').eq('country_code', cc)
    .or(`name.ilike.${String(name).replace(/[,()*%]/g, ' ').trim()},ascii_name.ilike.${String(name).replace(/[,()*%]/g, ' ').trim()}`).order('population', { ascending: false, nullsFirst: false }).limit(1);
  return data?.[0] ? { geoname_id: data[0].geoname_id, name: data[0].name, admin1: data[0].admin1 } : null;
}
export async function nearest(lat, lng) {
  if (lat == null || lng == null) return null;
  const { data } = await supabase.rpc('nearest_city', { lat, lng });
  return data?.[0] || null;
}

// Patch only empty fields; merge facts; never touch admin-created colleges' own values
export async function fillCollege(c, fields, factsKey, facts) {
  const patch = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === '') continue;
    const cur = c[k];
    if (cur == null || cur === '' || (k === 'city' && cur === 'Not specified') || (k === 'type' && cur === 'Other')) patch[k] = v;
  }
  patch.facts = { ...(c.facts || {}), [factsKey]: facts };
  if (patch.city && !c.is_published && c.source !== 'admin') patch.is_published = true;
  patch.data_updated_at = new Date().toISOString();
  const { error } = await supabase.from('colleges').update(patch).eq('id', c.id);
  if (error) throw new Error(error.message);
}

export async function createCollege({ source, external_id, name, country, country_code, website, latitude, longitude, established, type, students_count, factsKey, facts, currency, cityName }) {
  const near = (await cityByName(country_code, cityName)) || await nearest(latitude, longitude);
  const row = {
    source, external_id, name, country, country_code, website: website || null, domains: [host(website || '')].filter(Boolean),
    latitude: latitude ?? null, longitude: longitude ?? null, established: established || null, type: type || 'Other', students_count: students_count || null,
    city: near?.name || 'Not specified', state: near?.admin1 || null, city_geoname_id: near?.geoname_id || null,
    is_published: Boolean(near), currency: currency || null, facts: { [factsKey]: facts },
    slug: `${slugify(`${name} ${near?.name || country}`).slice(0, 70)}-${slugify(external_id).slice(-6)}`,
    data_updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('colleges').insert(row).select('id').single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      const { data: d } = await supabase.from('colleges').select('id').eq('source', source).eq('external_id', external_id).maybeSingle();
      return d?.id || null;
    }
    throw new Error(error.message);
  }
  return data.id;
}

export async function startRun(kind, params, startedBy) {
  const { data } = await supabase.from('import_runs').insert({ kind, params, started_by: startedBy }).select('id').single();
  return data?.id || null;
}
export const finishRun = (id, patch) => id && supabase.from('import_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', id);

// ---------------------------------------------------------------- UK: Discover Uni
async function discoverUniZipUrl() {
  if (process.env.DISCOVER_UNI_URL) return process.env.DISCOVER_UNI_URL;
  let html;
  try { html = (await fetchBuf(HESA_PAGE, { timeoutMs: 30000 })).toString('utf8'); } catch (e) {
    throw new Error(`HESA's website blocks automatic downloads (${e.message}). Download the zip at ${HESA_PAGE} in your browser and upload it in Admin → Import → UK & Europe.`);
  }
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => new URL(m[1].replace(/&amp;/g, '&'), HESA_PAGE).href);
  const hit = links.find((u) => /\.zip(\?|$)/i.test(u)) || links.find((u) => /download/i.test(u) && /(discover|unistats|kis|on_?course)/i.test(u));
  if (!hit) throw new Error('Could not find the download link on the HESA page — set DISCOVER_UNI_URL in server/.env, or upload the zip in Admin → Import');
  return hit;
}

const url = (u) => (u ? (/^https?:\/\//i.test(String(u)) ? String(u) : `https://${String(u).replace(/^\/+/, '')}`) : null);
const norm = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toUpperCase(), typeof v === 'string' ? v.trim() : v]));
const num = (v) => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[£,%\s]/g, '')); return Number.isFinite(n) ? n : null; };
const first = (r, keys) => { for (const k of keys) if (r[k] != null && r[k] !== '') return r[k]; return null; };

function readZip(buf) {
  const zip = new AdmZip(buf);
  const files = new Map();
  for (const e of zip.getEntries()) {
    if (e.isDirectory || !/\.csv$/i.test(e.entryName)) continue;
    files.set(e.entryName.split('/').pop().replace(/\.csv$/i, '').toUpperCase(), e);
  }
  const read = (name) => {
    const e = files.get(name.toUpperCase());
    if (!e) return [];
    return parse(e.getData(), { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, relax_quotes: true }).map(norm);
  };
  return { files: [...files.keys()].sort(), read, headers: (name) => { const r = read(name); return r.length ? Object.keys(r[0]) : []; } };
}

const MODE = { 1: 'Full-time', 2: 'Part-time', 3: 'Both' };
const KEY = (r) => `${r.PUBUKPRN || r.UKPRN}|${r.KISCOURSEID}|${r.KISMODE}`;

export async function importDiscoverUni({ zipBuffer = null, dryRun = false, startedBy = null, log = () => {} } = {}) {
  const runId = dryRun ? null : await startRun('discover_uni', {}, startedBy);
  try {
    let buf = zipBuffer;
    if (!buf) { const url = await discoverUniZipUrl(); log(`Downloading ${url}`); buf = await fetchBuf(url); }
    log(`Zip: ${(buf.length / 1048576).toFixed(1)} MB`);
    const z = readZip(buf);
    log(`Files: ${z.files.join(', ')}`);
    if (dryRun) {
      for (const f of ['INSTITUTION', 'LOCATION', 'KISCOURSE', 'GOSALARY', 'LEO3', 'NSS', 'GOVOICEWORK', 'EMPLOYMENT', 'JOBLIST']) if (z.files.includes(f)) log(`${f}: ${z.headers(f).join(', ')}`);
      return { dryRun: true, files: z.files };
    }
    const inst = z.read('INSTITUTION'); const locs = z.read('LOCATION'); const courses = z.read('KISCOURSE');
    if (!inst.length || !courses.length) throw new Error('INSTITUTION.csv or KISCOURSE.csv missing in the zip');
    log(`${inst.length} providers, ${courses.length} courses`);

    // per-course outcomes
    const salary = new Map(); for (const r of z.read('GOSALARY')) salary.set(KEY(r), num(first(r, ['GOINSTMED', 'INSTMED', 'GOSECMED'])));
    const leo = new Map(); for (const r of z.read('LEO3')) leo.set(KEY(r), num(first(r, ['LEO3INSTMED', 'INSTMED', 'LEO3SECMED'])));
    const work = new Map();
    for (const name of ['GOVOICEWORK', 'EMPLOYMENT']) for (const r of z.read(name)) {
      const v = num(first(r, ['GOWORKSTUDY', 'WORKSTUDY', 'EMPWORKSTUDY', 'INWORKSTUDY'])); if (v != null && !work.has(KEY(r))) work.set(KEY(r), v);
    }
    const nss = new Map();
    for (const r of z.read('NSS')) {
      // overall satisfaction question if the year has one (Q27 up to 2022, Q28 for Scotland/Wales/NI after); otherwise none
      const v = num(first(r, ['Q28', 'Q27'])); if (v != null) nss.set(KEY(r), v);
    }
    const locByProv = new Map();
    for (const l of locs) { const k = l.UKPRN || l.LOCUKPRN || l.PUBUKPRN; if (k && !locByProv.has(k) && num(l.LATITUDE) != null) locByProv.set(k, { lat: num(l.LATITUDE), lng: num(l.LONGITUDE), name: l.LOCNAME }); }

    const idx = await collegeIndex('GB');
    const coursesByProv = new Map();
    for (const c of courses) { const k = c.PUBUKPRN || c.UKPRN; (coursesByProv.get(k) || coursesByProv.set(k, []).get(k)).push(c); }

    let matched = 0, created = 0, coursesSaved = 0, outcomesSaved = 0, skipped = 0;
    const year = new Date().getFullYear();
    for (const p of inst) {
      const ukprn = p.PUBUKPRN || p.UKPRN;
      const name = first(p, ['FIRST_TRADING_NAME', 'LEGAL_NAME', 'PROVIDER_NAME', 'NAME', 'INSTITUTION_NAME']);
      const website = url(first(p, ['PROVURL', 'URL', 'WEBSITE']));
      const list = coursesByProv.get(ukprn) || [];
      if (!name || !list.length) { skipped++; continue; }
      const loc = locByProv.get(ukprn) || locByProv.get(p.UKPRN);
      const sat = list.map((c) => nss.get(KEY(c))).filter((v) => v != null);
      const sal = list.map((c) => salary.get(KEY(c))).filter((v) => v != null).sort((a, b) => a - b);
      const facts = { ukprn, source: UK_SOURCE, updated: new Date().toISOString().slice(0, 10), courses: list.length,
        nss_satisfaction: sat.length ? Math.round(sat.reduce((a, b) => a + b, 0) / sat.length) : null,
        median_salary_gbp: sal.length ? sal[Math.floor(sal.length / 2)] : null, uk_country: p.COUNTRY || null };
      let c = idx.find({ website, names: [name, p.LEGAL_NAME, p.OTHER_NAMES] });
      let id;
      if (c) {
        await fillCollege(c, { website, latitude: loc?.lat, longitude: loc?.lng, currency: 'GBP' }, 'uk', facts);
        if (c.city === 'Not specified' && loc) { const near = await nearest(loc.lat, loc.lng); if (near) await supabase.from('colleges').update({ city: near.name, state: near.admin1, city_geoname_id: near.geoname_id, ...(c.source !== 'admin' ? { is_published: true } : {}) }).eq('id', c.id); }
        id = c.id; matched++;
      } else {
        id = await createCollege({ source: 'discover_uni', external_id: ukprn, name, country: 'United Kingdom', country_code: 'GB', website, latitude: loc?.lat, longitude: loc?.lng, factsKey: 'uk', facts, currency: 'GBP' });
        if (!id) continue; created++;
      }
      // courses: replace this provider's imported courses
      const rows = list.map((k) => ({
        college_id: id, source: 'discover_uni', external_id: `${k.KISCOURSEID}|${k.KISMODE}`, name: (k.TITLE || k.TITLEW || 'Course').slice(0, 200),
        level: 'UG', study_mode: MODE[k.KISMODE] || null, url: k.CRSEURL || null, currency: 'GBP',
        duration: num(k.NUMSTAGE) ? `${num(k.NUMSTAGE)} years` : null,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('courses').upsert(rows.slice(i, i + 500), { onConflict: 'college_id,source,external_id' });
        if (error) throw new Error(`courses: ${error.message}`);
      }
      coursesSaved += rows.length;
      // graduate outcomes per course → placements table (shown on the college page)
      const out = list.map((k) => ({ k, s: salary.get(KEY(k)), w: work.get(KEY(k)) })).filter((x) => x.s != null || x.w != null)
        .map(({ k, s, w }) => ({ college_id: id, year, course: `${(k.TITLE || 'Course').slice(0, 150)} (${MODE[k.KISMODE] || ''})`.replace(' ()', ''),
          median_package: s, currency: 'GBP', package_unit: 'year', placement_rate: w, source: `${UK_SOURCE} — graduate median salary 15 months after the course; % in work or study` }));
      for (let i = 0; i < out.length; i += 500) {
        const { error } = await supabase.from('college_placements').upsert(out.slice(i, i + 500), { onConflict: 'college_id,year,course' });
        if (error) throw new Error(`outcomes: ${error.message}`);
      }
      outcomesSaved += out.length;
      if ((matched + created) % 25 === 0) log(`${matched + created} providers · ${coursesSaved} courses`);
    }
    const res = { providers: inst.length, matched, created, skipped, courses: coursesSaved, outcomes: outcomesSaved };
    await finishRun(runId, { status: 'done', inserted: created, updated: matched, skipped, message: JSON.stringify(res) });
    log(`Done: ${JSON.stringify(res)}`);
    return res;
  } catch (e) {
    await finishRun(runId, { status: 'failed', message: e.message });
    throw e;
  }
}

// ---------------------------------------------------------------- Europe: ETER
const ETER_CC = { UK: 'GB', EL: 'GR' };
const val = (v) => (v && typeof v === 'object' && 'v' in v ? v.v : v);
function pick(o, patterns) {
  for (const p of patterns) {
    const k = Object.keys(o).find((key) => p.test(key));
    if (k != null) { const v = val(o[k]); if (v != null && v !== '' && !/^[macsxz]$/i.test(String(v))) return v; }
  }
  return null;
}
function flatten(o, pre = '', out = {}) {
  for (const [k, v] of Object.entries(o || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !('v' in v)) flatten(v, `${pre}${k}.`, out);
    else out[`${pre}${k}`] = val(v);
  }
  return out;
}

export async function importEter({ countries = null, dryRun = false, startedBy = null, log = () => {} } = {}) {
  const runId = dryRun ? null : await startRun('eter', { countries }, startedBy);
  try {
    // ETER answers one reference year at a time; the newest years can be partly empty, so take the last few
    const list = [];
    const thisYear = new Date().getFullYear();
    for (let y = thisYear - 1; y >= thisYear - 6; y--) {
      log(`ETER ${y}…`);
      const r = await fetch(ETER_API, { method: 'POST', headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ filter: { 'BAS.REFYEAR.v': y, ...(countries?.length ? { 'BAS.COUNTRY.v': { $in: countries.map((c) => (c.toUpperCase() === 'GB' ? 'UK' : c.toUpperCase() === 'GR' ? 'EL' : c.toUpperCase())) } } : {}) }, fieldIds: ETER_FIELDS, searchTerms: [] }),
        signal: AbortSignal.timeout(180000) });
      if (!r.ok) { log(`ETER ${y}: HTTP ${r.status}`); continue; }
      const rows = await r.json().catch(() => []);
      for (const row of Array.isArray(rows) ? rows : []) list.push({ ...flatten(row), _yr: y });
      log(`ETER ${y}: ${Array.isArray(rows) ? rows.length : 0} institutions`);
      if (list.length && y <= thisYear - 4) break; // three populated years are plenty
    }
    if (!list.length) throw new Error('ETER answered with no institutions');
    if (dryRun) { log(`Fields: ${Object.keys(list[0]).join(', ')}`); return { dryRun: true, rows: list.length, sample: list[0] }; }

    // latest year per institution
    const latest = new Map();
    for (const r of list) {
      const id = pick(r, [/ETERID$/i, /ETER_?ID$/i, /^_id$/]); const yr = Number(pick(r, [/REFYEAR$/i])) || r._yr || 0;
      if (!id) continue;
      const cur = latest.get(id);
      const st = Math.round(['STUD.ISCED5_7MEN', 'STUD.ISCED5_7WOMEN', 'STUD.ISCED5_7GENUNCL', 'STUD.ISCED8MEN', 'STUD.ISCED8WOMEN'].reduce((a, k) => a + (Number(val(r[k])) || 0), 0)) || null;
      if (!cur || yr > cur.yr) latest.set(id, { r, yr, students: st || cur?.students || null, sYr: st ? yr : cur?.sYr || 0 });
      else if (st && yr > (cur.sYr || 0)) { cur.students = st; cur.sYr = yr; }
    }
    const wanted = countries?.length ? new Set(countries.map((c) => c.toUpperCase())) : null;
    const byCountry = new Map();
    for (const [id, { r, yr, students }] of latest) {
      let cc = String(pick(r, [/BAS\.COUNTRY(CODE)?$/i, /COUNTRY(CODE)?$/i]) || '').toUpperCase().slice(0, 2); cc = ETER_CC[cc] || cc;
      if (!/^[A-Z]{2}$/.test(cc) || (wanted && !wanted.has(cc))) continue;
      (byCountry.get(cc) || byCountry.set(cc, []).get(cc)).push({ id, r, yr, students });
    }
    const { data: ctry } = await supabase.from('countries').select('code, name, currency_code').in('code', [...byCountry.keys()]);
    const cname = Object.fromEntries((ctry || []).map((c) => [c.code, c]));

    let matched = 0, created = 0, skipped = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const [cc, items] of byCountry) {
      const idx = await collegeIndex(cc);
      for (const { id, r, yr, students } of items) {
        try {
        const nameEn = pick(r, [/INSTNAMEENGL/i, /NAME_?EN/i]); const nameLocal = pick(r, [/INSTNAME$/i, /\.NAME$/i]);
        const name = nameEn || nameLocal; if (!name) { skipped++; continue; }
        const website = url(pick(r, [/WEBSITE/i, /\.URL$/i]));
        const lat = Number(pick(r, [/COORDLAT$/i, /LATITUDE$/i])) || null; const lng = Number(pick(r, [/COORDLON$/i, /LONGITUDE$/i])) || null;
        const founded = Number(pick(r, [/BAS\.FOUNDYEAR$/i, /^FOUNDYEAR$/i])) || null;
        // ETER legal status: 0 public, 1 private government-dependent, 2 private independent
        const legalCode = String(pick(r, [/LEGALSTAT$/i]) ?? '');
        const legal = { 0: 'public', 1: 'private, government-dependent', 2: 'private, independent' }[legalCode] || null;
        const type = legalCode === '0' ? 'Public' : legalCode === '1' || legalCode === '2' ? 'Private' : null;
        const category = pick(r, [/INSTCATENGL/i, /INSTCAT/i, /CATEGORY/i]);
        const cityName = pick(r, [/GEO\.CITY$/i]);
        const facts = { eter_id: id, year: yr || null, category: category || null, legal_status: legal || null, students: students || null,
          source: `Data source: ETER project. Download date ${today}` };
        const c = idx.find({ website, names: [nameEn, nameLocal] });
        if (c) {
          await fillCollege(c, { website, latitude: lat, longitude: lng, established: founded, type, students_count: students }, 'eter', facts);
          if (!c.city || c.city === 'Not specified' || (c.source === 'eter' && cityName && c.city !== cityName)) { const near = (await cityByName(cc, cityName)) || (lat != null && !c.city ? await nearest(lat, lng) : null); if (near) await supabase.from('colleges').update({ city: near.name, state: near.admin1, city_geoname_id: near.geoname_id, ...(c.source !== 'admin' ? { is_published: true } : {}) }).eq('id', c.id); }
          matched++;
        } else {
          if (dryRun) continue;
          const ok = await createCollege({ source: 'eter', external_id: String(id), name, country: cname[cc]?.name || cc, country_code: cc, website, latitude: lat, longitude: lng,
            established: founded, type, students_count: students, factsKey: 'eter', facts, currency: cname[cc]?.currency_code || null, cityName });
          if (ok) created++; else skipped++;
        }
        } catch (e) { skipped++; log(`${cc} ${id}: ${e.message}`); }
      }
      log(`${cc}: ${items.length} institutions`);
    }
    const res = { institutions: latest.size, countries: byCountry.size, matched, created, skipped };
    await finishRun(runId, { status: 'done', inserted: created, updated: matched, skipped, message: JSON.stringify(res) });
    log(`Done: ${JSON.stringify(res)}`);
    return res;
  } catch (e) {
    await finishRun(runId, { status: 'failed', message: e.message });
    throw e;
  }
}
