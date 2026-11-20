#!/usr/bin/env node
// Fill college descriptions, logos and real campus photos from Wikidata / Wikipedia / Wikimedia Commons.
//   npm run enrich -- IN --limit 300        (colleges in India without a cover photo, never checked before)
//   npm run enrich -- --all --limit 2000    (any country)
// Free, no key. Runs slowly on purpose (Wikimedia rate limits). Re-run any time; it skips colleges already checked.
import 'dotenv/config';
import { enrichMany } from '../src/services/wikimedia.js';

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf('--limit') + 1]) || 200;
const country = args.find((a) => /^[A-Za-z]{2}$/.test(a)) || null;
if (!country && !args.includes('--all')) { console.error('Usage: npm run enrich -- <country code> [--limit N]  |  --all [--limit N]'); process.exit(1); }
const r = await enrichMany({ country, limit, onlyMissingPhotos: !args.includes('--include-with-photos'), log: (m) => process.stdout.write(`\r${m}        `) });
console.log(`\nDone: ${r.checked} checked · ${r.matched} enriched · ${r.missed} not found · ${r.failed} errors`);
