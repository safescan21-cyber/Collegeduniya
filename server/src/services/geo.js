import { supabase } from '../supabase.js';
import { serverBusy } from './loadGuard.js';
import { fetchJson, throttle } from './http.js';
import { cached } from './cache.js';

const NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const OVERPASS = (process.env.OVERPASS_URLS || 'https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter,https://overpass.kumi.systems/api/interpreter')
  .split(',').map((s) => s.trim()).filter(Boolean);

const DAY = 864e5;

export function distanceKm(lat1, lng1, lat2, lng2) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------- cities
// 1) GeoNames table in Supabase (fast, ranked by population)
// 2) OpenStreetMap Nominatim fallback for small towns not in the table
export async function searchCities(q, country, limit = 10, lang = null) {
  const term = String(q || '').trim().slice(0, 80);
  if (term.length < 2) return [];
  let { data, error } = await supabase.rpc('search_cities', { q: term, country: country || null, lim: limit, lang: lang || null });
  if (error && /lang|function/i.test(error.message)) ({ data, error } = await supabase.rpc('search_cities', { q: term, country: country || null, lim: limit }));   // before migration 008
  const local = (!error && data) ? data.map((c) => ({ ...c, source: 'geonames' })) : [];
  if (local.length >= 3 || term.length < 3) return local;

  try {
    const osm = await cached(`nominatim:${country || ''}:${term.toLowerCase()}`, 30 * DAY, async () => {
      await throttle('nominatim', 1100);
      const params = new URLSearchParams({ q: term, format: 'jsonv2', addressdetails: '1', limit: '8', 'accept-language': 'en' });
      if (country && country.length === 2) params.set('countrycodes', country.toLowerCase());
      const rows = await fetchJson(`${NOMINATIM}/search?${params}`);
      return (rows || [])
        .filter((r) => ['city', 'town', 'village', 'municipality', 'suburb', 'administrative'].includes(r.addresstype || r.type))
        .map((r) => ({
          geoname_id: null,
          name: r.address?.city || r.address?.town || r.address?.village || r.name,
          admin1: r.address?.state || null,
          country: r.address?.country || null,
          country_code: (r.address?.country_code || '').toUpperCase(),
          latitude: Number(r.lat), longitude: Number(r.lon), population: null,
          slug: null, source: 'osm',
        }));
    });
    const seen = new Set(local.map((c) => `${c.name}|${c.country_code}`.toLowerCase()));
    return [...local, ...osm.filter((c) => !seen.has(`${c.name}|${c.country_code}`.toLowerCase()))].slice(0, limit);
  } catch (e) {
    console.warn('[nominatim]', e.message);
    return local;
  }
}

