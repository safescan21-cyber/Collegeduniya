import { supabase } from '../supabase.js';
import { fetchJson, throttle } from './http.js';
import { cached } from './cache.js';

const NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const OVERPASS = (process.env.OVERPASS_URLS || 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter')
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

// ---------------------------------------------------------------- nearby places (Overpass)
export const NEARBY_KINDS = {
  hospital: '["amenity"~"^(hospital|clinic)$"]',
  pharmacy: '["amenity"="pharmacy"]',
  pg: '["tourism"~"^(hostel|guest_house|apartment)$"]',
  bank: '["amenity"~"^(bank|atm)$"]',
  transport: '["railway"="station"]',
  bus: '["amenity"="bus_station"]',
  food: '["amenity"~"^(restaurant|cafe|fast_food)$"]',
  library: '["amenity"="library"]',
};

async function overpass(query) {
  let lastErr;
  for (const url of OVERPASS) {
    try {
      return await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        timeoutMs: 30000,
      });
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

export async function nearbyPlaces(kind, lat, lng, radiusM = 3000) {
  const filter = NEARBY_KINDS[kind];
  if (!filter) throw new Error('Unknown place type');
  const radius = Math.min(Math.max(Number(radiusM) || 3000, 300), 15000);
  const key = `osm:${kind}:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;
  return cached(key, 7 * DAY, async () => {
    const q = `[out:json][timeout:25];nwr${filter}(around:${radius},${lat},${lng});out center tags 60;`;
    const data = await overpass(q);
    const rows = (data?.elements || []).map((e) => {
      const t = e.tags || {};
      const la = e.lat ?? e.center?.lat; const lo = e.lon ?? e.center?.lon;
      if (la == null || !t.name) return null;
      const addr = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'], t['addr:city']].filter(Boolean).join(', ');
      return {
        id: `${e.type}/${e.id}`, kind, name: t['name:en'] || t.name, latitude: la, longitude: lo,
        distance_km: Math.round(distanceKm(lat, lng, la, lo) * 10) / 10,
        address: addr || null, phone: t.phone || t['contact:phone'] || null, website: t.website || t['contact:website'] || null,
        emergency: t.emergency === 'yes', type: t.amenity || t.tourism || t.railway || null,
        osm_url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      };
    }).filter(Boolean);
    rows.sort((a, b) => a.distance_km - b.distance_km);
    return rows.slice(0, 40);
  });
}
