#!/usr/bin/env node
// One command to fetch / refresh college details yourself — no Claude needed.
// Run on the server:
//   cd /var/www/collegeolo/server
//   npm run fetch -- help
//
// Every job here is the same code the server already runs on its own schedule (when it is calm);
// this just lets you run one right now. Data rules are unchanged: only official sources, robots.txt respected,
// AI answers kept only when the text is really on the official page.
import 'dotenv/config';
import fs from 'node:fs';
import { supabase } from '../src/supabase.js';
import { importCountry } from '../src/services/universities.js';
import { importScorecard } from '../src/services/scorecard.js';
import { enrichMany } from '../src/services/wikimedia.js';
import { collectCourses, COUNTRIES } from '../src/services/officialCourses.js';
import { collectOfficialFees } from '../src/services/officialFees.js';
import { collectExamDates } from '../src/services/examDates.js';
import { runAutofill } from '../src/services/collegeAutofill.js';
import { importCricos } from '../src/services/cricos.js';

const [cmd = 'help', ...rest] = process.argv.slice(2);
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const log = (m) => console.log(`  ${m}`);
const line = (t) => console.log(`\n=== ${t} ===`);
const busyNow = () => { try { return Number(fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]); } catch { return 0; } };

const HELP = `
Fetch college details — usage:  npm run fetch -- <command> [options]

  status                         How much data you have (colleges, courses, fees, photos) per country
  country <name or code>         Add / update all universities of a country     e.g. country Japan   | country FR
  us                             Re-import U.S. colleges (fees, admission rate, SAT/ACT, courses) — needs SCORECARD_API_KEY
  australia                      Re-import Australian courses + fees from CRICOS
  courses <DE|JP> [N]            Read degree programmes from N university websites (default 10)   e.g. courses JP 20
  fees [N]                       Read fees from N colleges' official fee pages (default 12)
  photos <CC|all> [N]            Logos, photos, descriptions from Wikipedia/Wikimedia (default 200) e.g. photos JP 300
  autofill                       Fill missing photos/descriptions for any college (one batch)
  exams [N]                      Check N exam websites for new dates (default 12)
  names                          Clean up badly written imported college names (up to 300)
  all                            Run a normal refresh: courses DE + JP, fees, exams, autofill, names

Tips:
  • Run one job at a time, at night if the site is busy.  Check load with:  uptime
  • Long jobs keep running if you start them inside:  screen -S fetch   (detach: Ctrl+A then D;  back: screen -r fetch)
  • Results also appear in Admin → System health and on the college pages.
`;

async function status() {
  line('Data you have');
  const count = async (table, filter) => { let q = supabase.from(table).select('id', { count: 'exact', head: true }); if (filter) q = filter(q); const { count, error } = await q; return error ? `error: ${error.message}` : count; };
  const { data } = await supabase.rpc('college_countries');
  const all = (data || []).map((r) => r.country);
  const main = ['India', 'United States', 'United Kingdom', 'Germany', 'Japan', 'Canada', 'Australia'];
  for (const c of main.filter((x) => all.includes(x))) {
    const total = await count('colleges', (q) => q.eq('country', c).eq('is_published', true));
    const photo = await count('colleges', (q) => q.eq('country', c).eq('is_published', true).not('cover_url', 'is', null));
    log(`${c.padEnd(16)} colleges ${String(total).padStart(6)} · with photo ${String(photo).padStart(6)}`);
  }
  log(`(${all.length} countries in total)`);
  log(`Courses total:              ${await count('courses')}`);
  log(`  read from official sites: ${await count('courses', (q) => q.eq('source', 'official_site'))}`);
}

async function names() {
  const { data, error } = await supabase.rpc('fix_college_names', { p_lim: 300 });
  log(error ? `error: ${error.message}` : `fixed: ${JSON.stringify(data)}`);
}

const jobs = {
  help: async () => console.log(HELP),
  status,
  country: async () => {
    const c = rest.join(' ').trim();
    if (!c) return console.log('Which country?  e.g.  npm run fetch -- country Japan');
    line(`Universities of ${c}`);
    const r = await importCountry(c, { log });
    log(JSON.stringify(r));
  },
  us: async () => { line('U.S. College Scorecard'); log(JSON.stringify(await importScorecard({ log }))); },
  australia: async () => { line('Australia (CRICOS)'); log(JSON.stringify(await importCricos({ log }))); },
  courses: async () => {
    const cc = String(rest[0] || '').toUpperCase();
    if (!COUNTRIES[cc]) return console.log(`Country must be one of: ${Object.keys(COUNTRIES).join(', ')}   e.g. courses JP 20`);
    line(`${COUNTRIES[cc].country}: programmes from university websites`);
    log(JSON.stringify(await collectCourses(cc, { limit: num(rest[1], 10) })));
  },
  fees: async () => { line('Fees from official fee pages'); log(JSON.stringify(await collectOfficialFees({ limit: num(rest[0], 12) }))); },
  photos: async () => {
    const a = String(rest[0] || '');
    const country = /^[A-Za-z]{2}$/.test(a) ? a.toUpperCase() : null;
    if (!country && a !== 'all') return console.log('Usage: photos <country code|all> [N]   e.g. photos JP 300');
    line(`Photos & descriptions (${country || 'all countries'})`);
    const r = await enrichMany({ country, limit: num(rest[1], 200), onlyMissingPhotos: true, log: (m) => process.stdout.write(`\r  ${m}        `) });
    console.log(`\n  ${r.checked} checked · ${r.matched} filled · ${r.missed} not found · ${r.failed} errors`);
  },
  autofill: async () => { line('Autofill'); log(JSON.stringify(await runAutofill({ reason: 'manual' }))); },
  exams: async () => { line('Exam dates'); log(JSON.stringify(await collectExamDates({ limit: num(rest[0], 12) }))); },
  names: async () => { line('Name cleanup'); await names(); },
  all: async () => {
    for (const cc of Object.keys(COUNTRIES)) { line(`${COUNTRIES[cc].country} programmes`); log(JSON.stringify(await collectCourses(cc, { limit: 8 }))); }
    line('Fees'); log(JSON.stringify(await collectOfficialFees({ limit: 12 })));
    line('Exam dates'); log(JSON.stringify(await collectExamDates({ limit: 12 })));
    line('Autofill'); log(JSON.stringify(await runAutofill({ reason: 'manual' })));
    line('Name cleanup'); await names();
  },
};

if (!jobs[cmd]) { console.log(`Unknown command "${cmd}".`); console.log(HELP); process.exit(1); }
const load = busyNow();
if (cmd !== 'help' && cmd !== 'status' && load > 6) console.log(`\nNote: the server is busy right now (load ${load}). The job will still run, but slower — night time is better.`);
const t0 = Date.now();
try { await jobs[cmd](); }
catch (e) { console.error(`\nFailed: ${e.message}`); process.exitCode = 1; }
if (cmd !== 'help') console.log(`\nFinished in ${Math.round((Date.now() - t0) / 1000)} s.`);
process.exit();
