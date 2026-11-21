#!/usr/bin/env node
// India: ~70,000 universities, colleges and standalone institutions from the AISHE list (npm "aishe-institutions-list").
//   npm run import:aishe            (save)
//   npm run import:aishe -- --dry   (count and show a sample, save nothing)
import 'dotenv/config';
import { importAisheList } from '../src/services/aisheList.js';

try {
  console.log(await importAisheList({ dryRun: process.argv.includes('--dry'), log: (m) => console.log(`  ${m}`) }));
} catch (e) { console.error(e.message); process.exit(1); }
