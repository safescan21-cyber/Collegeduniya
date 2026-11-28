import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ExcelJS from 'exceljs';
import { supabase } from '../supabase.js';
import { collegeIndex, startRun, finishRun } from './europe.js';
import { normName } from './collegeUpsert.js';
import { USER_AGENT } from './http.js';

// World ranking — CWTS Leiden Ranking Open Edition (Leiden University), CC0 public domain, based on OpenAlex.
// A research ranking: universities ordered by scientific publications (field "All sciences", latest period,
// fractional counting — the Leiden default). It says nothing about teaching or fees; pages label it as research.
// The results file is very large (~590 MB for 2025), so it is downloaded to disk and read as a stream in a
// separate low-priority process (scripts/import-leiden.js) — the website and API are not slowed down.

export const LEIDEN = {
  2025: { results: 'https://zenodo.org/records/17473224/files/CWTS%20Leiden%20Ranking%20Open%20Edition%202025%20-%20Results.xlsx?download=1',
    universities: 'https://zenodo.org/records/17473224/files/CWTS%20Leiden%20Ranking%20Open%20Edition%202025%20-%20Universities.xlsx?download=1', doi: 'https://doi.org/10.5281/zenodo.17473224' },
};
export const LEIDEN_CATEGORY = 'World — research output';
const PAGE = 'https://open.leidenranking.com/';
const DIR = process.env.LEIDEN_DIR || path.join(os.tmpdir(), 'leiden');

const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') { if (v.text) return String(v.text); if (v.result != null) return String(v.result); if (v.richText) return v.richText.map((t) => t.text).join(''); }
  return String(v).trim();
};
const num = (v) => { const n = Number(text(v).replace(/,/g, '')); return text(v) !== '' && Number.isFinite(n) ? n : null; };
const col = (headers, ...res) => { for (const re of res) { const i = headers.findIndex((h) => re.test(h)); if (i >= 0) return i; } return -1; };

async function download(url, file, log) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(60 * 60e3) });
  if (!r.ok) throw new Error(`zenodo: HTTP ${r.status}`);
  const size = Number(r.headers.get('content-length') || 0);
  if (size && fs.existsSync(file) && fs.statSync(file).size === size) { log(`${path.basename(file)} already downloaded`); r.body?.cancel?.(); return file; }
  log(`Downloading ${path.basename(file)} (${size ? `${Math.round(size / 1048576)} MB` : 'size unknown'}) …`);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(`${file}.part`));
  fs.renameSync(`${file}.part`, file);
  return file;
}

// stream every worksheet row; onRow(values[]) — first non-empty row with a "university" header is the header row
async function streamRows(file, onHeader, onRow) {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: 'cache', hyperlinks: 'ignore', styles: 'ignore', worksheets: 'emit' });
  for await (const ws of reader) {
    let header = null;
    for await (const row of ws) {
      const vals = (row.values || []).slice(1);
      if (!header) { const h = vals.map(text); if (h.some((x) => /universit/i.test(x))) { header = h; onHeader(h, ws.name); } continue; }
      onRow(vals);
    }
  }
}

