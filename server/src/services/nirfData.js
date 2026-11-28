import zlib from 'node:zlib';
import { supabase } from '../supabase.js';
import { USER_AGENT, throttle } from './http.js';
import { nirfMatcher } from './nirf.js';

// NIRF institution data sheets (nirfindia.org): every ranked institution publishes, per programme group
// (UG 4-year, PG 2-year …), its approved intake and, for three graduating batches, students graduating,
// students placed, median salary and students going on to higher studies. The ranking pages also give
// the NIRF score and its five parameter scores. This importer reads the ranking pages of one year, downloads each
// institution's sheet, and saves: courses (programme + seats), college_placements (3 batches), rank/score.
const BASE = process.env.NIRF_BASE_URL || 'https://www.nirfindia.org';
const PAGES = [
  // discipline lists first: their sheets name the programmes (B.Tech, MBA …)
  ['Engineering', 'EngineeringRanking'], ['Management', 'ManagementRanking'], ['Pharmacy', 'PharmacyRanking'], ['Medical', 'MedicalRanking'],
  ['Dental', 'DentalRanking'], ['Law', 'LawRanking'], ['Architecture & Planning', 'ArchitectureRanking'], ['Agriculture', 'AgricultureRanking'],
  ['Overall', 'OverallRanking'], ['Universities', 'UniversityRanking'], ['Colleges', 'CollegeRanking'], ['Research Institutions', 'ResearchRanking'],
];
const DISCIPLINE = new Set(['Engineering', 'Management', 'Pharmacy', 'Medical', 'Dental', 'Law', 'Architecture & Planning', 'Agriculture']);

async function get(url, binary = false) {
  await throttle('nirf', Number(process.env.NIRF_GAP_MS || 700));
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}

const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- ranking page → rows
export function parseRankingPage(html) {
  const out = [];
  for (const m of html.matchAll(/<tr>\s*<td>\s*(IR-[A-Z]-[A-Z]-\d+)\s*<\/td>([\s\S]*?)<\/tr>\s*(?=<tr>\s*<td>\s*IR-|<\/tbody>\s*<\/table>\s*(?!<\/div>))/g)) {
    const id = m[1]; const rest = m[2];
    const pdf = rest.match(/href="([^"]+\.pdf)"/)?.[1] || null;
    const name = strip(rest.split(/<div/)[0]);
    const params = [...(rest.match(/<tbody>\s*<tr>([\s\S]*?)<\/tr>\s*<\/tbody>/)?.[1] || '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => Number(strip(x[1])));
    const ti = rest.lastIndexOf('</table>');
    const after = ti >= 0 ? rest.slice(ti) : rest.replace(/^\s*<td[^>]*>[\s\S]*?<\/td>/, '');   // drop the name cell when there is no score table
    const tds = [...after.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => strip(x[1])).filter((x) => x !== '');
    // trailing cells: City | State | [Score] | Rank
    const rank = tds[tds.length - 1] || ''; const score = tds.length >= 4 ? Number(tds[tds.length - 2]) : null;
    out.push({ id, name, city: tds[0] || null, state: tds[1] || null, score: Number.isFinite(score) ? score : null,
      rank: /^\d+$/.test(rank) ? Number(rank) : null, band: /^\d+\s*-\s*\d+$/.test(rank) ? rank.replace(/\s/g, '') : null,
      params: params.length === 5 && params.every(Number.isFinite) ? { tlr: params[0], rpc: params[1], go: params[2], oi: params[3], perception: params[4] } : null, pdf });
  }
  return out;
}

// ---------------------------------------------------------------- data sheet PDF → rows of cells
export function pdfRows(buf) {
  const bin = buf.toString('latin1'); const rows = [];
  for (const m of bin.matchAll(/\/Length (\d+)\/Filter\/FlateDecode>>stream\r?\n/g)) {
    const start = m.index + m[0].length;
    let s; try { s = zlib.inflateSync(buf.subarray(start, start + Number(m[1]))).toString('latin1'); } catch { continue; }
    const g = new Map();
    for (const t of s.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm[\s\S]*?\(((?:\\.|[^\\)])*)\)Tj/g)) {
      const y = Math.round(Number(t[2])); if (!g.has(y)) g.set(y, []);
      g.get(y).push({ x: Number(t[1]), t: t[3].replace(/\\(.)/g, '$1') });
    }
    for (const y of [...g.keys()].sort((a, b) => b - a)) rows.push(g.get(y).sort((a, b) => a.x - b.x).map((i) => i.t.trim()));
  }
  return rows;
}

