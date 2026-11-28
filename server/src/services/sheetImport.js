import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { supabase } from '../supabase.js';
import { slugify } from '../schemas.js';
import { countryRow, cityLocator, typeFromManagement, upsertColleges, dropManualDuplicates } from './collegeUpsert.js';

// Bulk college import from a spreadsheet (CSV / XLSX).
// Built for the official AISHE "All Colleges" list (India, ~48,000 colleges) but works with any sheet:
// the admin maps columns once in the UI, we guess the mapping from header names.

export const TARGETS = {
  name: 'College name *',
  external_id: 'Unique code (AISHE code / ID)',
  state: 'State / province',
  district: 'District',
  city: 'City / town',
  address: 'Address',
  website: 'Website',
  established: 'Year established',
  management: 'Management / ownership',
  type: 'College type',
  affiliated_to: 'Affiliated university',
  phone: 'Phone',
  email: 'Email',
  latitude: 'Latitude',
  longitude: 'Longitude',
  fees_min: 'Fees (min)',
  fees_max: 'Fees (max)',
  streams: 'Streams / courses (comma list)',
  description: 'Description',
};

const GUESS = [
  ['external_id', /aishe|^code$|college.?code|inst.*code|^id$|unique/i],
  ['name', /^(college|institution|institute|university)?\s*name|name of (the )?(college|institution)|^college$|^institution$/i],
  ['state', /state|province|region/i],
  ['district', /district/i],
  ['city', /^city|town|location name|^place/i],
  ['address', /address/i],
  ['website', /web|url|site/i],
  ['established', /estab|founded|year of (est|start)|^year$/i],
  ['management', /man[ae]g|owner|governance/i],
  ['type', /type|category|kind/i],
  ['affiliated_to', /affiliat|university name|parent univ/i],
  ['phone', /phone|mobile|contact no|tel/i],
  ['email', /e-?mail/i],
  ['latitude', /^lat/i],
  ['longitude', /^(lon|lng)/i],
  ['fees_min', /fee.*min|min.*fee|^fees?$/i],
  ['fees_max', /fee.*max|max.*fee/i],
  ['streams', /stream|discipline|courses?|programmes?/i],
  ['description', /descr|about/i],
];

export function guessMapping(headers) {
  const used = new Set();
  const map = {};
  for (const [target, re] of GUESS) {
    const h = headers.find((x) => !used.has(x) && re.test(String(x).trim()));
    if (h) { map[target] = h; used.add(h); }
  }
  return map;
}

const cellText = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.hyperlink) return String(v.hyperlink);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
};

// Many government sheets have a title line before the header row: pick the first row that looks like headers
function pickHeaderRow(matrix) {
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const cells = matrix[i].map((c) => String(c || '').trim()).filter(Boolean);
    if (cells.length >= 3 && cells.some((c) => /name/i.test(c))) return i;
  }
  return 0;
}

