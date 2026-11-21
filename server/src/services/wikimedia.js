import { supabase } from '../supabase.js';
import { USER_AGENT, throttle } from './http.js';
import { normName, host } from './collegeUpsert.js';

// Free college details & real photos from the Wikimedia projects (no API key):
//   Wikidata  → find the college, facts (founded, website, location, students), logo, main image, Commons category
//   Wikipedia → short "About" text (CC BY-SA) + link
//   Commons   → campus photo gallery with author + licence for each photo
// Wikimedia asks every app to identify itself (User-Agent with contact) and rate-limits anonymous traffic,
// so all calls here are sequential and throttled. Set WIKIMEDIA_ACCESS_TOKEN for higher limits.

const WIKIDATA = process.env.WIKIDATA_API_URL || 'https://www.wikidata.org/w/api.php';
const COMMONS = process.env.COMMONS_API_URL || 'https://commons.wikimedia.org/w/api.php';
const WIKIPEDIA_REST = process.env.WIKIPEDIA_REST_URL || 'https://{lang}.wikipedia.org/api/rest_v1';
const GAP = Number(process.env.WIKIMEDIA_MIN_GAP_MS || 800);
const EDU_TYPES = new Set(['Q3918', 'Q38723', 'Q189004', 'Q1371037', 'Q15936437', 'Q875538', 'Q902104', 'Q23002054', 'Q2385804', 'Q1664720',
  'Q3914', 'Q1188663', 'Q5341295', 'Q847027', 'Q15407956', 'Q494230', 'Q1365560', 'Q4671277', 'Q2467461', 'Q1663017']);
const PHOTO_WIDTH = 1280;   // standard thumbnail width (Wikimedia prefers standard sizes)

async function wm(url) {
  await throttle('wikimedia', GAP);
  const headers = { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, Accept: 'application/json' };
  if (process.env.WIKIMEDIA_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.WIKIMEDIA_ACCESS_TOKEN}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      if (res.status === 429 || res.status === 503) {
        const wait = Number(res.headers.get('retry-after')) * 1000 || 5000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
      return await res.json();
    } finally { clearTimeout(t); }
  }
  throw new Error('Wikimedia is rate-limiting — try again later or set WIKIMEDIA_ACCESS_TOKEN');
}

const claimIds = (e, p) => (e?.claims?.[p] || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
const claimStr = (e, p) => (e?.claims?.[p] || []).map((c) => c.mainsnak?.datavalue?.value).filter((v) => typeof v === 'string');
const claimFirst = (e, p) => e?.claims?.[p]?.find((c) => c.rank !== 'deprecated')?.mainsnak?.datavalue?.value;
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

const STOP = new Set(['of', 'the', 'and', 'for', '&', 'de', 'la', 'di', 'der', 'und']);
const tokens = (s) => normName(s).split(' ').filter((t) => t && !STOP.has(t));
function nameSimilarity(a, b) {
  const A = new Set(tokens(a)); const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let common = 0; A.forEach((t) => { if (B.has(t)) common++; });
  return common / Math.max(A.size, B.size);
}

async function getEntities(ids, props = 'claims|sitelinks|labels|descriptions|aliases') {
  if (!ids.length) return {};
  const p = new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props, languages: 'en', sitefilter: 'enwiki', format: 'json' });
  const data = await wm(`${WIKIDATA}?${p}`);
  return data?.entities || {};
}

