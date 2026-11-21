import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { supabase } from '../supabase.js';
import { slugify } from '../schemas.js';
import { cityLocator, upsertColleges, dropManualDuplicates, normName } from './collegeUpsert.js';

// Every Indian higher-education institution from the AISHE list (Ministry of Education), as packaged in the npm
// module "aishe-institutions-list" (MIT): ~1,770 universities (U-), ~52,000 colleges (C-), ~16,000 standalone
// institutions (S-). R&D centres (R-) are skipped. Only name, state and district are in the list; the town is
// set to the district HQ. Matched by AISHE code, so re-running refreshes instead of duplicating.
const require = createRequire(import.meta.url);
const KIND = { U: 'University', C: 'College', S: 'Standalone institution' };

function titleCase(s) {
  if (s !== s.toUpperCase()) return s;          // already mixed case: keep as given
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Of|And|For|The|In|At|On)\b/g, (m) => m.toLowerCase())
    .replace(/\(([a-z]{2,8})\)/gi, (m, a) => `(${a.toUpperCase()})`)               // (ANCOL), (IIT)
    .replace(/\b(Iit|Nit|Iiit|Iim|Aiims|Itm|Its|Kle|Rv|Bms|Pes|Sri|Smt|Dr|Govt)\b/g, (m) => (/^(Sri|Smt|Dr|Govt)$/.test(m) ? m : m.toUpperCase()))
    .replace(/^./, (c) => c.toUpperCase());
}
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export function loadAisheList() {
  const file = require.resolve('aishe-institutions-list/data/institutions.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function importAisheList({ dryRun = false, publish = true, startedBy = null, log = () => {} } = {}) {
  const list = loadAisheList();
  log(`${list.length} entries in the AISHE list`);
  const { data: run } = dryRun ? { data: null } : await supabase.from('import_runs')
    .insert({ kind: 'aishe_list', params: { rows: list.length }, started_by: startedBy }).select('id').single();
  const finish = (patch) => run && supabase.from('import_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', run.id);
  try {
    const locate = await cityLocator('IN');
    // Indian colleges already on the site from other sources (Wikidata, Hipolabs …): don't add a second copy
    const existing = new Set();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('colleges').select('name, state, source').eq('country_code', 'IN').neq('source', 'aishe').range(from, from + 999);
      if (error) throw new Error(error.message);
      for (const c of data || []) { existing.add(`${normName(c.name)}|${String(c.state || '').toLowerCase()}`); existing.add(`${normName(c.name)}|`); }
      if (!data || data.length < 1000) break;
    }
    const seen = new Set(); const rows = []; let rnd = 0, dup = 0;
    for (const r of list) {
      const code = clean(r.aishe_code).toUpperCase();
      const kind = KIND[code[0]];
      if (!kind) { rnd++; continue; }
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const name = titleCase(clean(r.name)).replace(/\s+,/g, ',');
      if (name.length < 3) continue;
      const state = clean(r.state) || null; const district = clean(r.district) || null;
      if (existing.has(`${normName(name)}|${String(state || '').toLowerCase()}`) || (!state && existing.has(`${normName(name)}|`))) { dup++; continue; }
      const loc = locate(null, state, district);
      const city = loc?.name || district || null;
      const hash = crypto.createHash('sha1').update(`aishe:${code}`).digest('hex').slice(0, 6);
      rows.push({
        source: 'aishe', external_id: code, name,
        slug: `${slugify(`${name} ${city || state || 'india'}`).slice(0, 70)}-${hash}`,
        country: 'India', country_code: 'IN', state, district,
        city: city || 'Not specified', city_geoname_id: loc?.geoname_id || null,
        latitude: loc?.latitude ?? null, longitude: loc?.longitude ?? null,
        type: /\bgovt\b|government|rajkeeya|rajkiya/i.test(name) ? 'Public' : 'Other',
        currency: 'INR', facts: { institution: kind, aishe_code: code },
        is_published: Boolean(publish && (city || state)),
        data_updated_at: new Date().toISOString(),
      });
    }
    const { keep, skipped } = await dropManualDuplicates(rows, 'India');
    log(`${keep.length} to save · ${dup} already on the site from other sources · ${skipped} added by your team · ${rnd} R&D centres skipped`);
    if (dryRun) return { total: list.length, toSave: keep.length, duplicates: dup, admin: skipped, rnd, sample: keep.slice(0, 5).map((r) => `${r.external_id} ${r.name} — ${r.city}, ${r.state}`) };
    const { inserted, updated } = await upsertColleges(keep, { log });
    await finish({ status: 'done', inserted, updated, skipped: skipped + dup + rnd, message: `aishe-institutions-list: ${list.length} entries` });
    return { total: list.length, inserted, updated, duplicates: dup, admin: skipped, rnd };
  } catch (e) {
    await finish({ status: 'failed', message: e.message });
    throw e;
  }
}
