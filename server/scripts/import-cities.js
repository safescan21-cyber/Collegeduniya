#!/usr/bin/env node
// Import world countries + cities from GeoNames (CC BY 4.0 — credit "GeoNames" on your site).
//
//   npm run import:cities                 → cities with population > 15,000  (~25k rows, recommended)
//   npm run import:cities -- cities5000   → > 5,000   (~50k rows)
//   npm run import:cities -- cities1000   → > 1,000   (~130k rows)
//   npm run import:cities -- cities500    → > 500     (~185k rows, "every town")
//
// Run on your server (or laptop) with server/.env filled in. Safe to re-run (upserts).
import 'dotenv/config';
import AdmZip from 'adm-zip';
import { supabase } from '../src/supabase.js';
import { USER_AGENT } from '../src/services/http.js';
import { slugify } from '../src/schemas.js';

const BASE = 'https://download.geonames.org/export/dump';
const file = (process.argv[2] || 'cities15000').replace(/\.zip$/, '');
if (!/^cities(500|1000|5000|15000)$/.test(file)) { console.error('Use cities500, cities1000, cities5000 or cities15000'); process.exit(1); }

async function download(name) {
  const res = await fetch(`${BASE}/${name}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
const lines = (txt) => txt.split('\n').filter((l) => l && !l.startsWith('#'));

async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 1000), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    process.stdout.write(`\r${table}: ${Math.min(i + 1000, rows.length)} / ${rows.length}`);
  }
  process.stdout.write('\n');
}

console.log('Downloading countryInfo.txt …');
const countries = lines((await download('countryInfo.txt')).toString('utf8')).map((l) => {
  const c = l.split('\t');
  return { code: c[0], name: c[4], capital: c[5] || null, population: Number(c[7]) || null, continent: c[8] || null, currency_code: c[10] || null, languages: c[15] || null };
});
await upsert('countries', countries, 'code');
const countryName = new Map(countries.map((c) => [c.code, c.name]));

console.log('Downloading admin1CodesASCII.txt …');
const admin1 = new Map(lines((await download('admin1CodesASCII.txt')).toString('utf8')).map((l) => { const c = l.split('\t'); return [c[0], c[1]]; }));

console.log(`Downloading ${file}.zip …`);
const zip = new AdmZip(await download(`${file}.zip`));
const txt = zip.getEntry(`${file}.txt`).getData().toString('utf8');

const seen = new Set();
const cities = lines(txt).map((l) => {
  const c = l.split('\t');
  // geonameid, name, asciiname, alternatenames, lat, lng, fclass, fcode, cc, cc2, admin1, admin2, admin3, admin4, population, elevation, dem, timezone, modified
  const region = admin1.get(`${c[8]}.${c[10]}`) || null;
  let slug = slugify(`${c[2] || c[1]} ${region || ''} ${c[8]}`);
  if (seen.has(slug)) slug = `${slug}-${c[0]}`;
  seen.add(slug);
  return {
    geoname_id: Number(c[0]), name: c[1], ascii_name: c[2] || c[1], country_code: c[8], country: countryName.get(c[8]) || c[8],
    admin1: region, latitude: Number(c[4]), longitude: Number(c[5]), population: Number(c[14]) || 0, timezone: c[17] || null, slug,
  };
});
console.log(`Parsed ${cities.length} cities. Saving…`);
await upsert('cities', cities, 'geoname_id');
console.log('Done ✓  Remember to credit GeoNames (https://www.geonames.org) on your site.');