// ---------------------------------------------------------------- 1. find the Wikidata item
export async function findEntity(college) {
  if (college.wikidata_id) {
    const ents = await getEntities([college.wikidata_id]);
    return ents[college.wikidata_id] ? { entity: ents[college.wikidata_id], score: 99, reason: 'saved id' } : null;
  }
  const names = Array.from(new Set([college.name, college.short_name].filter(Boolean)));
  const ids = new Set();
  for (const n of names) {
    const p = new URLSearchParams({ action: 'wbsearchentities', search: n, language: 'en', uselang: 'en', type: 'item', limit: '7', format: 'json' });
    const r = await wm(`${WIKIDATA}?${p}`);
    (r?.search || []).forEach((s) => ids.add(s.id));
  }
  if (!ids.size) return null;
  const ents = await getEntities(Array.from(ids));
  const countryIds = Array.from(new Set(Object.values(ents).flatMap((e) => claimIds(e, 'P17'))));
  const countries = await getEntities(countryIds, 'claims');
  const iso = (qid) => claimStr(countries[qid], 'P297')[0];

  const myHost = host(college.website || '');
  let best = null;
  for (const e of Object.values(ents)) {
    if (!e?.claims) continue;
    let score = 0; const why = [];
    const types = claimIds(e, 'P31');
    if (types.some((t) => EDU_TYPES.has(t)) || /universit|college|institut|school of|academy/i.test(e.descriptions?.en?.value || '')) { score += 3; why.push('education'); }
    else continue;
    const cc = claimIds(e, 'P17').map(iso).filter(Boolean);
    if (college.country_code && cc.includes(college.country_code)) { score += 3; why.push('country'); }
    else if (college.country_code && cc.length) score -= 5;
    const label = e.labels?.en?.value || '';
    const sim = Math.max(...names.map((n) => nameSimilarity(n, label)), ...(e.aliases?.en || []).map((a) => nameSimilarity(college.name, a.value)), 0);
    if (sim >= 0.99) { score += 4; why.push('name'); } else if (sim >= 0.6) { score += 2; why.push('similar name'); }
    const sites = claimStr(e, 'P856').map(host).filter(Boolean);
    if (myHost && sites.includes(myHost)) { score += 6; why.push('website'); }
    const desc = (e.descriptions?.en?.value || '').toLowerCase();
    if (college.city && college.city !== 'Not specified' && desc.includes(college.city.toLowerCase())) { score += 1; why.push('city'); }
    if (!why.includes('website') && sim < 0.6) continue;   // never match on country + type alone
    if (!best || score > best.score) best = { entity: e, score, reason: why.join(', ') };
  }
  return best && best.score >= 6 ? best : null;
}

// ---------------------------------------------------------------- 2. Wikipedia summary
export async function wikipediaSummary(title, lang = 'en') {
  await throttle('wikimedia', GAP);
  const res = await fetch(`${WIKIPEDIA_REST.replace('{lang}', lang)}/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, {
    headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const s = await res.json();
  if (s.type === 'disambiguation') return null;
  return { extract: s.extract || null, url: s.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`, image: s.originalimage?.source || null };
}

// ---------------------------------------------------------------- 3. Commons photos with credits
function credit(page) {
  const ii = page.imageinfo?.[0];
  if (!ii) return null;
  const m = ii.extmetadata || {};
  return {
    file: page.title,
    url: ii.thumburl || ii.url,
    full: ii.url,
    width: ii.thumbwidth || ii.width, height: ii.thumbheight || ii.height,
    mime: ii.mime,
    page: ii.descriptionurl,
    author: stripHtml(m.Artist?.value) || 'Unknown author',
    license: stripHtml(m.LicenseShortName?.value) || 'See source',
    license_url: m.LicenseUrl?.value || null,
    description: stripHtml(m.ImageDescription?.value).slice(0, 200) || null,
  };
}

const NOT_PHOTO = /logo|seal|emblem|crest|coat[_ ]of[_ ]arms|map|plan|signature|flag|icon|diagram|chart|\.svg$|\.pdf$|\.tif/i;

async function commonsFiles(params) {
  const p = new URLSearchParams({
    action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: String(PHOTO_WIDTH), iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|ImageDescription', ...params,
  });
  const data = await wm(`${COMMONS}?${p}`);
  return Object.values(data?.query?.pages || {}).map(credit).filter(Boolean);
}

