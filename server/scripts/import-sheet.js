#!/usr/bin/env node
// Import colleges from a spreadsheet (e.g. the AISHE "All Colleges" list for India).
//   npm run import:sheet -- ./All_Colleges.xlsx IN aishe
// Columns are matched automatically from the header names; check with --dry first.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parseSheet, guessMapping, stashUpload, importSheet, TARGETS } from '../src/services/sheetImport.js';

const [file, country, source = 'upload', ...flags] = process.argv.slice(2);
if (!file || !country) { console.error('Usage: npm run import:sheet -- <file.xlsx|csv> <country code> [source-label] [--dry]'); process.exit(1); }
const { headers, rows } = await parseSheet(fs.readFileSync(file), path.basename(file));
const mapping = guessMapping(headers);
console.log(`${rows.length} rows. Column mapping:`);
for (const [k, label] of Object.entries(TARGETS)) console.log(`  ${label.padEnd(34)} ← ${mapping[k] || '(not mapped)'}`);
if (flags.includes('--dry')) { console.log('\nSample:', rows.slice(0, 3)); process.exit(0); }
if (!mapping.name) { console.error('Could not find the name column'); process.exit(1); }
const token = stashUpload({ filename: path.basename(file), headers, rows });
const r = await importSheet({ token, mapping, country, source, log: (m) => process.stdout.write(`\r${m}        `) });
console.log(`\nDone: ${r.inserted} new · ${r.updated} refreshed · ${r.skipped} kept as admin-edited · ${r.bad} rows without a name`);
