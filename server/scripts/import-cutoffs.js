#!/usr/bin/env node
// Import official cutoffs (JoSAA / MCC / state counselling opening-closing rank sheets, exported to .xlsx/.csv).
//   npm run import:cutoffs -- josaa-2026-round6.xlsx jee-advanced 2026 "Round 6"
//   npm run import:cutoffs -- josaa-2026-round5.xlsx josaa 2026 "Round 5"   (josaa = IITs→JEE Advanced, others→JEE Main)
//   npm run import:cutoffs -- mcc-neet-2026-round3.xlsx neet-ug 2026 "Round 3"
// Columns used: Institute | Academic Program Name | Quota (AI/HS/OS) | Seat Type | Gender | Opening Rank | Closing Rank
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parseSheet } from '../src/services/sheetImport.js';
import { importCutoffs } from '../src/services/rankingsImport.js';

const [file, exam, year, round = 'Final'] = process.argv.slice(2);
if (!file || !exam || !year) { console.error('Usage: npm run import:cutoffs -- <file> <exam-slug> <year> [round]'); process.exit(1); }
const { headers, rows } = await parseSheet(fs.readFileSync(file), path.basename(file));
const r = await importCutoffs({ headers, rows, exam, year, round, source: path.basename(file), log: (m) => process.stdout.write(`\r${m}   `) });
console.log(`\nSaved ${r.saved} cutoff rows for ${r.colleges} colleges.`);
if (r.unmatched.length) { console.log(`\n${r.unmatched.length} institute names not found — add/rename them, then re-run:`); r.unmatched.slice(0, 40).forEach((u) => console.log(`  ${u.name} (${u.rows} rows)`)); }
