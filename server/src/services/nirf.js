import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { supabase } from '../supabase.js';
import { normName } from './collegeUpsert.js';

// NIRF India Rankings 2022–2025 (Ministry of Education), extracted from the official reports into
// server/data/nirf/nirf_rankings_2022_2025.csv (year, category, name, city, state, rank).
// Import: every row → ranking_lists (public /rankings page); rows matched to a college → college_rankings (college pages)
// and colleges.ranking (latest Overall rank, else best latest category rank) for sorting.
const here = path.dirname(fileURLToPath(import.meta.url));
export const NIRF_CSV = path.resolve(here, '../../data/nirf/nirf_rankings_2022_2025.csv');
const SOURCE_URL = (y) => `https://www.nirfindia.org/Rankings/${y}/Ranking.html`;

const STOP = new Set(['the', 'of', 'and', 'for', 'in', 'at', 'a', 'to', 'deemed', 'be', 'university', 'universities', 'institute', 'college', 'technology', 'sciences', 'science', 'education', 'research']);
const tokens = (s) => normName(String(s || '').replace(/\b([A-Za-z])\.\s?(?=[A-Za-z]\b|[A-Za-z]\.)/g, '$1').replace(/\b([A-Za-z])\.(?=\s|$)/g, '$1')).replace(/\b(deemed to be|deemed-to-be)\b/g, ' ').split(/\s+/).filter((w) => w.length > 1);
const sig = (s) => tokens(s).filter((w) => !STOP.has(w));
const lev1 = (a, b) => {                  // edit distance ≤ 1 (spelling slips: "Milla" / "Millia")
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || a.length < 5) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
};
const clean = (s) => String(s || '').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
const stateKey = (s) => normName(s).replace(/\b(state|of)\b/g, '').replace(/\s+/g, '').replace('pondicherry', 'puducherry').replace('orissa', 'odisha');

async function indianColleges() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('colleges').select('id, name, short_name, city, state, facts').eq('country_code', 'IN').order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function nirfMatcher(given = null) {
  const cols = given || await indianColleges();
  const exact = new Map(); const byTok = new Map();
  for (const c of cols) {
    for (const n of [c.name, c.short_name, `${c.name} ${c.city || ''}`, clean(c.name)]) if (n) { const k = tokens(n).join(' '); if (k && !exact.has(k)) exact.set(k, c); }
    c._sig = sig(c.name); c._st = stateKey(c.state); c._city = normName(c.city || '');
    for (const t of new Set(c._sig)) (byTok.get(t) || byTok.set(t, []).get(t)).push(c);
  }
  return ({ name, city, state }) => {
    const variants = [name, clean(name), `${name} ${city || ''}`, `${clean(name)} ${city || ''}`, String(name).split(',')[0]];
    for (const v of variants) { const hit = exact.get(tokens(v).join(' ')); if (hit && (!hit._st || !state || hit._st === stateKey(state) || !String(v).includes(','))) return hit; }
    // fuzzy: same significant words (allowing one-letter slips), same state; city words in the NIRF name may be missing in ours
    const want = sig(clean(name)).filter((w) => w !== normName(city || '')); if (!want.length) return null;
    const rare = [...want].sort((a, b) => (byTok.get(a)?.length || 1e9) - (byTok.get(b)?.length || 1e9))[0];
    const pool = new Set([...(byTok.get(rare) || [])]);
    if (pool.size < 3) for (const [t, list] of byTok) if (lev1(t, rare)) list.forEach((c) => pool.add(c));
    let best = null; let bestScore = 0;
    for (const c of pool) {
      if (state && c._st && c._st !== stateKey(state)) continue;
      const have = c._sig.filter((w) => w !== c._city);
      const hit = want.filter((w) => have.some((h) => lev1(w, h))).length;
      const score = hit / Math.max(want.length, have.length || 1);
      const cityOk = !city || !c._city || c._city === normName(city) || normName(c.name).includes(normName(city));
      const bonus = (cityOk ? 0.05 : -0.2) + (c.facts?.institution === 'University' || /universit/i.test(c.name) ? 0.01 : 0);
      if (score + bonus > bestScore) { bestScore = score + bonus; best = c; }
    }
    return bestScore >= 0.85 ? best : null;
  };
}