export async function reverseCity(lat, lng) {
  const { data } = await supabase.rpc('nearest_city', { lat, lng });
  if (data?.[0]) return { ...data[0], source: 'geonames' };
  return cached(`nominatim-rev:${lat.toFixed(2)}:${lng.toFixed(2)}`, 30 * DAY, async () => {
    await throttle('nominatim', 1100);
    const r = await fetchJson(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=10&accept-language=en`);
    return { name: r.address?.city || r.address?.town || r.address?.village || r.name, admin1: r.address?.state,
      country: r.address?.country, country_code: (r.address?.country_code || '').toUpperCase(), source: 'osm' };
  });
}

// Geocode a free-text address (used when admins/owners add a place without coordinates)
export async function geocode(text) {
  return cached(`nominatim-geo:${text.toLowerCase()}`, 90 * DAY, async () => {
    await throttle('nominatim', 1100);
    const rows = await fetchJson(`${NOMINATIM}/search?${new URLSearchParams({ q: text, format: 'jsonv2', limit: '1' })}`);
    return rows?.[0] ? { latitude: Number(rows[0].lat), longitude: Number(rows[0].lon), display: rows[0].display_name } : null;
  });
}

// ---------------------------------------------------------------- nearby places (OpenStreetMap via Overpass)
// The free Overpass servers are often busy, so: ONE request per location fetches every kind at once (hospitals, food,
// places to visit …), with a patient timeout; the result is kept for 30 days (api_cache) and shared by every page near
// that spot; a background job (startNearbyPrefill) collects it ahead of visitors.
export const NEARBY_KINDS = {
  hospital: { r: 5000, n: 60, q: '["amenity"~"^(hospital|clinic|doctors)$"]' },
  pharmacy: { r: 2500, n: 30, q: '["amenity"="pharmacy"]' },
  pg: { r: 3000, n: 30, q: '["tourism"~"^(hostel|guest_house|apartment)$"]' },
  bank: { r: 2500, n: 30, q: '["amenity"~"^(bank|atm)$"]' },
  transport: { r: 10000, n: 20, q: '["railway"~"^(station|halt)$"]' },
  bus: { r: 5000, n: 20, q: '["amenity"="bus_station"]' },
  food: { r: 2000, n: 70, q: '["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"]' },
  library: { r: 5000, n: 20, q: '["amenity"="library"]' },
  visit: { r: 10000, n: 60, q: ['["tourism"~"^(attraction|museum|viewpoint|zoo|theme_park|gallery|aquarium)$"]', '["historic"~"^(monument|memorial|fort|castle|ruins|archaeological_site|palace|city_gate)$"]', '["leisure"~"^(park|garden|nature_reserve|water_park)$"]'] },
};
const AREA_DAYS = 30;
const OVERPASS_TIMEOUT = Number(process.env.OVERPASS_TIMEOUT_S || 120);

function kindOf(t) {
  const a = t.amenity, to = t.tourism;
  if (/^(hospital|clinic|doctors)$/.test(a)) return 'hospital';
  if (a === 'pharmacy') return 'pharmacy';
  if (/^(bank|atm)$/.test(a)) return 'bank';
  if (a === 'bus_station') return 'bus';
  if (/^(station|halt)$/.test(t.railway || '')) return 'transport';
  if (/^(restaurant|cafe|fast_food|food_court|ice_cream)$/.test(a)) return 'food';
  if (a === 'library') return 'library';
  if (/^(hostel|guest_house|apartment)$/.test(to)) return 'pg';
  if (/^(attraction|museum|viewpoint|zoo|theme_park|gallery|aquarium)$/.test(to) || t.historic || t.leisure) return 'visit';
  return null;
}

async function overpass(query) {
  let lastErr;
  for (const url of OVERPASS) {
    try {
      return await fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}`, timeoutMs: (OVERPASS_TIMEOUT + 15) * 1000 });
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const areaKey = (lat, lng) => `osm-area:v2:${lat.toFixed(3)}:${lng.toFixed(3)}`;
const inflight = new Map();

async function readArea(key) {
  const { data } = await supabase.from('api_cache').select('payload, fetched_at').eq('key', key).maybeSingle();
  if (!data) return null;
  return { rows: data.payload, fresh: Date.now() - new Date(data.fetched_at).getTime() < AREA_DAYS * DAY };
}

// Overpass: everything around a point in one call (richer: phone numbers, 24×7 ER …) — slow when the servers are busy
async function overpassArea(lat, lng) {
  {
    const parts = Object.entries(NEARBY_KINDS).map(([k, d]) => {
      const filters = Array.isArray(d.q) ? d.q : [d.q];
      return `(${filters.map((f) => `nwr${f}["name"](around:${d.r},${lat},${lng});`).join('')})->.${k};.${k} out center tags ${d.n};`;
    }).join('');
    const data = await overpass(`[out:json][timeout:${OVERPASS_TIMEOUT}];${parts}`);
    const seen = new Set(); const rows = [];
    for (const e of data?.elements || []) {
      const t = e.tags || {};
      const la = e.lat ?? e.center?.lat; const lo = e.lon ?? e.center?.lon;
      const kind = kindOf(t);
      if (la == null || !t.name || !kind || seen.has(`${e.type}/${e.id}`)) continue;
      seen.add(`${e.type}/${e.id}`);
      const addr = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'], t['addr:city']].filter(Boolean).join(', ');
      rows.push({
        id: `${e.type}/${e.id}`, kind, name: t['name:en'] || t.name, latitude: la, longitude: lo,
        distance_km: Math.round(distanceKm(lat, lng, la, lo) * 10) / 10,
        address: addr || null, phone: t.phone || t['contact:phone'] || null, website: t.website || t['contact:website'] || null,
        emergency: t.emergency === 'yes', type: t.amenity || t.tourism || t.historic || t.leisure || t.railway || null,
        cuisine: t.cuisine ? String(t.cuisine).replace(/_/g, ' ').replace(/;/g, ', ') : null,
        osm_url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      });
    }
    return rows;
  }
}


// Photon (komoot, OpenStreetMap data): fast keyword search near a point — the main source
const PHOTON = process.env.PHOTON_URL || 'https://photon.komoot.io';
const PHOTON_Q = {
  hospital: [['hospital', ['amenity:hospital', 'amenity:clinic']]],
  pharmacy: [['pharmacy', ['amenity:pharmacy']]],
  pg: [['hostel', ['tourism:hostel', 'tourism:guest_house']]],
  bank: [['bank', ['amenity:bank', 'amenity:atm']]],
  transport: [['station', ['railway:station', 'railway:halt']]],
  bus: [['bus station', ['amenity:bus_station']]],
  food: [['restaurant', ['amenity:restaurant', 'amenity:fast_food']], ['cafe', ['amenity:cafe']]],
  library: [['library', ['amenity:library']]],
  visit: [['museum', ['tourism:museum', 'tourism:gallery']], ['park', ['leisure:park', 'leisure:garden']], ['monument', ['historic:monument', 'historic:memorial', 'historic:fort', 'historic:palace']], ['attraction', ['tourism:attraction', 'tourism:viewpoint', 'tourism:zoo']]],
};
let photonDownUntil = 0;
export async function photonArea(lat, lng, { report = null, force = false } = {}) {
  const rows = []; const seen = new Set(); const errors = [];
  if (!force && Date.now() < photonDownUntil) throw new Error('Photon unreachable from this server (skipping for a while)');
  outer: for (const [kind, queries] of Object.entries(PHOTON_Q)) {
    for (const [q, tags] of queries) {
      const params = new URLSearchParams({ q, lat: String(lat), lon: String(lng), limit: '25', location_bias_scale: '0.1', zoom: '14', lang: 'en' });
      for (const t of tags) params.append('osm_tag', t);
      await throttle('photon', 250);
      let data;
      try { data = await fetchJson(`${PHOTON}/api/?${params}`, { timeoutMs: 15000 }); } catch (e) {
        errors.push(`${kind}/${q}: ${e.message}`);
        if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|ENETUNREACH|EHOSTUNREACH|403/.test(e.message)) { photonDownUntil = Date.now() + 6 * 3600e3; break outer; }
        continue;
      }
      for (const f of data?.features || []) {
        const pr = f.properties || {}; const [lo, la] = f.geometry?.coordinates || [];
        const id = `${{ N: 'node', W: 'way', R: 'relation' }[pr.osm_type] || 'node'}/${pr.osm_id}`;
        if (la == null || !pr.name || seen.has(id)) continue;
        const d = Math.round(distanceKm(lat, lng, la, lo) * 10) / 10;
        if (d > NEARBY_KINDS[kind].r / 1000) continue;
        seen.add(id);
        rows.push({ id, kind, name: pr.name, latitude: la, longitude: lo, distance_km: d,
          address: [pr.housenumber, pr.street, pr.district, pr.city].filter(Boolean).join(', ') || null, phone: null, website: null,
          emergency: false, type: pr.osm_value || null, cuisine: null, osm_url: `https://www.openstreetmap.org/${id}` });
      }
    }
  }
  if (errors.length) console.warn('[photon]', errors.length, 'failed —', errors[0]);
  if (report) report.errors = errors;
  if (!rows.length && errors.length) throw new Error(errors[0]);
  return rows;
}

// Nominatim (OpenStreetMap's own search) fallback: category search inside a box around the point (max 1 request / s)
const NOMI_Q = { hospital: ['hospital', 'clinic'], pharmacy: ['pharmacy'], pg: ['hostel', 'guest house'], bank: ['bank', 'atm'], transport: ['railway station'],
  bus: ['bus station'], food: ['restaurant', 'cafe', 'fast food'], library: ['library'], visit: ['museum', 'park', 'monument', 'tourist attraction'] };
export async function nominatimArea(lat, lng, { report = null } = {}) {
  const rows = []; const seen = new Set(); const errors = [];
  for (const [kind, words] of Object.entries(NOMI_Q)) {
    const rKm = NEARBY_KINDS[kind].r / 1000; const dLat = rKm / 111; const dLng = rKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    for (const w of words) {
      await throttle('nominatim', 1100);
      const params = new URLSearchParams({ q: w, format: 'jsonv2', limit: '40', bounded: '1', viewbox: `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`, 'accept-language': 'en', addressdetails: '1' });
      let data;
      try { data = await fetchJson(`${NOMINATIM}/search?${params}`, { timeoutMs: 20000 }); } catch (e) { errors.push(`${kind}/${w}: ${e.message}`); continue; }
      for (const r of data || []) {
        const id = `${r.osm_type}/${r.osm_id}`; const la = Number(r.lat); const lo = Number(r.lon);
        if (!r.name || seen.has(id)) continue;
        const d = Math.round(distanceKm(lat, lng, la, lo) * 10) / 10;
        if (d > rKm) continue;
        seen.add(id);
        const a = r.address || {};
        rows.push({ id, kind, name: r.name, latitude: la, longitude: lo, distance_km: d,
          address: [a.house_number, a.road, a.suburb, a.city || a.town || a.village].filter(Boolean).join(', ') || null, phone: null, website: null,
          emergency: false, type: r.type || null, cuisine: null, osm_url: `https://www.openstreetmap.org/${id}` });
      }
    }
  }
  if (errors.length) console.warn('[nominatim nearby]', errors.length, 'failed —', errors[0]);
  if (report) report.errors = errors;
  if (!rows.length && errors.length) throw new Error(errors[0]);
  return rows;
}

// Fetch (or reuse) everything around a point: Photon first (fast); Overpass adds detail in the background
export function fetchArea(lat, lng) {
  const key = areaKey(lat, lng);
  if (inflight.has(key)) return inflight.get(key);
  const save = (rows) => { rows.sort((a, b) => a.distance_km - b.distance_km); return supabase.from('api_cache').upsert({ key, payload: rows, fetched_at: new Date().toISOString() }).then(() => rows); };
  const job = (async () => {
    let rows = [];
    try { rows = await photonArea(lat, lng); } catch (e) { console.warn('[photon]', e.message); }
    if (!rows.length) { try { rows = await nominatimArea(lat, lng); } catch (e) { console.warn('[nominatim nearby]', e.message); } }
    if (rows.length) await save(rows);
    if (process.env.NEARBY_OVERPASS !== 'off') {
      const enrich = overpassArea(lat, lng).then((op) => {
        const byId = new Map(rows.map((r) => [r.id, r]));
        for (const r of op) byId.set(r.id, { ...byId.get(r.id), ...r });
        return save([...byId.values()]);
      });
      if (!rows.length) return enrich;              // nothing from Photon: wait for Overpass
      enrich.catch((e) => console.warn('[overpass]', e.message));
    }
    if (!rows.length) throw new Error('No map data');
    return rows;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

export class PendingError extends Error {}

// rows of one kind within radius; waits up to waitMs for a first fetch, otherwise reports "pending" (fetch continues)
export async function nearbyPlaces(kind, lat, lng, radiusM = 3000, { waitMs = 9000 } = {}) {
  if (!NEARBY_KINDS[kind]) throw new Error('Unknown place type');
  const radius = Math.min(Math.max(Number(radiusM) || 3000, 300), 15000) / 1000;
  const pick = (rows) => rows.filter((r) => r.kind === kind && r.distance_km <= radius).slice(0, 40);
  const have = await readArea(areaKey(lat, lng)).catch(() => null);
  if (have?.fresh) return pick(have.rows);
  const job = fetchArea(lat, lng);
  job.catch((e) => console.warn('[overpass]', e.message));
  if (have) return pick(have.rows);                       // stale: show it, refresh in the background
  const rows = await Promise.race([job, new Promise((r) => setTimeout(() => r(null), waitMs))]);
  if (!rows) throw new PendingError('pending');
  return pick(rows);
}

// Background: collect nearby places for published colleges ahead of visitors (one area at a time, politely)
export function startNearbyPrefill() {
  if (process.env.NEARBY_PREFILL === 'off') return;
  const batch = Number(process.env.NEARBY_PREFILL_BATCH || 20);
  let busy = false;
  const tick = async () => {
    if (busy || serverBusy()) return; busy = true;
    try {
      const { data } = await supabase.from('colleges').select('id, latitude, longitude')
        .eq('is_published', true).not('latitude', 'is', null).is('nearby_fetched_at', null)
        .order('cover_url', { ascending: true, nullsFirst: false }).limit(batch);
      for (const c of data || []) {
        const have = await readArea(areaKey(c.latitude, c.longitude)).catch(() => null);
        if (!have?.fresh) {
          if (serverBusy()) break;   // visitors first
          try { await fetchArea(c.latitude, c.longitude); } catch (e) { console.warn('[nearby prefill]', e.message); break; }   // servers busy: try later
          await new Promise((r) => setTimeout(r, 5000));
        }
        await supabase.from('colleges').update({ nearby_fetched_at: new Date().toISOString() }).eq('id', c.id);
      }
    } catch (e) { console.warn('[nearby prefill]', e.message); }
    busy = false;
  };
  setTimeout(tick, 90_000);
  setInterval(tick, Number(process.env.NEARBY_PREFILL_MINUTES || 15) * 60_000);
}