const progKey = (s) => { const m = String(s).match(/^(UG|PG)[^\d]*([\d.]+)\s*Years?(?:\s*(\d+)\s*Months?)?/i); return m ? `${m[1].toUpperCase()}${m[2]}${m[3] ? `.${m[3]}` : ''}` : null; };
const num = (v) => { const m = String(v ?? '').replace(/,/g, '').match(/^\s*(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : null; };
const endYear = (ay) => { const m = String(ay).match(/^(\d{4})-(\d{2})$/); return m ? Number(m[1]) + 1 : null; };

export function parseSheet(rows) {
  const intake = {}; const placements = []; let section = null; let prog = null;
  for (const r of rows) {
    const c0 = r[0] || '';
    if (/^Sanctioned \(Approved\) Intake/i.test(c0)) { section = 'intake'; continue; }
    if (/^Total Actual Student Strength/i.test(c0)) { section = null; continue; }
    if (/Placement & higher studies for previous/i.test(c0)) { section = 'place'; prog = progKey(c0); continue; }
    if (/^(Ph\.?D|Financial Resources|Sponsored Research|PCS Facilities|Faculty Details|Placement & Higher Studies$)/i.test(c0)) { if (!/^Placement & Higher Studies$/i.test(c0)) section = null; continue; }
    if (section === 'intake' && /^(UG|PG)/i.test(c0)) {
      const k = progKey(c0); const seats = r.slice(1).map(num).find((v) => v != null);
      if (k && seats) intake[k] = seats;
    } else if (section === 'place' && prog && /^\d{4}-\d{2}$/.test(c0)) {
      let gi = -1; r.forEach((v, i) => { if (i > 0 && /^\d{4}-\d{2}$/.test(v)) gi = i; });
      if (gi < 0) continue;
      const graduating = num(r[gi + 1]); const placed = num(r[gi + 2]); const median = num(r[gi + 3]); const higher = num(r[gi + 4]);
      if (graduating == null && placed == null) continue;
      placements.push({ prog, year: endYear(r[gi]), graduating, placed, median: median && median >= 10000 ? median : null, higher });
    }
  }
  return { intake, placements };
}

// programme group → course name, by ranking category
const NAMES = {
  Engineering: { UG4: 'B.Tech / B.E.', UG5: 'Dual Degree (B.Tech + M.Tech)', PG2: 'M.Tech / M.E.', PG3: 'MCA / M.Sc (3 years)', UG3: 'B.Sc / B.Voc (3 years)' },
  Management: { PG2: 'MBA / PGDM', PG1: 'Executive MBA (1 year)', UG3: 'BBA / BMS', UG4: 'BBA (4 years)' },
  Pharmacy: { UG4: 'B.Pharm', PG2: 'M.Pharm', UG6: 'Pharm.D', UG3: 'D.Pharm / B.Sc' },
  Medical: { 'UG5.6': 'MBBS', UG5: 'MBBS', PG3: 'MD / MS', PG2: 'PG Diploma / M.Sc (2 years)', UG4: 'B.Sc Nursing / Allied Health' },
  Dental: { UG5: 'BDS', PG3: 'MDS' },
  Law: { UG5: 'Integrated LLB (BA LLB / BBA LLB)', UG3: 'LLB (3 years)', PG1: 'LLM (1 year)', PG2: 'LLM (2 years)' },
  'Architecture & Planning': { UG5: 'B.Arch', UG4: 'B.Plan', PG2: 'M.Arch / M.Plan' },
  Agriculture: { UG4: 'B.Sc (Agriculture)', PG2: 'M.Sc (Agriculture)', PG3: 'PG (3 years)' },
};
export function programmeName(category, key) {
  const n = NAMES[category]?.[key]; if (n) return n;
  const m = key.match(/^(UG|PG)([\d.]+)/); const yrs = m[2].replace('.6', '½').replace(/\.\d+/, '');
  return `${m[1] === 'UG' ? 'Undergraduate' : 'Postgraduate'} programmes (${yrs} years)`;
}
const yearsOf = (key) => { const m = key.match(/^(UG|PG)([\d.]+)/); return m[2] === '5.6' ? '5½ years' : `${Math.round(Number(m[2]))} years`; };

export async function importNirfData({ year = 2025, categories = null, limit = null, startedBy = null, log = () => {} } = {}) {
  const { data: run } = await supabase.from('import_runs').insert({ kind: 'nirf_data', params: { year, categories, limit }, started_by: startedBy }).select('id').single();
  const progress = (patch) => run && supabase.from('import_runs').update(patch).eq('id', run.id);
  const finish = (patch) => progress({ ...patch, finished_at: new Date().toISOString() });
  try {
    const match = await nirfMatcher();
    const done = new Set();          // institution suffix (U-0456) already given named courses by a discipline sheet
    let sheets = 0, matched = 0, courses = 0, placeRows = 0, ranks = 0; const unmatched = []; const errors = [];
    for (const [category, page] of PAGES.filter(([c]) => !categories || categories.includes(c))) {
      let html;
      try { html = await get(`${BASE}/Rankings/${year}/${page}.html`); } catch (e) { errors.push(`${category}: ${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`); log(errors[errors.length - 1]); continue; }
      const list = parseRankingPage(html).slice(0, limit || undefined);
      log(`${category}: ${list.length} institutions`);
      if (!list.length) errors.push(`${category}: page read but no institutions found (${html.length} bytes)`);
      for (const r of list) {
        const c = match({ name: r.name, city: r.city, state: r.state });
        // full list (rank bands included) for the /rankings page
        await supabase.from('ranking_lists').upsert({ source: 'NIRF', year, category, rank: r.rank, rank_band: r.band, name: r.name, city: r.city, state: r.state,
          college_id: c?.id || null, source_url: `${BASE}/Rankings/${year}/${page}.html` }, { onConflict: 'source,year,category,name,city' });
        if (!c) { unmatched.push(`${r.name}, ${r.city}`); continue; }
        matched++;
        await supabase.from('college_rankings').upsert({ college_id: c.id, source: 'NIRF', year, category, rank: r.rank, rank_band: r.band, score: r.score,
          source_url: `${BASE}/Rankings/${year}/${page}.html` }, { onConflict: 'college_id,source,year,category' });
        ranks++;
        if (r.params && category === 'Overall') {
          const { data: cur } = await supabase.from('colleges').select('facts').eq('id', c.id).single();
          await supabase.from('colleges').update({ facts: { ...(cur?.facts || {}), nirf: { year, id: r.id, score: r.score, ...r.params } } }).eq('id', c.id);
        }
        // data sheet
        const suffix = r.id.slice(5);
        const isDiscipline = DISCIPLINE.has(category);
        if (!r.pdf || (!isDiscipline && done.has(suffix))) continue;
        let parsed;
        try { parsed = parseSheet(pdfRows(await get(r.pdf, true))); sheets++; } catch (e) { if (errors.length < 20) errors.push(`${r.id}: ${e.message}`); continue; }
        const keys = new Set([...Object.keys(parsed.intake), ...parsed.placements.map((p) => p.prog)]);
        if (!keys.size) continue;
        const src = `NIRF ${year} — data submitted by the institution (${r.id})`;
        const courseRows = [...keys].map((k) => ({ college_id: c.id, source: 'nirf', external_id: `${isDiscipline ? category : 'all'}|${k}`, name: programmeName(isDiscipline ? category : null, k),
          level: k.startsWith('PG') ? 'PG' : 'UG', duration: yearsOf(k), seats: parsed.intake[k] || null, currency: 'INR', url: null }));
        const { error: ce } = await supabase.from('courses').upsert(courseRows, { onConflict: 'college_id,source,external_id' });
        if (ce) log(`courses ${r.id}: ${ce.message}`); else courses += courseRows.length;
        const pl = parsed.placements.filter((p) => p.year).map((p) => ({ college_id: c.id, year: p.year, course: programmeName(isDiscipline ? category : null, p.prog),
          median_package: p.median, currency: 'INR', package_unit: 'year', students_placed: p.placed,
          placement_rate: p.graduating ? Math.round((1000 * (p.placed || 0)) / p.graduating) / 10 : null, source: src }));
        const dedup = [...new Map(pl.map((x) => [`${x.year}|${x.course}`, x])).values()];
        if (dedup.length) { const { error: pe } = await supabase.from('college_placements').upsert(dedup, { onConflict: 'college_id,year,course' }); if (pe) log(`placements ${r.id}: ${pe.message}`); else placeRows += dedup.length; }
        if (isDiscipline) done.add(suffix);
        if (sheets % 20 === 0) { log(`${sheets} sheets · ${courses} courses · ${placeRows} placement rows`); await progress({ inserted: courses, updated: placeRows }); }
      }
    }
    const res = { year, sheets, matched, ranks, courses, placements: placeRows, unmatched: unmatched.length, unmatched_sample: unmatched.slice(0, 30) };
    await finish({ status: 'done', inserted: courses, updated: placeRows, skipped: unmatched.length, message: `${sheets} NIRF data sheets read · ${courses} courses · ${placeRows} placement rows · ${unmatched.length} institutions not matched${errors.length ? ` · errors: ${errors.slice(0, 5).join(' | ')}` : ''}` });
    log(`Done: ${JSON.stringify(res)}`);
    return res;
  } catch (e) { await finish({ status: 'failed', message: e.message }); throw e; }
}

// ---------------------------------------------------------------- browser-assisted import
// nirfindia.org refuses downloads from hosting servers, so an admin's browser fetches each ranking row's data sheet
// (slowly) and posts it here; reading, matching and saving happen on the server with the same code as above.
let cachedMatch = null; let cachedAt = 0;
async function matcherCached() {
  if (!cachedMatch || Date.now() - cachedAt > 30 * 60e3) { cachedMatch = await nirfMatcher(); cachedAt = Date.now(); }
  return cachedMatch;
}

// While a migration is applied the database API reloads its schema for a few seconds ("Could not query the database for
// the schema cache"). Wait and try again instead of losing that institution's data.
async function retryReload(op, tries = 4) {
  let r;
  for (let i = 0; i < tries; i++) {
    r = await op();
    if (!r.error || !/schema cache|PGRST002/i.test(`${r.error.code || ''} ${r.error.message || ''}`)) return r;
    await new Promise((ok) => setTimeout(ok, 3000 * (i + 1)));
  }
  return r;
}

export async function importNirfSheet({ year, category, pageUrl, row, pdfBase64 }) {
  const r = row || {};
  if (!/^IR-[A-Z]-[A-Z]-\d+$/.test(String(r.id || ''))) throw Object.assign(new Error('Bad institute id'), { status: 400 });
  if (!PAGES.some(([c]) => c === category)) throw Object.assign(new Error('Unknown category'), { status: 400 });
  const match = await matcherCached();
  const c = match({ name: r.name, city: r.city, state: r.state });
  const rank = Number.isInteger(r.rank) ? r.rank : null; const band = r.band && /^\d+-\d+$/.test(r.band) ? r.band : null;
  const score = Number.isFinite(r.score) ? r.score : null;
  await supabase.from('ranking_lists').upsert({ source: 'NIRF', year, category, rank, rank_band: band, name: String(r.name).slice(0, 300), city: r.city || null, state: r.state || null,
    college_id: c?.id || null, source_url: pageUrl || null }, { onConflict: 'source,year,category,name,city' });
  if (!c) return { matched: false };
  await supabase.from('college_rankings').upsert({ college_id: c.id, source: 'NIRF', year, category, rank, rank_band: band, score, source_url: pageUrl || null }, { onConflict: 'college_id,source,year,category' });
  const p = r.params;
  if (p && category === 'Overall' && ['tlr', 'rpc', 'go', 'oi', 'perception'].every((k) => Number.isFinite(p[k]))) {
    const { data: cur } = await supabase.from('colleges').select('facts').eq('id', c.id).single();
    await supabase.from('colleges').update({ facts: { ...(cur?.facts || {}), nirf: { year, id: r.id, score, tlr: p.tlr, rpc: p.rpc, go: p.go, oi: p.oi, perception: p.perception } } }).eq('id', c.id);
  }
  if (!pdfBase64) return { matched: true, college: c.name };
  const isDiscipline = DISCIPLINE.has(category);
  if (!isDiscipline) {   // general lists: skip when a discipline sheet already named this college's programmes
    const { count } = await supabase.from('courses').select('id', { count: 'exact', head: true }).eq('college_id', c.id).eq('source', 'nirf').not('external_id', 'like', 'all|%');
    if (count) return { matched: true, college: c.name, skipped: 'programmes already named' };
  }
  const parsed = parseSheet(pdfRows(Buffer.from(String(pdfBase64), 'base64')));
  const keys = new Set([...Object.keys(parsed.intake), ...parsed.placements.map((x) => x.prog)]);
  const src = `NIRF ${year} — data submitted by the institution (${r.id})`;
  const courseRows = [...keys].map((k) => ({ college_id: c.id, source: 'nirf', external_id: `${isDiscipline ? category : 'all'}|${k}`, name: programmeName(isDiscipline ? category : null, k),
    level: k.startsWith('PG') ? 'PG' : 'UG', duration: yearsOf(k), seats: parsed.intake[k] || null, currency: 'INR', url: null }));
  if (courseRows.length) { const { error } = await retryReload(() => supabase.from('courses').upsert(courseRows, { onConflict: 'college_id,source,external_id' })); if (error) throw new Error(`courses: ${error.message}`); }
  const pl = parsed.placements.filter((x) => x.year).map((x) => ({ college_id: c.id, year: x.year, course: programmeName(isDiscipline ? category : null, x.prog),
    median_package: x.median, currency: 'INR', package_unit: 'year', students_placed: x.placed,
    placement_rate: x.graduating ? Math.round((1000 * (x.placed || 0)) / x.graduating) / 10 : null, source: src }));
  const dedup = [...new Map(pl.map((x) => [`${x.year}|${x.course}`, x])).values()];
  if (dedup.length) { const { error } = await retryReload(() => supabase.from('college_placements').upsert(dedup, { onConflict: 'college_id,year,course' })); if (error) throw new Error(`placements: ${error.message}`); }
  return { matched: true, college: c.name, courses: courseRows.length, placements: dedup.length };
}
