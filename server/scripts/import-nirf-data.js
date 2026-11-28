#!/usr/bin/env node
// NIRF institution data sheets → courses + seats, placements (median salary, % placed), scores.
//   npm run import:nirf-data                    (2025, all categories)
//   npm run import:nirf-data -- 2024 Engineering --limit=5
import 'dotenv/config';
import { importNirfData } from '../src/services/nirfData.js';
const a = process.argv.slice(2);
const year = Number(a.find((x) => /^\d{4}$/.test(x))) || 2025;
const cats = a.filter((x) => !/^\d{4}$/.test(x) && !x.startsWith('--'));
const limit = Number((a.find((x) => x.startsWith('--limit=')) || '').split('=')[1]) || null;
try { console.log(await importNirfData({ year, categories: cats.length ? cats : null, limit, log: (m) => console.log(`  ${m}`) })); } catch (e) { console.error(e.message); process.exit(1); }
