#!/usr/bin/env node
// Europe: ~3,000 higher-education institutions in 36 countries from ETER (European Tertiary Education Register).
//   npm run import:eter                  (all countries)
//   npm run import:eter -- DE FR IT      (some countries)
//   npm run import:eter -- --dry         (show fields, save nothing)
import 'dotenv/config';
import { importEter } from '../src/services/europe.js';

const args = process.argv.slice(2);
const countries = args.filter((a) => !a.startsWith('--'));
try {
  const r = await importEter({ countries: countries.length ? countries : null, dryRun: args.includes('--dry'), log: (m) => console.log(`  ${m}`) });
  console.log(r.sample ? { ...r, sample: Object.fromEntries(Object.entries(r.sample).slice(0, 40)) } : r);
} catch (e) { console.error(e.message); process.exit(1); }
