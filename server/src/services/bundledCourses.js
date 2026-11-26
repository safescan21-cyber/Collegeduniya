import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { supabase } from '../supabase.js';
import { parseSheet, stashUpload } from './sheetImport.js';
import { importCoursesSheet, guessCourseMapping } from './coursesSheet.js';
import { serverBusy } from './loadGuard.js';

// Course spreadsheets that ship with the code (server/data/courses/*.csv — fees researched from universities' own
// websites) are imported automatically, each version once: when a file changes, it is imported again (the import
// updates the same courses, never duplicates). A file waits until its country has colleges (country import first).
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/courses');

export async function runBundledCourses({ log = (m) => console.log(`[bundled-courses] ${m}`) } = {}) {
  if (!fs.existsSync(DIR)) return { files: 0 };
  const out = [];
  for (const f of fs.readdirSync(DIR).filter((x) => /\.(csv|xlsx)$/i.test(x)).sort()) {
    const buf = fs.readFileSync(path.join(DIR, f));
    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
    // finished = this version imported with every college found; otherwise try again once a day (colleges may arrive later)
    const { data: runs } = await supabase.from('import_runs').select('status, message, created_at').eq('kind', 'courses_sheet')
      .eq('params->>bundled', `${f}:${hash}`).order('created_at', { ascending: false }).limit(5);
    if ((runs || []).some((r) => r.status === 'done' && /"unmatched_colleges":0/.test(r.message || ''))) continue;
    if (runs?.[0] && Date.now() - Date.parse(runs[0].created_at) < 23 * 3600e3) continue;
    const { headers, rows } = await parseSheet(buf, f);
    const mapping = guessCourseMapping(headers);
    const countries = [...new Set(rows.map((r) => String(r[mapping.country] || '').trim()).filter(Boolean))];
    let ready = true;
    for (const c of countries) {
      const { count } = await supabase.from('colleges').select('id', { count: 'exact', head: true }).ilike('country', c);
      if ((count || 0) < 5) { ready = false; log(`${f}: waiting for ${c} colleges to be imported`); }
    }
    if (!ready) continue;
    const token = stashUpload({ filename: f, headers, rows });
    try {
      const r = await importCoursesSheet({ token, mapping, log, startedBy: null, bundled: `${f}:${hash}` });
      out.push({ file: f, ...r });
      log(`${f}: ${r.courses} courses for ${r.colleges} colleges${r.unmatched_colleges ? ` · not found: ${r.unmatched.join(', ')}` : ''}`);
    } catch (e) { log(`${f} failed: ${e.message}`); }
  }
  return { imported: out };
}

export function startBundledCourses() {
  if (process.env.BUNDLED_COURSES === 'off') return;
  const tick = () => { if (!serverBusy()) runBundledCourses().catch((e) => console.warn('[bundled-courses]', e.message)); };
  setTimeout(tick, 6 * 60e3);
  setInterval(tick, 3600e3).unref();   // hourly: picks up files whose country import finished later
}