export async function importLeiden({ year = 2025, startedBy = null, log = () => {}, keepFile = false } = {}) {
  const src = LEIDEN[year]; if (!src) throw new Error(`No Leiden Open Edition download known for ${year}`);
  const runId = await startRun('leiden', { year }, startedBy);
  const progress = (m) => { log(m); if (runId) supabase.from('import_runs').update({ message: m.slice(0, 300) }).eq('id', runId).then(() => {}, () => {}); };
  try {
    // 1. universities: id → name, country
    const uniFile = await download(src.universities, path.join(DIR, `${year}-universities.xlsx`), progress);
    const unis = new Map(); let U = null;
    await streamRows(uniFile, (h) => { U = { id: col(h, /^university_?id$/i, /\bid\b/i), name: col(h, /^university$/i, /university.?name/i, /^name$/i), full: col(h, /full.?name/i), country: col(h, /country/i) }; },
      (v) => { if (!U) return; const id = text(v[U.id]); if (id) unis.set(id, { name: text(v[U.name]), full: U.full >= 0 ? text(v[U.full]) : '', country: U.country >= 0 ? text(v[U.country]) : '' }); });
    progress(`${unis.size} universities in the ${year} edition`);

    // 2. results: keep "All sciences", fractional counting, every period → pick the latest period afterwards
    const resFile = await download(src.results, path.join(DIR, `${year}-results.xlsx`), progress);
    let R = null; let seen = 0; const best = new Map(); let latest = '';
    progress('Reading the results file (large — this takes a while, at low priority) …');
    await streamRows(resFile, (h) => {
      R = { id: col(h, /^university_?id$/i), name: col(h, /^university$/i, /university.?name/i), country: col(h, /country/i), field: col(h, /field/i), period: col(h, /period|time.?frame/i),
        frac: col(h, /fractional|counting/i), p: col(h, /^p$/i, /^p_?\(?all/i), top10: col(h, /^pp_?top_?10$/i, /pp.?top.?10%?$/i) };
      progress(`Results columns: ${h.slice(0, 14).join(', ')}${h.length > 14 ? '…' : ''}`);
    }, (v) => {
      if (!R || R.p < 0) return;
      if (++seen % 200000 === 0) progress(`${seen.toLocaleString('en')} result rows read · ${best.size} universities so far`);
      const field = R.field >= 0 ? text(v[R.field]) : 'All sciences';
      if (!/all sciences|^all$/i.test(field)) return;
      if (R.frac >= 0) { const f = text(v[R.frac]).toLowerCase(); if (f && !/^(1|true|yes)$/.test(f) && !/fraction/.test(f)) return; }   // TRUE/1 or "Fractional counting"
      const period = R.period >= 0 ? text(v[R.period]) : String(year);
      const id = R.id >= 0 ? text(v[R.id]) : text(v[R.name]);
      const p = num(v[R.p]); if (!id || p == null) return;
      const key = `${id}|${period}`;
      if (!best.has(key)) best.set(key, { id, period, p, top10: R.top10 >= 0 ? num(v[R.top10]) : null, name: R.name >= 0 ? text(v[R.name]) : '', country: R.country >= 0 ? text(v[R.country]) : '' });
      if (period > latest) latest = period;
    });
    if (!R || R.p < 0) throw new Error('Results file: the publications column (P) was not found');
    const rows = [...best.values()].filter((r) => r.period === latest).sort((a, b) => b.p - a.p);
    rows.forEach((r, i) => { r.rank = i + 1; const u = unis.get(r.id) || {}; r.name = u.name || r.name || r.id; r.full = u.full || ''; r.country = u.country || r.country; });
    progress(`${rows.length} universities ranked for ${latest} — matching to colleges …`);

    // 3. match per country and save
    const { data: countries } = await supabase.from('countries').select('code, name');
    const ccOf = (n) => { const s = String(n || '').toLowerCase(); return (countries || []).find((c) => c.name.toLowerCase() === s || c.code.toLowerCase() === s)?.code
      || ({ 'united states of america': 'US', usa: 'US', 'united kingdom of great britain and northern ireland': 'GB', uk: 'GB', 'russian federation': 'RU', 'korea, republic of': 'KR', 'south korea': 'KR', 'iran, islamic republic of': 'IR', 'viet nam': 'VN', 'türkiye': 'TR', turkey: 'TR', czechia: 'CZ', 'hong kong': 'HK', taiwan: 'TW' })[s] || null; };
    const idxBy = new Map(); let matched = 0;
    const list = []; const ranks = [];
    const url = src.doi;
    for (const r of rows) {
      const cc = ccOf(r.country);
      let c = null;
      if (cc) {
        if (!idxBy.has(cc)) idxBy.set(cc, await collegeIndex(cc).catch(() => null));
        c = idxBy.get(cc)?.find({ names: [r.name, r.full, r.name.replace(/\s*\(.*\)$/, '')] }) || null;
      }
      if (c) matched++;
      list.push({ source: 'Leiden', year, category: LEIDEN_CATEGORY, rank: r.rank, rank_band: null, name: r.full || r.name, city: r.country || null, state: null, college_id: c?.id || null, source_url: url });
      if (c) ranks.push({ college_id: c.id, source: 'Leiden', year, category: LEIDEN_CATEGORY, rank: r.rank, rank_band: null, score: r.p, source_url: url });
    }
    const seenC = new Set(); const R2 = ranks.filter((x) => (seenC.has(x.college_id) ? false : seenC.add(x.college_id)));
    for (let i = 0; i < list.length; i += 500) { const { error } = await supabase.from('ranking_lists').upsert(list.slice(i, i + 500), { onConflict: 'source,year,category,name,city' }); if (error) throw new Error(`ranking_lists: ${error.message}`); }
    for (let i = 0; i < R2.length; i += 500) { const { error } = await supabase.from('college_rankings').upsert(R2.slice(i, i + 500), { onConflict: 'college_id,source,year,category' }); if (error) throw new Error(`college_rankings: ${error.message}`); }
    const res = { year, period: latest, ranked: rows.length, matched, unmatched: rows.length - matched };
    await finishRun(runId, { status: 'done', inserted: matched, skipped: rows.length - matched, message: JSON.stringify(res) });
    if (!keepFile) fs.rmSync(resFile, { force: true });
    log(`Done: ${JSON.stringify(res)}`);
    return res;
  } catch (e) {
    await finishRun(runId, { status: 'failed', message: e.message });
    throw e;
  }
}

// started from the admin panel: separate process at the lowest priority, so visitors never notice
export function spawnLeidenImport({ year = 2025, startedBy = null } = {}) {
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/import-leiden.js');
  const args = [script, `--year=${year}`, ...(startedBy ? [`--by=${startedBy}`] : [])];
  const nice = fs.existsSync('/usr/bin/nice') ? ['/usr/bin/nice', ['-n', '19', process.execPath, '--max-old-space-size=1536', ...args]] : [process.execPath, ['--max-old-space-size=1536', ...args]];
  const log = fs.openSync(path.join(os.tmpdir(), 'collegeolo-leiden.log'), 'a');
  const child = spawn(nice[0], nice[1], { cwd: path.resolve(path.dirname(script), '..'), detached: true, stdio: ['ignore', log, log], env: process.env });
  child.unref();
  return { started: true, pid: child.pid, log: path.join(os.tmpdir(), 'collegeolo-leiden.log') };
}
export const LEIDEN_PAGE = PAGE;
