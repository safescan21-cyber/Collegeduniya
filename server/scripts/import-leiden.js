#!/usr/bin/env node
// CWTS Leiden Ranking Open Edition (world research ranking, CC0) → /rankings and college pages.
//   nice -n 19 node scripts/import-leiden.js [--year=2025]      (Admin → Import → World ranking starts this for you)
import 'dotenv/config';
import { importLeiden } from '../src/services/leiden.js';
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
try {
  const r = await importLeiden({ year: Number(arg('year') || 2025), startedBy: arg('by') || null, keepFile: process.argv.includes('--keep'), log: (m) => console.log(`[leiden ${new Date().toISOString()}] ${m}`) });
  console.log(r);
  process.exit(0);
} catch (e) { console.error('[leiden] failed:', e.message); process.exit(1); }