const cellHtml = (s) => String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&#39;|&#039;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
export function htmlTable(html) {
  let best = [];
  for (const t of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = [...t[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((tr) => [...tr[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => cellHtml(m[1])))
      .filter((r) => r.some(Boolean));
    if (rows.length > best.length) best = rows;
  }
  return best;
}

export async function parseSheet(buffer, filename) {
  let matrix = [];
  if (/\.xlsx$/i.test(filename)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets.find((w) => w.rowCount > 1) || wb.worksheets[0];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = row.values.slice(1).map(cellText);
      matrix.push(vals);
    });
  } else if (/\.(csv|txt|tsv)$/i.test(filename)) {
    const text = buffer.toString('utf8').replace(/^﻿/, '');
    const delimiter = /\.tsv$/i.test(filename) || (text.split('\n')[0].split('\t').length > text.split('\n')[0].split(',').length) ? '\t' : ',';
    matrix = parseCsv(text, { delimiter, relax_column_count: true, skip_empty_lines: true });
  } else if (/\.html?$/i.test(filename)) {
    // an official results page saved from the browser (e.g. JoSAA "Opening and Closing Ranks"): use its biggest table
    matrix = htmlTable(buffer.toString('utf8'));
    if (!matrix.length) throw new Error('No table found in this HTML page');
  } else {
    throw new Error('Upload a .xlsx, .csv or saved .html page (old .xls: open in Excel and “Save as” .xlsx)');
  }
  const h = pickHeaderRow(matrix);
  const headers = matrix[h].map((x, i) => String(x || '').trim() || `Column ${i + 1}`);
  const rows = matrix.slice(h + 1)
    .filter((r) => r.some((c) => String(c || '').trim()))
    .map((r) => Object.fromEntries(headers.map((k, i) => [k, String(r[i] ?? '').trim()])));
  return { headers, rows };
}

// In-memory store between "preview" and "import" (30 minutes)
const uploads = new Map();
export function stashUpload(data) {
  const token = crypto.randomBytes(12).toString('hex');
  uploads.set(token, { ...data, at: Date.now() });
  for (const [k, v] of uploads) if (Date.now() - v.at > 30 * 60e3) uploads.delete(k);
  return token;
}
export const getUpload = (token) => uploads.get(token);

const toYear = (v) => { const m = /(1[6-9]\d\d|20\d\d)/.exec(String(v || '')); return m ? Number(m[1]) : null; };
const toNum = (v) => { const n = Number(String(v || '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) && String(v || '').trim() !== '' ? n : null; };
const titleCase = (s) => String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Of|And|For|The|In)\b/g, (m) => m.toLowerCase());
const cleanSite = (s) => { const v = String(s || '').trim(); if (!v || !/\./.test(v)) return null; return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`; };

// AISHE publishes three lists — universities (U-codes), colleges (C-) and standalone institutions (S-).
export function detectAisheKind(headers) {
  const h = headers.map((x) => String(x).toLowerCase());
  if (h.some((x) => /standalone type/.test(x))) return { kind: 'Standalone institution', typeCol: headers[h.findIndex((x) => /standalone type/.test(x))] };
  if (h.some((x) => /college type/.test(x))) return { kind: 'College', typeCol: headers[h.findIndex((x) => /college type/.test(x))] };
  if (h.some((x) => /university type/.test(x))) return { kind: 'University', typeCol: headers[h.findIndex((x) => /university type/.test(x))] };
  return null;
}

export async function importSheet({ token, mapping, country, source = 'upload', publish = true, titleCaseNames = true, startedBy = null, log = () => {} }) {
  const up = getUpload(token);
  if (!up) throw new Error('Upload expired — upload the file again');
  if (!mapping?.name) throw new Error('Map the “College name” column');
  const ctry = await countryRow(country);
  if (!ctry) throw new Error('Choose the country of this list');
  const src = slugify(source || 'upload').slice(0, 20) || 'upload';

  const { data: run } = await supabase.from('import_runs')
    .insert({ kind: 'sheet', params: { file: up.filename, country: ctry.code || ctry.name, source: src, rows: up.rows.length }, started_by: startedBy })
    .select('id').single();
  const finish = (patch) => run && supabase.from('import_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', run.id);

  try {
    const locate = await cityLocator(ctry.code);
    const aishe = detectAisheKind(up.headers);
    const locCol = up.headers.find((x) => /^location$/i.test(String(x).trim()));   // AISHE: Urban / Rural
    const get = (r, k) => (mapping[k] ? String(r[mapping[k]] ?? '').trim() : '');
    const seen = new Set();
    let bad = 0;
    const rows = [];
    for (const r of up.rows) {
      let name = get(r, 'name').replace(/\s+/g, ' ');
      if (!name || name.length < 3) { bad++; continue; }
      if (titleCaseNames && name === name.toUpperCase()) name = titleCase(name);
      const state = titleCaseNames && get(r, 'state') === get(r, 'state').toUpperCase() ? titleCase(get(r, 'state')) : get(r, 'state');
      const district = titleCaseNames && get(r, 'district') === get(r, 'district').toUpperCase() ? titleCase(get(r, 'district')) : get(r, 'district');
      const cityRaw = get(r, 'city');
      const city = (titleCaseNames && cityRaw === cityRaw.toUpperCase() ? titleCase(cityRaw) : cityRaw) || district;
      const ext = get(r, 'external_id') || slugify(`${name} ${district} ${state}`).slice(0, 120);
      if (seen.has(ext)) continue;
      seen.add(ext);
      const loc = (toNum(get(r, 'latitude')) != null) ? null : locate(city, state, district) || locate(null, state, district);
      const lat = toNum(get(r, 'latitude')) ?? loc?.latitude ?? null;
      const lng = toNum(get(r, 'longitude')) ?? loc?.longitude ?? null;
      const management = get(r, 'management') || null;
      const streams = get(r, 'streams') ? get(r, 'streams').split(/[,;|]/).map((s) => s.trim()).filter(Boolean).slice(0, 12) : undefined;
      const facts = {};
      if (aishe) { facts.institution = aishe.kind; if (r[aishe.typeCol]) facts.category = String(r[aishe.typeCol]).trim(); }
      if (locCol && /^(urban|rural)$/i.test(String(r[locCol] || '').trim())) facts.area = titleCase(String(r[locCol]).trim());
      const cityName = cityRaw ? city : (loc?.name || district);
      const hash = crypto.createHash('sha1').update(`${src}:${ext}`).digest('hex').slice(0, 6);
      rows.push({
        source: src, external_id: ext, name,
        slug: `${slugify(`${name} ${cityName || state || ctry.name}`).slice(0, 70)}-${hash}`,
        country: ctry.name, country_code: ctry.code, state: state || null, district: district || null,
        city: cityName || 'Not specified', city_geoname_id: loc?.geoname_id || null,
        address: get(r, 'address') || null, website: cleanSite(get(r, 'website')),
        established: toYear(get(r, 'established')), management,
        type: typeFromManagement(management) !== 'Other' ? typeFromManagement(management)
          : typeFromManagement(get(r, 'type') || (aishe ? r[aishe.typeCol] : '')),
        affiliated_to: get(r, 'affiliated_to') || null,
        phone: get(r, 'phone') || null, email: get(r, 'email') || null,
        latitude: lat, longitude: lng,
        fees_min: toNum(get(r, 'fees_min')), fees_max: toNum(get(r, 'fees_max')),
        currency: ctry.currency_code || null,
        ...(streams ? { streams } : {}),
        description: get(r, 'description') || null,
        ...(Object.keys(facts).length ? { facts } : {}),
        is_published: Boolean(publish && (city || state)),
        data_updated_at: new Date().toISOString(),
      });
    }
    const { keep, skipped } = await dropManualDuplicates(rows, ctry.name);
    log(`${keep.length} colleges to save (${skipped} already added by your team, ${bad} rows without a name)`);
    const { inserted, updated } = await upsertColleges(keep, { log });
    await finish({ status: 'done', inserted, updated, skipped, message: `${up.filename}: ${up.rows.length} rows, ${bad} without name` });
    uploads.delete(token);
    return { inserted, updated, skipped, bad };
  } catch (e) {
    await finish({ status: 'failed', message: e.message });
    throw e;
  }
}