export async function commonsPhotos({ category, mainImage, limit = 12 }) {
  const out = [];
  if (mainImage) out.push(...await commonsFiles({ titles: `File:${mainImage}` }));
  if (category) {
    out.push(...await commonsFiles({ generator: 'categorymembers', gcmtitle: `Category:${category}`, gcmtype: 'file', gcmlimit: '40' }));
  }
  const seen = new Set();
  return out.filter((f) => {
    if (seen.has(f.file)) return false;
    seen.add(f.file);
    return /^image\/(jpeg|png|webp)$/.test(f.mime || '') && (f.width || 0) >= 600 && !NOT_PHOTO.test(f.file);
  }).slice(0, limit);
}

async function commonsLogo(file) {
  if (!file) return null;
  const p = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '250',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl', titles: `File:${file}` });
  const data = await wm(`${COMMONS}?${p}`);
  const page = Object.values(data?.query?.pages || {})[0];
  return page ? credit(page) : null;
}

// ---------------------------------------------------------------- everything for one college
export async function lookupCollege(college) {
  const match = await findEntity(college);
  if (!match) return { matched: false };
  const e = match.entity;
  const enTitle = e.sitelinks?.enwiki?.title;
  const coord = claimFirst(e, 'P625');
  const inception = claimFirst(e, 'P571')?.time;
  const students = (e.claims?.P2196 || []).map((c) => Number(c.mainsnak?.datavalue?.value?.amount)).filter(Number.isFinite);
  const [summary, photos, logo] = [
    enTitle ? await wikipediaSummary(enTitle).catch(() => null) : null,
    await commonsPhotos({ category: claimStr(e, 'P373')[0], mainImage: claimStr(e, 'P18')[0] }).catch(() => []),
    await commonsLogo(claimStr(e, 'P154')[0]).catch(() => null),
  ];
  return {
    matched: true,
    score: match.score, reason: match.reason,
    wikidata_id: e.id,
    label: e.labels?.en?.value || null,
    wikidata_url: `https://www.wikidata.org/wiki/${e.id}`,
    wikipedia_url: summary?.url || null,
    description: summary?.extract || e.descriptions?.en?.value || null,
    description_is_wikipedia: Boolean(summary?.extract),
    website: claimStr(e, 'P856')[0] || null,
    established: inception ? Number(String(inception).replace(/^\+/, '').slice(0, 4)) || null : null,
    latitude: coord?.latitude ?? null, longitude: coord?.longitude ?? null,
    students_count: students.length ? Math.max(...students) : null,
    logo, photos,
  };
}

// Apply a lookup to the college row. By default only empty fields are filled.
export async function applyLookup(collegeId, found, { overwrite = false, photoFiles = null, fields = null } = {}) {
  const { data: c, error } = await supabase.from('colleges').select('*').eq('id', collegeId).single();
  if (error) throw error;
  const want = (f) => !fields || fields.includes(f);
  const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
  const patch = { enriched_at: new Date().toISOString(), enrich_status: found.matched ? 'matched' : 'no_match' };
  if (!found.matched) { await supabase.from('colleges').update(patch).eq('id', collegeId); return { patch }; }

  patch.wikidata_id = c.wikidata_id || found.wikidata_id;
  if (found.wikipedia_url) patch.wikipedia_url = found.wikipedia_url;
  if (want('description') && found.description && (overwrite || empty(c.description))) {
    patch.description = found.description;
    patch.description_source = found.description_is_wikipedia ? 'wikipedia' : 'wikidata';
  }
  for (const f of ['website', 'established', 'latitude', 'longitude', 'students_count']) {
    if (want(f) && found[f] != null && (overwrite || empty(c[f]))) patch[f] = found[f];
  }
  const credits = Array.isArray(c.photo_credits) ? [...c.photo_credits] : [];
  const addCredit = (p) => { if (!credits.some((x) => x.url === p.url)) credits.push({ url: p.url, author: p.author, license: p.license, license_url: p.license_url, page: p.page }); };
  if (want('logo') && found.logo && (overwrite || empty(c.logo_url))) { patch.logo_url = found.logo.url; addCredit(found.logo); }
  const chosen = (found.photos || []).filter((p) => !photoFiles || photoFiles.includes(p.file) || photoFiles.includes(p.url));
  if (want('photos') && chosen.length) {
    if (overwrite || empty(c.cover_url)) { patch.cover_url = chosen[0].url; }
    const existing = overwrite ? [] : (c.photos || []);
    patch.photos = Array.from(new Set([...existing, ...chosen.map((p) => p.url)])).slice(0, 24);
    chosen.forEach(addCredit);
  }
  patch.photo_credits = credits;
  // a college imported without a town (e.g. Wikidata was down) gets one from its coordinates and goes live
  const lat = patch.latitude ?? c.latitude; const lng = patch.longitude ?? c.longitude;
  if ((!c.city || c.city === 'Not specified') && lat != null && lng != null) {
    const { data: near } = await supabase.rpc('nearest_city', { lat, lng });
    if (near?.[0]) {
      patch.city = near[0].name; patch.state = c.state || near[0].admin1 || null; patch.city_geoname_id = near[0].geoname_id;
      if (!c.is_published && c.source !== 'manual') patch.is_published = true;
    }
  }
  if (c.wikidata_id && found.wikidata_id && c.wikidata_id !== found.wikidata_id) delete patch.wikidata_id;
  const { error: e2 } = await supabase.from('colleges').update(patch).eq('id', collegeId);
  if (e2) {
    // another college already uses this Wikidata id → save without it
    if (/wikidata/.test(e2.message)) { delete patch.wikidata_id; const r = await supabase.from('colleges').update(patch).eq('id', collegeId); if (r.error) throw r.error; }
    else throw e2;
  }
  return { patch };
}

