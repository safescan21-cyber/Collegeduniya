#!/usr/bin/env node
// Import countries + cities / towns / villages from GeoNames (CC BY 4.0 — credit "GeoNames" on your site),
// optionally with each place's name in every site language (पुणे, புனே, Пуна, 浦那 …).
//
// Whole world (by population):
//   npm run import:cities                          → population > 15,000  (~33k places, recommended start)
//   npm run import:cities -- cities5000            → > 5,000   (~68k)
//   npm run import:cities -- cities1000            → > 1,000   (~165k)
//   npm run import:cities -- cities500             → > 500     (~230k, "every town")
//
// EVERY populated place in a country — cities, towns and villages (feature class P):
//   npm run import:cities -- IN                    → all of India (~500k+ places incl. villages)
//   npm run import:cities -- IN --min-pop 1        → only places with a known population
//   npm run import:cities -- IN,NP,BD,LK           → several countries
//
// Add local-language names (recommended):  … --names
//   e.g.  npm run import:cities -- IN --names      → Hindi, Tamil, Bengali … names for Indian places
//         npm run import:cities -- cities15000 --names   (downloads the 600 MB world name file — slow)
//
// Safe to re-run: upserts by GeoNames id and never changes a city's existing URL (slug).
import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import yauzl from 'yauzl';
import { supabase } from '../src/supabase.js';
import { USER_AGENT } from '../src/services/http.js';
import { LANGUAGES } from '../src/services/translate.js';
import { slugify } from '../src/schemas.js';

const BASE = process.env.GEONAMES_DUMP_URL || 'https://download.geonames.org/export/dump';
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const target = (args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--min-pop') || 'cities15000').replace(/\.zip$/, '');
const WORLD = /^cities(500|1000|5000|15000)$/.test(target);
const COUNTRIES = WORLD ? [] : target.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean);
if (!WORLD && !COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c))) {
  console.error('Use cities500 | cities1000 | cities5000 | cities15000, or country codes like IN or IN,NP,BD'); process.exit(1);
}
const MIN_POP = Number(opt('--min-pop', WORLD ? 0 : 0)) || 0;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'geonames-'));

// ---------------------------------------------------------------- helpers
async function download(name) {
  const file = path.join(TMP, name.replace(/\//g, '_'));
  if (fs.existsSync(file)) return file;
  process.stdout.write(`Downloading ${name} … `);
  const res = await fetch(`${BASE}/${name}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file));
  console.log(`${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
  return file;
}
const textLines = (file) => fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));

// Stream the lines of one .txt inside a zip without loading it into memory
function zipLines(zipFile, entryName, onLine) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFile, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      let found = false;
      zip.on('entry', (entry) => {
        if (entry.fileName !== entryName) return zip.readEntry();
        found = true;
        zip.openReadStream(entry, async (e2, stream) => {
          if (e2) return reject(e2);
          const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
          try { for await (const line of rl) if (line && !line.startsWith('#')) await onLine(line); zip.close(); resolve(); }
          catch (e) { reject(e); }
        });
      });
      zip.on('end', () => { if (!found) reject(new Error(`${entryName} not found in ${path.basename(zipFile)}`)); });
      zip.readEntry();
    });
  });
}

