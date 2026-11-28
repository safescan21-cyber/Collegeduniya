import ExcelJS from 'exceljs';
import { supabase } from '../supabase.js';
import { fetchBuf, collegeIndex, fillCollege, createCollege, startRun, finishRun, cityByName } from './europe.js';
import { fetchJson } from './http.js';

// Australia — CRICOS (Commonwealth Register of Institutions and Courses for Overseas Students), Department of Education.
// The official list of every provider and course open to international students, with tuition fees.
// Licence: Creative Commons Attribution 2.5 Australia — credit "Source: CRICOS, Australian Government Department of Education".
// Monthly snapshot on data.gov.au; this import takes the newest one (or an uploaded .xlsx).
//  • providers that teach degree-level courses are matched to existing Australian colleges (website / name) or added
//  • their courses (Bachelor, Masters, Doctoral, Graduate Certificate/Diploma, Associate Degree, (Advanced) Diploma)
//    are saved with duration and fees: CRICOS gives the TOTAL tuition for the whole course → we store fees per year
//    (total ÷ years) and keep the total in the eligibility note. Expired courses are skipped.

export const CRICOS_SOURCE = 'CRICOS, Australian Government Department of Education (CC BY 2.5 AU)';
const CKAN = process.env.CRICOS_CKAN_URL || 'https://data.gov.au/data/api/3/action/package_show?id=cricos';
const PAGE = 'https://cricos.education.gov.au/';

// newest "CRICOS Providers, Courses and Locations" xlsx on data.gov.au
export async function latestCricosUrl() {
  if (process.env.CRICOS_URL) return { url: process.env.CRICOS_URL, name: 'CRICOS_URL' };
  const j = await fetchJson(CKAN, { timeoutMs: 60000 });
  const res = (j?.result?.resources || []).filter((r) => /xlsx/i.test(r.format || r.url || '') && /provider/i.test(r.name || '') && /course/i.test(r.name || ''));
  if (!res.length) throw new Error('No CRICOS xlsx found on data.gov.au — download it from data.gov.au/dataset/cricos and upload it in Admin → Import');
  const when = (r) => { const m = String(r.name || r.url).match(/(20\d\d)-(\d{1,2})-(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : String(r.last_modified || r.created || ''); };
  res.sort((a, b) => when(b).localeCompare(when(a)));
  return { url: res[0].url, name: res[0].name, date: when(res[0]) };
}

const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') { if (v.text) return String(v.text); if (v.result != null) return String(v.result); if (v.richText) return v.richText.map((t) => t.text).join(''); if (v.hyperlink) return String(v.hyperlink); }
  return String(v).trim();
};
const num = (v) => { const n = Number(String(v ?? '').replace(/[$,\s]/g, '')); return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null; };

// every worksheet → rows keyed by header (header = first row that mentions "Provider Code")
export async function readCricos(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheets = {};
  for (const ws of wb.worksheets) {
    const matrix = [];
    ws.eachRow({ includeEmpty: false }, (row) => matrix.push(row.values.slice(1).map(text)));
    const h = matrix.findIndex((r) => r.some((c) => /provider code/i.test(c)));
    if (h < 0) continue;
    const headers = matrix[h].map((x) => x.trim());
    sheets[ws.name] = matrix.slice(h + 1).filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(headers.map((k, i) => [k, r[i] ?? ''])));
  }
  return sheets;
}

// find the column whose header matches, tolerant of the small wording changes between snapshots
const col = (headers, ...res) => { for (const re of res) { const h = headers.find((x) => re.test(x)); if (h) return h; } return null; };
const findSheet = (sheets, re, need) => Object.entries(sheets).find(([n, rows]) => re.test(n) && rows.length && need.every((r) => Object.keys(rows[0]).some((h) => r.test(h))))?.[1] || [];

