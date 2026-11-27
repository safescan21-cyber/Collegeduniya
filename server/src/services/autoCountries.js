import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase } from '../supabase.js';
import { importCountry, countryInfo } from './universities.js';
import { kickAutofill } from './collegeAutofill.js';
import { serverBusy } from './loadGuard.js';
import { importCricos, cricosDue } from './cricos.js';
import { spawnLeidenImport } from './leiden.js';

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

// Australia's official course list with fees (monthly) and the world research ranking (once; the admin panel re-runs it)
let officialBusy = false;
export async function runOfficialData({ log = (m) => console.log(`[official-data] ${m}`) } = {}) {
  if (officialBusy) return; officialBusy = true;
  try {
    if (process.env.AUTO_CRICOS !== 'off' && await cricosDue()) {
      log('Australia (CRICOS) is due — importing'); await importCricos({ log }).then(() => kickAutofill()).catch((e) => log(`CRICOS failed: ${e.message}`));
    }
    if (process.env.AUTO_US !== 'off' && process.env.COLLEGE_SCORECARD_API_KEY) {   // U.S. tuition + programmes (College Scorecard)
      const { data } = await supabase.from('import_runs').select('created_at, status, message').eq('kind', 'scorecard').order('created_at', { ascending: false }).limit(1);
      const last = data?.[0]; const age = last ? Date.now() - new Date(last.created_at).getTime() : Infinity;
      const busy = last && ((last.status === 'running' && age < 3 * 3600e3) || (last.status === 'failed' && age < 6 * 3600e3));
      const due = !last || !/programmes/.test(last.message || '') || age > 330 * 864e5;   // first time, the older version without courses, or yearly
      if (!busy && due && !serverBusy()) {
        log('U.S. College Scorecard is due — tuition into existing colleges + programmes as courses');
        const { importScorecard } = await import('./scorecard.js');
        await importScorecard({ log }).then(() => kickAutofill()).catch((e) => log(`Scorecard failed: ${e.message}`));
      }
    }
    if (process.env.AUTO_JOSAA !== 'off') {   // IIT / NIT / IIIT / GFTI programmes + seats (JoSAA): first time, after a failure (6 h), yearly
      const { data } = await supabase.from('import_runs').select('created_at, status').eq('kind', 'josaa').order('created_at', { ascending: false }).limit(1);
      const last = data?.[0]; const age = last ? Date.now() - new Date(last.created_at).getTime() : Infinity;
      const due = !last || (last.status === 'failed' && age > 6 * 3600e3) || (last.status === 'done' && age > 300 * 864e5);
      if (due && !serverBusy()) {
        log('JoSAA seat matrix is due — IIT / NIT / IIIT programmes');
        const { importJosaa } = await import('./josaa.js');
        await importJosaa({ log }).then(() => kickAutofill()).catch((e) => log(`JoSAA failed: ${e.message}`));
      }
    }
    if (process.env.AUTO_UK !== 'off') {   // UK (Discover Uni, CC BY 4.0): first time, then once a year (HESA refreshes it each autumn)
      const { data } = await supabase.from('import_runs').select('created_at, status').eq('kind', 'discover_uni').order('created_at', { ascending: false }).limit(1);
      const last = data?.[0]; const age = last ? Date.now() - new Date(last.created_at).getTime() : Infinity;
      const due = !last || (last.status !== 'done' && age > 7 * 864e5) || age > 330 * 864e5;
      if (due && !serverBusy()) {
        log('UK (Discover Uni) is due — downloading from HESA');
        const { importDiscoverUni } = await import('./europe.js');
        await importDiscoverUni({ log }).then(() => kickAutofill()).catch((e) => log(`Discover Uni failed: ${e.message}`));
      }
    }
    if (process.env.AUTO_LEIDEN !== 'off') {
      const { data } = await supabase.from('import_runs').select('id').eq('kind', 'leiden').limit(1);
      if (!data?.length && !serverBusy()) { log('World ranking (Leiden) never imported — starting it in the background'); spawnLeidenImport({}); }
    }
  } finally { officialBusy = false; }
}

export function startAutoCountries() {
  if (process.env.AUTO_COUNTRIES === 'off') return;
  const tick = () => {
    if (serverBusy()) return;
    runAutoCountries().then(() => runOfficialData()).catch((e) => console.warn('[auto-countries]', e.message));
  };
  setTimeout(tick, 4 * 60e3);
  setInterval(tick, 3600e3).unref();   // hourly: also catches a run postponed because the server was busy
}