export async function importNirf({ file = NIRF_CSV, startedBy = null, log = () => {} } = {}) {
  const rows = parse(fs.readFileSync(file), { columns: true, skip_empty_lines: true, bom: true });
  const { data: run } = await supabase.from('import_runs').insert({ kind: 'nirf', params: { file: path.basename(file), rows: rows.length }, started_by: startedBy }).select('id').single();
  const finish = (patch) => run && supabase.from('import_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', run.id);
  try {
    const match = await nirfMatcher();
    log(`${rows.length} ranking rows; matching to colleges…`);
    const list = []; const ranks = []; const unmatched = new Map(); const cache = new Map();
    for (const r of rows) {
      const k = `${r.name}|${r.city}|${r.state}`;
      if (!cache.has(k)) cache.set(k, match(r));
      const c = cache.get(k);
      const rank = /^\d+$/.test(String(r.rank).trim()) ? Number(r.rank) : null;
      const year = Number(r.year);
      list.push({ source: 'NIRF', year, category: r.category, rank, rank_band: rank ? null : r.rank || null, name: r.name, city: r.city || null, state: r.state || null, college_id: c?.id || null, source_url: SOURCE_URL(year) });
      if (c) ranks.push({ college_id: c.id, source: 'NIRF', year, category: r.category, rank, rank_band: rank ? null : r.rank || null, score: null, source_url: SOURCE_URL(year) });
      else unmatched.set(r.name, (unmatched.get(r.name) || 0) + 1);
    }
    // de-duplicate (same institution listed twice in one table by the source → keep the better rank)
    const dedupe = (arr, keyf) => { const m = new Map(); for (const x of arr) { const k = keyf(x); const o = m.get(k); if (!o || (x.rank || 1e9) < (o.rank || 1e9)) m.set(k, x); } return [...m.values()]; };
    const L = dedupe(list, (x) => `${x.year}|${x.category}|${x.name}|${x.city}`);
    const R = dedupe(ranks, (x) => `${x.college_id}|${x.year}|${x.category}`);
    for (let i = 0; i < L.length; i += 500) {
      const { error } = await supabase.from('ranking_lists').upsert(L.slice(i, i + 500), { onConflict: 'source,year,category,name,city' });
      if (error) throw new Error(`ranking_lists: ${error.message}`);
    }
    for (let i = 0; i < R.length; i += 500) {
      const { error } = await supabase.from('college_rankings').upsert(R.slice(i, i + 500), { onConflict: 'college_id,source,year,category' });
      if (error) throw new Error(`college_rankings: ${error.message}`);
    }
    // colleges.ranking = latest Overall rank, otherwise best category rank of the latest year
    const latest = Math.max(...R.map((x) => x.year));
    const best = new Map();
    for (const x of R.filter((y) => y.year === latest && y.rank)) {
      const cur = best.get(x.college_id);
      const pri = x.category === 'Overall' ? 0 : 1;
      if (!cur || pri < cur.pri || (pri === cur.pri && x.rank < cur.rank)) best.set(x.college_id, { rank: x.rank, pri });
    }
    let n = 0;
    for (const [id, b] of best) { await supabase.from('colleges').update({ ranking: b.rank }).eq('id', id); if (++n % 100 === 0) log(`ranking set for ${n} colleges`); }
    const institutions = new Set(rows.map((r) => r.name)).size;
    const res = { rows: rows.length, institutions, matched_institutions: institutions - unmatched.size, unmatched: [...unmatched.keys()].sort() };
    await finish({ status: 'done', inserted: R.length, updated: best.size, skipped: unmatched.size, message: `${res.matched_institutions} of ${institutions} institutions matched; ${R.length} college rankings saved` });
    log(`Done: ${res.matched_institutions} / ${institutions} institutions matched`);
    return res;
  } catch (e) { await finish({ status: 'failed', message: e.message }); throw e; }
}
