#!/usr/bin/env node
// Import every U.S. college from the federal College Scorecard (tuition, size, admission rate).
//   npm run import:us        (needs COLLEGE_SCORECARD_API_KEY in .env — free at https://api.data.gov/signup/)
import 'dotenv/config';
import { importScorecard } from '../src/services/scorecard.js';

try {
  const r = await importScorecard({ log: (m) => process.stdout.write(`\r${m}        `) });
  console.log(`\nDone: ${r.inserted} new · ${r.updated} refreshed · ${r.skipped} kept as admin-edited`);
} catch (e) {
  console.error(`\n${e.message}`); process.exit(1);
}
