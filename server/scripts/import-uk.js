#!/usr/bin/env node
// UK: every provider + undergraduate courses, graduate salaries, % in work/study, NSS satisfaction
// from the official Discover Uni dataset (HESA, CC BY 4.0).
//   npm run import:uk                    (downloads the latest zip from hesa.ac.uk)
//   npm run import:uk -- path/to/file.zip
//   npm run import:uk -- --dry           (show files and columns, save nothing)
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { importDiscoverUni } from '../src/services/europe.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
try {
  const r = await importDiscoverUni({ zipBuffer: file ? readFileSync(file) : null, dryRun: args.includes('--dry'), log: (m) => console.log(`  ${m}`) });
  console.log(r);
} catch (e) { console.error(e.message); process.exit(1); }
