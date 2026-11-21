#!/usr/bin/env node
// Every higher-education institution in India from the official AISHE lists (Ministry of Education):
//   • All Universities           (~1,300  — AISHE codes U-…)
//   • All Colleges               (~48,000 — C-…)
//   • All Standalone Institutions (~15,000 — S-…, nursing, teacher training, polytechnics, hotel mgmt …)
// Download the three Excel files from https://dashboard.aishe.gov.in/hedirectory/ (or the
// "All … as per AISHE Dashboard" datasets on aikosh.indiaai.gov.in), then:
//
//   npm run import:india -- ./aishe/                 (a folder with the .xlsx / .csv files)
//   npm run import:india -- Universities.xlsx Colleges.xlsx Standalone.xlsx
//   add --dry to only check the column mapping
//
// Tip: run `npm run import:cities -- IN --names` first so every college is placed in its town (and
// district HQ when only the district is known). Safe to re-run: rows are matched by AISHE code and
// colleges your team edited by hand are never overwritten.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parseSheet, guessMapping, stashUpload, importSheet, detectAisheKind } from '../src/services/sheetImport.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
let files = args.filter((a) => !a.startsWith('--'));
if (files.length === 1 && fs.existsSync(files[0]) && fs.statSync(files[0]).isDirectory()) {
  files = fs.readdirSync(files[0]).filter((f) => /\.(xlsx|xls|csv)$/i.test(f)).map((f) => path.join(files[0], f));
}
if (!files.length) { console.error('Usage: npm run import:india -- <folder | file.xlsx …> [--dry]'); process.exit(1); }

// universities first, so colleges can show their affiliating university
const order = { University: 0, College: 1, 'Standalone institution': 2 };
const parsed = [];
for (const f of files) {
  const { headers, rows } = await parseSheet(fs.readFileSync(f), path.basename(f));
  const kind = detectAisheKind(headers)?.kind || 'Unknown';
  parsed.push({ f, headers, rows, kind });
}
parsed.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));

const total = { inserted: 0, updated: 0, skipped: 0, bad: 0 };
for (const p of parsed) {
  const mapping = guessMapping(p.headers);
  console.log(`\n${path.basename(p.f)} — ${p.kind} — ${p.rows.length.toLocaleString()} rows`);
  console.log(`  name ← ${mapping.name || '??'} · code ← ${mapping.external_id || '—'} · state ← ${mapping.state || '—'} · district ← ${mapping.district || '—'} · management ← ${mapping.management || '—'} · year ← ${mapping.established || '—'} · website ← ${mapping.website || '—'}`);
  if (!mapping.name) { console.error('  ✗ name column not found — skipped'); continue; }
  if (dry) continue;
  const token = stashUpload({ filename: path.basename(p.f), headers: p.headers, rows: p.rows });
  const r = await importSheet({ token, mapping, country: 'IN', source: 'aishe', log: (m) => process.stdout.write(`\r  ${m}          `) });
  console.log(`\n  ✓ ${r.inserted} new · ${r.updated} refreshed · ${r.skipped} kept (edited by your team) · ${r.bad} without a name`);
  for (const k of Object.keys(total)) total[k] += r[k] || 0;
}
if (!dry) console.log(`\nAll India done: ${total.inserted.toLocaleString()} new · ${total.updated.toLocaleString()} refreshed · ${total.skipped} kept`);
