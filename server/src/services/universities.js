import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { fetchJson } from './http.js';
import { slugify } from '../schemas.js';

// Import colleges for a country from two open sources and merge them:
//   1. Hipolabs university-domains list  → name, website, domains (10,000+ institutions, no key)
//   2. Wikidata SPARQL                   → coordinates, city, founding year, logo, photo, student count
// Rows are upserted with source='hipolabs' (or 'wikidata' when only Wikidata knows them).
// Colleges your admins created by hand (source='admin') are never overwritten.

const HIPOLABS = process.env.HIPOLABS_URL || 'http://universities.hipolabs.com';
const WIKIDATA = process.env.WIKIDATA_SPARQL_URL || 'https://query.wikidata.org/sparql';

const host = (u) => { try { return new URL(u.startsWith('http') ? u : `http://${u}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };
const normName = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, ' ').replace(/\b(the|of|and|university|college|institute)\b/g, ' ').replace(/\s+/g, ' ').trim();
const commons = (url, w) => url ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(url.split('/').pop()))}?width=${w}` : null;

export async function countryInfo(codeOrName) {
  const v = String(codeOrName || '').trim();
  if (!v) throw new Error('Country is required');
  const q = v.length === 2
    ? supabase.from('countries').select('code, name').eq('code', v.toUpperCase()).maybeSingle()
    : supabase.from('countries').select('code, name').ilike('name', v).maybeSingle();
  const { data } = await q;
  if (data) return data;
  if (v.length === 2) throw new Error(`Unknown country code ${v} — import countries first (npm run import:cities)`);
  return { code: null, name: v };
}

export async function fetchHipolabs(countryName) {
  const rows = await fetchJson(`${HIPOLABS}/search?country=${encodeURIComponent(countryName)}`, { timeoutMs: 60000 });
  return (rows || []).map((r) => ({
    name: String(r.name || '').trim(),
    website: (r.web_pages || [])[0] || null,
    domains: (r.domains || []).map((d) => d.toLowerCase()),
    state: r['state-province'] || null,
    country_code: r.alpha_two_code || null,
  })).filter((r) => r.name);
}

export async function fetchWikidata(countryCode) {
  const query = `
SELECT ?item ?itemLabel ?website ?coord ?inception ?logo ?image ?students ?cityLabel WHERE {
  VALUES ?type { wd:Q3918 wd:Q38723 wd:Q189004 wd:Q1371037 wd:Q15936437 wd:Q875538 wd:Q902104 wd:Q23002054 wd:Q2385804 wd:Q1664720 }
  ?item wdt:P31 ?type; wdt:P17 ?country. ?country wdt:P297 "${countryCode}".
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item wdt:P154 ?logo }
  OPTIONAL { ?item wdt:P18 ?image }
  OPTIONAL { ?item wdt:P2196 ?students }
  OPTIONAL { ?item wdt:P131 ?city }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,[AUTO_LANGUAGE]". }
} LIMIT 20000`;
  const data = await fetchJson(`${WIKIDATA}?format=json&query=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/sparql-results+json' }, timeoutMs: 90000,
  });
  const byId = new Map();
  for (const b of data?.results?.bindings || []) {
    const id = b.item.value.split('/').pop();
    const cur = byId.get(id) || { wikidata_id: id, name: b.itemLabel?.value, websites: new Set() };
    if (b.website) cur.websites.add(b.website.value);
    if (b.coord && cur.latitude == null) {
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord.value);
      if (m) { cur.longitude = Number(m[1]); cur.latitude = Number(m[2]); }
    }
    if (b.inception && !cur.established) cur.established = Number(String(b.inception.value).slice(0, 4)) || null;
    if (b.logo && !cur.logo) cur.logo = b.logo.value;
    if (b.image && !cur.image) cur.image = b.image.value;
    if (b.students) cur.students = Math.max(cur.students || 0, Math.round(Number(b.students.value)) || 0);
    if (b.cityLabel && !cur.city && !/^Q\d+$/.test(b.cityLabel.value)) cur.city = b.cityLabel.value;
    byId.set(id, cur);
  }
  return Array.from(byId.values()).filter((w) => w.name && !/^Q\d+$/.test(w.name));
}

// Merge both lists into college rows ready for upsert
export function mergeSources(hipo, wiki, country) {
  const wikiByHost = new Map();
  const wikiByName = new Map();
  for (const w of wiki) {
    for (const site of w.websites) { const h = host(site); if (h) wikiByHost.set(h, w); }
    wikiByName.set(normName(w.name), w);
  }
  const used = new Set();
  const rows = [];
  for (const h of hipo) {
    const w = h.domains.map((d) => wikiByHost.get(d)).find(Boolean) || wikiByHost.get(host(h.website || '')) || wikiByName.get(normName(h.name));
    if (w) used.add(w.wikidata_id);
    rows.push(toRow({ hipo: h, wiki: w, country }));
  }
  // Wikidata-only institutions with a website and coordinates are good enough to list too
  for (const w of wiki) {
    if (used.has(w.wikidata_id) || !w.websites.size || w.latitude == null) continue;
    rows.push(toRow({ wiki: w, country }));
  }
  return rows;
}

function toRow({ hipo, wiki, country }) {
  const name = hipo?.name || wiki.name;
  const website = hipo?.website || (wiki ? Array.from(wiki.websites)[0] : null) || null;
  const domains = hipo?.domains?.length ? hipo.domains : [host(website || '')].filter(Boolean);
  const external = hipo ? (domains[0] || normName(name)) : wiki.wikidata_id;
  const city = wiki?.city || null;
  const hash = crypto.createHash('sha1').update(`${country.code}:${external}`).digest('hex').slice(0, 6);
  return {
    source: hipo ? 'hipolabs' : 'wikidata',
    external_id: external,
    wikidata_id: wiki?.wikidata_id || null,
    name,
    slug: `${slugify(`${name} ${city || country.name}`).slice(0, 70)}-${hash}`,
    country: country.name,
    country_code: country.code,
    state: hipo?.state || null,
    city: city || 'Not specified',
    latitude: wiki?.latitude ?? null,
    longitude: wiki?.longitude ?? null,
    established: wiki?.established || null,
    website,
    domains,
    students_count: wiki?.students || null,
    logo_url: commons(wiki?.logo, 200),
    cover_url: commons(wiki?.image, 1200),
    type: 'Other',
    currency: null,
    // Listed only when we know where it is; others wait for an admin to fill in the city
    is_published: Boolean(city || wiki?.latitude != null),
    data_updated_at: new Date().toISOString(),
  };
}

// Fill missing city names from coordinates using the GeoNames table
async function fillCities(rows) {
  for (const r of rows) {
    if (r.city !== 'Not specified' || r.latitude == null) continue;
    const { data } = await supabase.rpc('nearest_city', { lat: r.latitude, lng: r.longitude });
    if (data?.[0]) { r.city = data[0].name; r.state = r.state || data[0].admin1; r.city_geoname_id = data[0].geoname_id; r.is_published = true; }
  }
}

export async function importCountry(countryInput, { startedBy = null, dryRun = false, log = () => {} } = {}) {
  const country = await countryInfo(countryInput);
  let runId = null;
  if (!dryRun) {
    const { data } = await supabase.from('import_runs')
      .insert({ kind: 'universities', params: { country: country.code || country.name }, started_by: startedBy }).select('id').single();
    runId = data?.id;
  }
  const finish = async (patch) => runId && supabase.from('import_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', runId);

  try {
    log(`Fetching Hipolabs list for ${country.name}…`);
    const hipo = await fetchHipolabs(country.name).catch((e) => { log(`Hipolabs failed: ${e.message}`); return []; });
    log(`Hipolabs: ${hipo.length}. Fetching Wikidata…`);
    const wiki = country.code ? await fetchWikidata(country.code).catch((e) => { log(`Wikidata failed: ${e.message}`); return []; }) : [];
    log(`Wikidata: ${wiki.length}. Merging…`);
    const rows = mergeSources(hipo, wiki, country);
    await fillCities(rows);

    // Skip anything an admin already created by hand (same website host or same name)
    const { data: existing } = await supabase.from('colleges').select('id, name, website, source, external_id, wikidata_id, city')
      .or(`country.eq."${country.name}",country_code.eq.${country.code || 'XX'}`).limit(20000);
    const manualHosts = new Set((existing || []).filter((e) => e.source === 'admin').map((e) => host(e.website || '')).filter(Boolean));
    const manualNames = new Set((existing || []).filter((e) => e.source === 'admin').map((e) => normName(e.name)));
    const manualWiki = new Set((existing || []).filter((e) => e.source === 'admin' && e.wikidata_id).map((e) => e.wikidata_id));
    const known = new Set((existing || []).filter((e) => e.source !== 'admin').map((e) => `${e.source}:${e.external_id}`));

    const toSave = rows.filter((r) => !manualHosts.has(host(r.website || '')) && !manualNames.has(normName(r.name)) && !(r.wikidata_id && manualWiki.has(r.wikidata_id)));
    const skipped = rows.length - toSave.length;
    const inserted = toSave.filter((r) => !known.has(`${r.source}:${r.external_id}`)).length;
    const updated = toSave.length - inserted;
    if (dryRun) return { country, total: rows.length, inserted, updated, skipped, sample: toSave.slice(0, 5) };

    // Two rows from different sources could share one wikidata id — keep the first
    const seenWiki = new Set();
    for (const r of toSave) { if (r.wikidata_id) { if (seenWiki.has(r.wikidata_id)) r.wikidata_id = null; else seenWiki.add(r.wikidata_id); } }

    // New rows are inserted whole. Rows imported before only get their source data refreshed:
    // slug (URLs), publish state and anything an admin typed in (fees, description…) are kept,
    // and a city the admin filled in is never replaced by "Not specified".
    const newRows = toSave.filter((r) => !known.has(`${r.source}:${r.external_id}`));
    const refresh = toSave.filter((r) => known.has(`${r.source}:${r.external_id}`)).map((r) => {
      const { slug, is_published, ...rest } = r;
      if (!rest.logo_url) delete rest.logo_url;
      if (!rest.cover_url) delete rest.cover_url;
      return rest;
    });
    const groups = [
      ['insert', newRows],
      ['refresh-with-city', refresh.filter((r) => r.city !== 'Not specified')],
      ['refresh-no-city', refresh.filter((r) => r.city === 'Not specified').map(({ city, state, ...r }) => r)],
    ];
    for (const [label, list] of groups) {
      // supabase-js needs the same columns in every row of one request → group by column set
      const byShape = new Map();
      for (const r of list) { const k = Object.keys(r).sort().join(','); (byShape.get(k) || byShape.set(k, []).get(k)).push(r); }
      for (const shape of byShape.values()) {
        for (let i = 0; i < shape.length; i += 500) {
          const chunk = shape.slice(i, i + 500);
          const { error } = await supabase.from('colleges').upsert(chunk, { onConflict: 'source,external_id' });
          if (error) throw error;
        }
      }
      if (list.length) log(`${label}: ${list.length}`);
    }
    await finish({ status: 'done', inserted, updated, skipped, message: `Hipolabs ${hipo.length}, Wikidata ${wiki.length}` });
    return { country, total: rows.length, inserted, updated, skipped };
  } catch (e) {
    await finish({ status: 'failed', message: e.message });
    throw e;
  }
}