async function upsert(table, rows, onConflict, ignoreDuplicates = false) {
  if (!rows.length) return;
  for (let attempt = 0; ; attempt++) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict, ignoreDuplicates });
    if (!error) return;
    if (attempt >= 3) throw new Error(`${table}: ${error.message}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
}

// ---------------------------------------------------------------- 1. countries + admin names
const countries = textLines(await download('countryInfo.txt')).map((l) => {
  const c = l.split('\t');
  return { code: c[0], name: c[4], capital: c[5] || null, population: Number(c[7]) || null, continent: c[8] || null, currency_code: c[10] || null, languages: c[15] || null };
});
await upsert('countries', countries, 'code');
console.log(`countries: ${countries.length}`);
const countryName = new Map(countries.map((c) => [c.code, c.name]));
const admin1 = new Map(textLines(await download('admin1CodesASCII.txt')).map((l) => { const c = l.split('\t'); return [c[0], c[1]]; }));
const admin2 = new Map(textLines(await download('admin2Codes.txt')).map((l) => { const c = l.split('\t'); return [c[0], c[1]]; }));

// ---------------------------------------------------------------- 2. existing slugs (never change a live URL)
const ownerOfSlug = new Map();   // slug → geoname_id
const slugOf = new Map();        // geoname_id → slug
let hasAdmin2 = true;
for (const cc of WORLD ? [null] : COUNTRIES) {
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('cities').select('geoname_id, slug').order('geoname_id').range(from, from + 999);
    if (cc) q = q.eq('country_code', cc);
    const { data, error } = await q;
    if (error) throw new Error(`Reading cities: ${error.message}`);
    for (const r of data) { ownerOfSlug.set(r.slug, r.geoname_id); slugOf.set(r.geoname_id, r.slug); }
    if (data.length < 1000) break;
  }
}
{ const { error } = await supabase.from('cities').select('admin2').limit(1); if (error) { hasAdmin2 = false; console.warn('Run supabase/migrations/008_cities_languages.sql to also store districts and local names.'); } }
console.log(`${slugOf.size} places already in the database`);

// ---------------------------------------------------------------- 3. places: two streaming passes
// geonameid, name, asciiname, alternatenames, lat, lng, fclass, fcode, cc, cc2, admin1, admin2, admin3, admin4, population, elevation, dem, timezone, modified
const sources = WORLD ? [[await download(`${target}.zip`), `${target}.txt`]]
  : await Promise.all(COUNTRIES.map(async (cc) => [await download(`${cc}.zip`), `${cc}.txt`]));
const keep = (c) => c[6] === 'P' && (Number(c[14]) || 0) >= MIN_POP && !/^PPL(H|Q|W)$/.test(c[7]);   // skip historical / abandoned / destroyed
const baseSlug = (c) => slugify(`${c[2] || c[1]} ${admin1.get(`${c[8]}.${c[10]}`) || ''} ${c[8]}`);

// pass 1: who gets the plain slug? the most populous place with that name in that state
const best = new Map();   // base slug → [geoname_id, population]
for (const [zip, entry] of sources) {
  await zipLines(zip, entry, (line) => {
    const c = line.split('\t');
    if (!keep(c)) return;
    const gid = Number(c[0]); const pop = Number(c[14]) || 0; const b = baseSlug(c);
    const cur = best.get(b);
    if (!cur || pop > cur[1] || (pop === cur[1] && gid < cur[0])) best.set(b, [gid, pop]);
  });
}
const finalSlug = (gid, b) => {
  if (slugOf.has(gid)) return slugOf.get(gid);
  const owner = ownerOfSlug.get(b);
  if (owner === undefined && best.get(b)?.[0] === gid) return b;
  return `${b}-${gid}`;
};

// pass 2: save in batches of 1,000
const imported = new Set();
let batch = []; let saved = 0;
const flush = async () => { await upsert('cities', batch, 'geoname_id'); saved += batch.length; batch = []; process.stdout.write(`\rcities: ${saved.toLocaleString()} saved`); };
for (const [zip, entry] of sources) {
  await zipLines(zip, entry, async (line) => {
    const c = line.split('\t');
    if (!keep(c)) return;
    const gid = Number(c[0]);
    imported.add(gid);
    batch.push({
      geoname_id: gid, name: c[1], ascii_name: c[2] || c[1], country_code: c[8], country: countryName.get(c[8]) || c[8],
      admin1: admin1.get(`${c[8]}.${c[10]}`) || null,
      ...(hasAdmin2 ? { admin2: admin2.get(`${c[8]}.${c[10]}.${c[11]}`) || null, feature_code: c[7] || null } : {}),
      latitude: Number(c[4]), longitude: Number(c[5]), population: Number(c[14]) || 0, timezone: c[17] || null,
      slug: finalSlug(gid, baseSlug(c)),
    });
    if (batch.length >= 1000) await flush();
  });
}
await flush();
console.log(`\nPlaces done ✓ (${imported.size.toLocaleString()})`);

// ---------------------------------------------------------------- 4. names in every site language
if (flag('--names') && hasAdmin2) {
  const SITE = new Set(LANGUAGES.map(([c]) => c));
  const ALIAS = { zh: 'zh-CN', 'zh-Hans': 'zh-CN', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'zh-Hant': 'zh-TW', iw: 'he', tl: 'fil', fil: 'fil', mni: 'mni-Mtei', jw: 'jv', nb: 'no', nn: 'no', ckb: 'ckb' };
  const toLang = (iso) => ALIAS[iso] || (SITE.has(iso) ? iso : null);
  const files = WORLD ? [[await download('alternateNamesV2.zip'), 'alternateNamesV2.txt']]
    : await Promise.all(COUNTRIES.map(async (cc) => [await download(`alternatenames/${cc}.zip`), `${cc}.txt`]));
  let rows = []; let n = 0;
  const seen = new Set();
  for (const [zip, entry] of files) {
    // alternateNameId, geonameid, isolanguage, alternate name, isPreferredName, isShortName, isColloquial, isHistoric, from, to
    await zipLines(zip, entry, async (line) => {
      const c = line.split('\t');
      const gid = Number(c[1]);
      if (!imported.has(gid) || c[6] === '1' || c[7] === '1') return;
      const lang = toLang(c[2]);
      const name = (c[3] || '').trim();
      if (!lang || lang === 'en' || !name || name.length > 120) return;
      const k = `${gid}|${lang}|${name}`;
      if (seen.has(k)) return;
      seen.add(k);
      rows.push({ geoname_id: gid, lang, name, is_preferred: c[4] === '1' || c[5] === '1' });
      if (rows.length >= 1000) { await upsert('city_names', rows, 'geoname_id,lang,name'); n += rows.length; rows = []; seen.clear(); process.stdout.write(`\rcity names: ${n.toLocaleString()}`); }
    });
  }
  await upsert('city_names', rows, 'geoname_id,lang,name'); n += rows.length;
  console.log(`\rcity names: ${n.toLocaleString()} ✓`);
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log('Done ✓  Credit GeoNames (https://www.geonames.org, CC BY 4.0) on your site.');
