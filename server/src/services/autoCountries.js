import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase } from '../supabase.js';
import { importCountry, countryInfo } from './universities.js';
import { kickAutofill } from './collegeAutofill.js';
import { serverBusy } from './loadGuard.js';

// Imports the countries listed in server/data/auto-countries.json when they have (almost) no colleges yet,
// once the server is calm. Afterwards the daily autofill adds photos, logos and details from Wikipedia/Wikimedia.
const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/auto-countries.json');

export async function runAutoCountries({ log = (m) => console.log(`[auto-countries] ${m}`) } = {}) {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(FILE, 'utf8')).countries || []; } catch { return { skipped: 'no list' }; }
  const done = [];
  for (const name of list) {
    const c = await countryInfo(name).catch(() => ({ name, code: null }));
    const { count } = await supabase.from('colleges').select('id', { count: 'exact', head: true }).eq('country', c.name);
    if ((count || 0) >= 20) continue;
    // don't retry a country whose import ran in the last day
    const { data: recent } = await supabase.from('import_runs').select('id, status').eq('kind', 'universities')
      .in('params->>country', [c.code, c.name].filter(Boolean)).gte('created_at', new Date(Date.now() - 24 * 3600e3).toISOString()).limit(1);
    if (recent?.length) continue;
    const { data: running } = await supabase.from('import_runs').select('id').eq('status', 'running')
      .gte('created_at', new Date(Date.now() - 30 * 60e3).toISOString()).limit(1);
    if (running?.length) { log('another import is running — will try again later'); break; }
    log(`${c.name}: ${count || 0} colleges — importing…`);
    try { const r = await importCountry(c.code || c.name, { log }); done.push({ country: c.name, ...r }); log(`${c.name}: ${r.inserted} added, ${r.updated} updated`); }
    catch (e) { log(`${c.name} failed: ${e.message}`); }
  }
  if (done.length) kickAutofill();
  return { done };
}

export function startAutoCountries() {
  if (process.env.AUTO_COUNTRIES === 'off') return;
  const tick = () => { if (serverBusy()) return; runAutoCountries().catch((e) => console.warn('[auto-countries]', e.message)); };
  setTimeout(tick, 4 * 60e3);
  setInterval(tick, 3600e3).unref();   // hourly: also catches a run postponed because the server was busy
}
