#!/usr/bin/env node
// NIRF India Rankings 2022–2025 → ranking lists + college pages.   npm run import:nirf [-- other.csv]
import 'dotenv/config';
import { importNirf } from '../src/services/nirf.js';
try {
  const r = await importNirf({ file: process.argv[2] || undefined, log: (m) => console.log(`  ${m}`) });
  console.log({ ...r, unmatched: `${r.unmatched.length} (first: ${r.unmatched.slice(0, 15).join('; ')})` });
} catch (e) { console.error(e.message); process.exit(1); }