const LEVEL = [
  [/doctor/i, 'PhD', true], [/master/i, 'PG', true], [/graduate (certificate|diploma)/i, 'PG', true],
  [/bachelor/i, 'UG', true], [/associate degree/i, 'UG', false], [/advanced diploma/i, 'Diploma', false], [/^diploma|\bdiploma\b/i, 'Diploma', false],
];
const levelOf = (s) => { for (const [re, lvl, degree] of LEVEL) if (re.test(s || '')) return { level: lvl, degree }; return null; };
const years = (weeks) => (weeks && weeks >= 40 ? Math.max(1, Math.round((weeks / 52) * 2) / 2) : null);

export async function importCricos({ buffer = null, dryRun = false, startedBy = null, log = () => {} } = {}) {
  const runId = dryRun ? null : await startRun('cricos', {}, startedBy);
  try {
    let buf = buffer; let snapshot = 'upload';
    if (!buf) { const l = await latestCricosUrl(); snapshot = l.date || l.name; log(`Downloading ${l.name} …`); buf = await fetchBuf(l.url, { timeoutMs: 300000 }); }
    log(`File: ${(buf.length / 1048576).toFixed(1)} MB`);
    const sheets = await readCricos(buf);
    log(`Sheets: ${Object.entries(sheets).map(([n, r]) => `${n} (${r.length})`).join(', ')}`);
    const inst = findSheet(sheets, /institution|provider/i, [/provider code/i, /name/i]);
    const courses = findSheet(sheets, /course/i, [/course code/i, /course name/i]);
    const locs = findSheet(sheets, /^locations?$/i, [/provider code/i]);
    if (!inst.length || !courses.length) throw new Error(`Could not find the Institutions and Courses sheets (found: ${Object.keys(sheets).join(', ') || 'none'})`);
    const iH = Object.keys(inst[0]); const cH = Object.keys(courses[0]); const lH = locs.length ? Object.keys(locs[0]) : [];
    const I = { code: col(iH, /provider code/i), name: col(iH, /^institution name/i, /trading name/i, /name/i), trading: col(iH, /trading name/i), type: col(iH, /institution type|provider type/i), web: col(iH, /web/i), city: col(iH, /postal.*city/i, /\bcity\b|suburb/i), state: col(iH, /postal address state|state/i) };
    const C = { code: col(cH, /provider code/i), ccode: col(cH, /course code/i), name: col(cH, /course name/i), level: col(cH, /course level/i), weeks: col(cH, /duration.*week/i, /duration/i),
      tuition: col(cH, /^tuition fee/i, /tuition/i), nontuition: col(cH, /non.?tuition/i), total: col(cH, /estimated.*total|total.*cost/i), expired: col(cH, /expired/i), field: col(cH, /broad field/i, /field of education/i), lang: col(cH, /language/i) };
    const L = { code: col(lH, /provider code/i), city: col(lH, /^city|suburb|town/i), state: col(lH, /state/i), type: col(lH, /location type/i) };
    log(`Columns — institutions: ${JSON.stringify(I)} · courses: ${JSON.stringify(C)}`);
    if (!C.code || !C.ccode || !C.name || !C.level) throw new Error('Courses sheet: provider code / course code / course name / course level column not found');

    // degree-level courses per provider (expired ones skipped)
    const byProv = new Map();
    for (const r of courses) {
      if (C.expired && /^y(es)?$/i.test(r[C.expired])) continue;
      const lv = levelOf(r[C.level]); if (!lv) continue;
      const k = r[C.code]; (byProv.get(k) || byProv.set(k, []).get(k)).push({ r, ...lv });
    }
    const mainCity = new Map();
    for (const l of locs) { const k = l[L.code]; if (k && !mainCity.has(k) && l[L.city]) mainCity.set(k, { city: l[L.city], state: l[L.state] }); }
    const provs = inst.filter((p) => byProv.has(p[I.code]) && byProv.get(p[I.code]).some((c) => c.degree));
    log(`${inst.length} providers, ${courses.length} courses → ${provs.length} providers teach degree courses`);
    if (dryRun) return { dryRun: true, providers: provs.length, sample: provs.slice(0, 5).map((p) => p[I.name]) };

    const idx = await collegeIndex('AU');
    let matched = 0, created = 0, saved = 0;
    for (const p of provs) {
      const code = p[I.code]; const name = p[I.trading] || p[I.name];
      const website = p[I.web] ? (/^https?:/i.test(p[I.web]) ? p[I.web] : `https://${p[I.web]}`) : null;
      const list = byProv.get(code);
      const facts = { provider_code: code, source: CRICOS_SOURCE, snapshot, courses: list.length, type: p[I.type] || null };
      let c = idx.find({ website, names: [p[I.trading], p[I.name]] });
      let id;
      if (c) { await fillCollege(c, { website, currency: 'AUD' }, 'cricos', facts); id = c.id; matched++; }
      else {
        const city = mainCity.get(code)?.city || p[I.city];
        id = await createCollege({ source: 'cricos', external_id: code, name, country: 'Australia', country_code: 'AU', website, factsKey: 'cricos', facts, currency: 'AUD',
          type: /government|public/i.test(p[I.type] || '') ? 'Public' : 'Private', cityName: city });
        if (!id) continue; created++;
        if (!(await cityByName('AU', city))) log(`${name}: city "${city}" not found — college saved unpublished, set its city in Admin`);
      }
      const rows = list.map(({ r, level }) => {
        const weeks = num(r[C.weeks]); const y = years(weeks); const tuition = num(r[C.tuition]); const total = num(r[C.total]);
        const perYear = tuition != null ? Math.round(y ? tuition / y : tuition) : null;
        const notes = [tuition != null ? `Total tuition A$${tuition.toLocaleString('en-AU')}` : null, total != null && total !== tuition ? `estimated total cost A$${total.toLocaleString('en-AU')}` : null,
          r[C.field] ? r[C.field] : null, r[C.lang] && !/english/i.test(r[C.lang]) ? `taught in ${r[C.lang]}` : null, `CRICOS ${r[C.ccode]}`].filter(Boolean).join(' · ');
        return { college_id: id, source: 'cricos', external_id: String(r[C.ccode]), name: String(r[C.name]).slice(0, 200), level,
          duration: y ? `${y} year${y === 1 ? '' : 's'}` : weeks ? `${weeks} weeks` : null, fees: perYear, currency: 'AUD', eligibility: notes.slice(0, 500), study_mode: 'Full-time' };
      });
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('courses').upsert(rows.slice(i, i + 500), { onConflict: 'college_id,source,external_id' });
        if (error) throw new Error(`courses: ${error.message}`);
      }
      // the college's fee range from its courses (only fills empty values)
      const fees = rows.map((x) => x.fees).filter((f) => f > 0).sort((a, b) => a - b);
      if (fees.length) await supabase.from('colleges').update({ fees_min: fees[0], fees_max: fees[fees.length - 1] }).eq('id', id).is('fees_min', null);
      saved += rows.length;
      if ((matched + created) % 20 === 0) log(`${matched + created}/${provs.length} providers · ${saved} courses`);
    }
    const res = { snapshot, providers: provs.length, matched, created, courses: saved };
    await finishRun(runId, { status: 'done', inserted: created, updated: matched, message: JSON.stringify(res) });
    log(`Done: ${JSON.stringify(res)}`);
    return res;
  } catch (e) {
    await finishRun(runId, { status: 'failed', message: e.message });
    throw e;
  }
}

// once a month, take the newest snapshot (fees change every year)
export async function cricosDue() {
  const { data } = await supabase.from('import_runs').select('created_at').eq('kind', 'cricos').in('status', ['done', 'running']).order('created_at', { ascending: false }).limit(1);
  return !data?.[0] || Date.now() - Date.parse(data[0].created_at) > 30 * 86400e3;
}
export const CRICOS_PAGE = PAGE;