export async function enrichOne(collegeId, opts = {}) {
  const { data: c, error } = await supabase.from('colleges').select('id, name, short_name, website, country_code, city, wikidata_id').eq('id', collegeId).single();
  if (error) throw error;
  const found = await lookupCollege(c);
  return applyLookup(collegeId, found, opts);
}

// Background batch: colleges never enriched first, featured/ranked first
export async function enrichMany({ country = null, limit = 200, onlyMissingPhotos = true, startedBy = null, log = () => {} } = {}) {
  const { data: run } = await supabase.from('import_runs').insert({ kind: 'enrich', params: { country: country || 'all', limit }, started_by: startedBy }).select('id').single();
  const finish = (patch) => run && supabase.from('import_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', run.id);
  let q = supabase.from('colleges').select('id, name, short_name, website, country_code, city, wikidata_id')
    .is('enriched_at', null).order('is_featured', { ascending: false }).order('ranking', { ascending: true, nullsFirst: false })
    .order('wikidata_id', { ascending: true, nullsFirst: false })        // colleges already linked to Wikidata almost always have photos
    .order('students_count', { ascending: false, nullsFirst: false })    // then the big ones
    .limit(Math.min(limit, 5000));
  if (country) q = country.length === 2 ? q.eq('country_code', country.toUpperCase()) : q.ilike('country', country);
  if (onlyMissingPhotos) q = q.is('cover_url', null);
  const { data: list, error } = await q;
  if (error) { await finish({ status: 'failed', message: error.message }); throw error; }
  let matched = 0; let missed = 0; let failed = 0;
  for (const [i, c] of (list || []).entries()) {
    try {
      const found = await lookupCollege(c);
      await applyLookup(c.id, found);
      if (found.matched) matched++; else missed++;
    } catch (e) {
      failed++;
      await supabase.from('colleges').update({ enrich_status: 'error', enriched_at: new Date().toISOString() }).eq('id', c.id);
      if (/rate-limiting/.test(e.message)) { await finish({ status: 'failed', inserted: matched, skipped: missed, message: e.message }); throw e; }
    }
    if (i % 10 === 0) { log(`${i + 1} / ${list.length} — ${matched} matched`); run && await supabase.from('import_runs').update({ inserted: matched, skipped: missed }).eq('id', run.id); }
  }
  await finish({ status: 'done', inserted: matched, skipped: missed, updated: 0, message: `${list?.length || 0} checked · ${matched} enriched · ${missed} not on Wikipedia/Wikidata · ${failed} errors` });
  return { checked: list?.length || 0, matched, missed, failed };
}
