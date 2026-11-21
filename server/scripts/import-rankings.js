#!/usr/bin/env node
// Import NIRF (or other) rankings from the official ranking table saved as .xlsx/.csv.
//   npm run import:rankings -- nirf-2025-engineering.csv 2025 Engineering
//   npm run import:rankings -- nirf-2025-overall.csv 2025 Overall NIRF https://www.nirfindia.org/Rankings/2025/OverallRanking.html
// Columns used: Name | City | State | Score | Rank   (rank bands like "101-150" are kept as bands)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parseSheet } from '../src/services/sheetImport.js';
import { importRankings } from '../src/services/rankingsImport.js';

const [file, year, category = 'Overall', source = 'NIRF', sourceUrl = null] = process.argv.slice(2);
if (!file || !year) { console.error('Usage: npm run import:rankings -- <file> <year> [category] [source] [source-url]'); process.exit(1); }
const { headers, rows } = await parseSheet(fs.readFileSync(file), path.basename(file));
const r = await importRankings({ headers, rows, year, category, source, sourceUrl });
console.log(`Saved ${r.saved} rankings.`);
if (r.unmatched.length) { console.log(`${r.unmatched.length} names not matched:`); r.unmatched.slice(0, 40).forEach((n) => console.log(`  ${n}`)); }
