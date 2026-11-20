#!/usr/bin/env node
// Import colleges/universities from Hipolabs + Wikidata.
//   npm run import:universities -- IN          (one country, ISO code or English name)
//   npm run import:universities -- IN GB US CA
//   npm run import:universities -- --all       (every country in the countries table; takes a while)
//   add --dry to preview without saving
import 'dotenv/config';
import { supabase } from '../src/supabase.js';
import { importCountry } from '../src/services/universities.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
let list = args.filter((a) => !a.startsWith('--'));
if (args.includes('--all')) {
  const { data, error } = await supabase.from('countries').select('code').order('population', { ascending: false });
  if (error) { console.error(error.message); process.exit(1); }
  list = data.map((c) => c.code);
}
if (!list.length) { console.error('Usage: npm run import:universities -- IN [GB US …] | --all [--dry]'); process.exit(1); }

for (const c of list) {
  try {
    const r = await importCountry(c, { dryRun: dry, log: (m) => console.log(`  [${c}] ${m}`) });
    console.log(`${r.country.name}: ${r.total} found · ${r.inserted} new · ${r.updated} refreshed · ${r.skipped} kept as admin-edited`);
    if (dry && r.sample) console.log(r.sample.map((s) => `   - ${s.name} (${s.city})`).join('\n'));
  } catch (e) {
    console.error(`${c}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 1500)); // be polite to Wikidata
}
