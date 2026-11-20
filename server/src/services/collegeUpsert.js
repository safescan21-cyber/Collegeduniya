import { supabase } from '../supabase.js';

export const normName = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, ' ')
  .replace(/\b(the|of|and|university|college|institute)\b/g, ' ').replace(/\s+/g, ' ').trim();
export const host = (u) => { try { return new URL(String(u).startsWith('http') ? u : `http://${u}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };

export function typeFromManagement(m) {
  const s = String(m || '').toLowerCase();
  if (!s) return 'Other';
  if (/deemed/.test(s)) return 'Deemed';
  if (/autonom/.test(s)) return 'Autonomous';
  if (/gov|state|central|public|municipal|local body|university \(/.test(s) && !/private/.test(s)) return 'Public';
  if (/private|un-?aided|self[- ]?financ/.test(s)) return 'Private';
  return 'Other';
}

export async function countryRow(input) {
  const v = String(input || '').trim();
  if (!v) return null;
  const q = v.length === 2
    ? supabase.from('countries').select('code, name, currency_code').eq('code', v.toUpperCase()).maybeSingle()
    : supabase.from('countries').select('code, name, currency_code').ilike('name', v).maybeSingle();
  const { data } = await q;
  return data || (v.length > 2 ? { code: null, name: v, currency_code: null } : null);
}

// Coordinates for "city/district + state" from the GeoNames table (no external calls)
export async function cityLocator(countryCode) {
  const map = new Map();
  const byDistrict = new Map();   // "pune|maharashtra" → most populous place in that district (district HQ)
  if (!countryCode) return () => null;
  let cols = 'geoname_id, name, ascii_name, admin1, admin2, latitude, longitude, population';
  for (let from = 0; ; from += 1000) {
    let { data, error } = await supabase.from('cities').select(cols)
      .eq('country_code', countryCode).order('population', { ascending: false }).range(from, from + 999);
    if (error && cols.includes('admin2')) { cols = cols.replace(' admin2,', ''); from -= 1000; continue; }   // migration 008 not run yet
    if (error || !data?.length) break;
    for (const c of data) {
      for (const n of new Set([c.name, c.ascii_name])) {
        const k1 = `${n.toLowerCase()}|${(c.admin1 || '').toLowerCase()}`;
        const k2 = n.toLowerCase();
        if (!map.has(k1)) map.set(k1, c);
        if (!map.has(k2)) map.set(k2, c);
      }
      if (c.admin2) {
        const kd = `${clean(c.admin2)}|${(c.admin1 || '').toLowerCase()}`;
        if (!byDistrict.has(kd)) byDistrict.set(kd, c);   // rows come most-populous first
      }
    }
    if (data.length < 1000) break;
  }
  return (place, state, district) => {
    const st = String(state || '').toLowerCase();
    if (place) {
      const p = clean(place);
      const hit = map.get(`${p}|${st}`) || map.get(p);
      if (hit) return hit;
    }
    const d = clean(district || place);
    return d ? byDistrict.get(`${d}|${st}`) || null : null;
  };
}

function clean(s) {
  return String(s || '').toLowerCase().replace(/\b(district|dist\.?|city|urban|rural|nagar nigam)\b/g, '').replace(/\s+/g, ' ').trim();
}

// Insert new rows whole; refresh known rows without touching slug, publish state or admin edits.
export async function upsertColleges(rows, { log = () => {} } = {}) {
  if (!rows.length) return { inserted: 0, updated: 0, skipped: 0 };
  const sources = Array.from(new Set(rows.map((r) => r.source)));
  const known = new Map();
  for (const src of sources) {
    const ids = rows.filter((r) => r.source === src).map((r) => r.external_id);
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await supabase.from('colleges').select('id, external_id, city').eq('source', src).in('external_id', ids.slice(i, i + 500));
      (data || []).forEach((d) => known.set(`${src}:${d.external_id}`, d));
    }
  }
  const fresh = []; const refresh = [];
  for (const r of rows) {
    const k = known.get(`${r.source}:${r.external_id}`);
    if (!k) { fresh.push(r); continue; }
    const { slug, is_published, source, external_id, ...rest } = r;
    if (!rest.logo_url) delete rest.logo_url;
    if (!rest.cover_url) delete rest.cover_url;
    if (rest.city === 'Not specified' || (k.city && k.city !== 'Not specified')) { delete rest.city; delete rest.state; delete rest.district; }
    for (const f of ['fees_min', 'fees_max', 'latitude', 'longitude', 'website', 'established', 'wikidata_id']) if (rest[f] == null) delete rest[f];
    refresh.push({ id: k.id, patch: rest });
  }
  // New rows: bulk insert (same columns per request)
  const byShape = new Map();
  for (const r of fresh) { const key = Object.keys(r).sort().join(','); (byShape.get(key) || byShape.set(key, []).get(key)).push(r); }
  let done = 0;
  for (const group of byShape.values()) {
    for (let i = 0; i < group.length; i += 500) {
      const chunk = group.slice(i, i + 500);
      const { error } = await supabase.from('colleges').insert(chunk);
      if (error) throw new Error(error.message);
      done += chunk.length;
      log(`saved ${done} / ${rows.length}`);
    }
  }
  // Known rows: update by id (an upsert would try to insert NULL slug/city first and fail)
  for (let i = 0; i < refresh.length; i += 25) {
    const res = await Promise.all(refresh.slice(i, i + 25).map(({ id, patch }) => supabase.from('colleges').update(patch).eq('id', id)));
    const err = res.find((x) => x.error)?.error;
    if (err) throw new Error(err.message);
    done += Math.min(25, refresh.length - i);
    if (i % 500 === 0) log(`saved ${done} / ${rows.length}`);
  }
  return { inserted: fresh.length, updated: refresh.length };
}

// Remove rows that duplicate colleges an admin created by hand
export async function dropManualDuplicates(rows, country) {
  const { data } = await supabase.from('colleges').select('name, website, state').eq('source', 'admin').eq('country', country).limit(20000);
  const names = new Set((data || []).map((d) => `${normName(d.name)}|${String(d.state || '').toLowerCase()}`));
  const namesAny = new Set((data || []).map((d) => normName(d.name)));
  const hosts = new Set((data || []).map((d) => host(d.website || '')).filter(Boolean));
  const keep = rows.filter((r) => !(r.website && hosts.has(host(r.website))) && !names.has(`${normName(r.name)}|${String(r.state || '').toLowerCase()}`) && !(namesAny.has(normName(r.name)) && !r.state));
  return { keep, skipped: rows.length - keep.length };
}
