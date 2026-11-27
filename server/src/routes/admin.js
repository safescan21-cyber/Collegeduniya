import { Router } from 'express';
import multer from 'multer';
import { importDiscoverUni, importEter } from '../services/europe.js';
import { importAisheList } from '../services/aisheList.js';
import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { importCountry } from '../services/universities.js';
import { runAutofill, runReviewInvites, autofillStatus, kickAutofill } from '../services/collegeAutofill.js';
import { collectExamNews, sendExamNewsDigests, examNewsStatus } from '../services/examNews.js';
import { runHealthChecks, healthStatus, sendTestAlert } from '../services/health.js';
import { importCricos } from '../services/cricos.js';
import { spawnLeidenImport } from '../services/leiden.js';
import { importCoursesSheet, guessCourseMapping, COURSE_TARGETS } from '../services/coursesSheet.js';
import { errorReport, markResolved } from '../services/errorWatch.js';
import { runFix, fixHistory, actionList } from '../services/autoFix.js';
import { loadStatus } from '../services/loadGuard.js';
import { parseSheet, guessMapping, stashUpload, importSheet, TARGETS } from '../services/sheetImport.js';
import { importScorecard, scorecardEnabled } from '../services/scorecard.js';
import { lookupCollege, applyLookup, enrichMany } from '../services/wikimedia.js';
import { importCutoffs, importRankings } from '../services/rankingsImport.js';
import { shareLead } from '../services/leadShare.js';
import { paymentsEnabled } from '../services/payments.js';
import { mailEnabled } from '../services/mailer.js';
import { providersStatus } from '../services/jobs.js';
import { providerName } from '../services/translate.js';
import {
  schemas, slugify, pointsGrant, mockSettings, reviewUpdateV2, collegeBulk, applicationUpdate, userUpdate, moderation,
} from '../schemas.js';

const router = Router();
router.use(requireAdmin);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (res, error, code = 400) => res.status(code).json({ error: error.message || String(error) });
const page = (req) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 500);
  const pageNo = Math.max(parseInt(req.query.page, 10) || 1, 1);
  return { from: (pageNo - 1) * limit, to: pageNo * limit - 1 };
};
const term = (q) => String(q || '').replace(/[%,()*"]/g, ' ').trim().slice(0, 80);

// Apply simple equality filters from the query string (only whitelisted keys)
function applyFilters(q, query, keys) {
  for (const k of keys) {
    const v = query[k];
    if (v === undefined || v === '') continue;
    if (v === 'true' || v === 'false') q = q.eq(k, v === 'true');
    else q = q.eq(k, v);
  }
  return q;
}

// ---------------------------------------------------------------- me
router.get('/me', (req, res) => res.json({ profile: req.profile }));

// ---------------------------------------------------------------- stats
router.get('/stats', wrap(async (_req, res) => {
  const now = Date.now();
  const iso = (days) => new Date(now - days * 864e5).toISOString();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const count = async (table, build = (q) => q) => {
    const { count: c, error } = await build(supabase.from(table).select('*', { count: 'exact', head: true }));
    if (error) return 0; // table may not exist yet if migration 002 not run
    return c || 0;
  };

  const [colleges, hostels, jobs, openJobs, users, reviews, pendingReviews, applications, pendingApps,
    visitsToday, visits7, visits30, visitsAll, signups7, newLeads, leads, collegeApps, newCollegeApps,
    pendingHostels, pendingJobs, questions, subscribers, quotaSeats, quotaApps, newQuotaApps] = await Promise.all([
    count('colleges'), count('hostels'), count('jobs'),
    count('jobs', (q) => q.eq('status', 'open')),
    count('profiles'), count('reviews'),
    count('reviews', (q) => q.eq('status', 'pending')),
    count('job_applications'),
    count('job_applications', (q) => q.eq('status', 'pending')),
    count('site_visits', (q) => q.gte('created_at', startOfToday.toISOString())),
    count('site_visits', (q) => q.gte('created_at', iso(7))),
    count('site_visits', (q) => q.gte('created_at', iso(30))),
    count('site_visits'),
    count('profiles', (q) => q.gte('created_at', iso(7))),
    count('leads', (q) => q.eq('status', 'new')),
    count('leads'),
    count('college_applications'),
    count('college_applications', (q) => q.eq('status', 'submitted')),
    count('hostels', (q) => q.eq('approval_status', 'pending')),
    count('jobs', (q) => q.eq('approval_status', 'pending')),
    count('questions'),
    count('newsletter_subscribers', (q) => q.eq('unsubscribed', false)),
    count('quota_seats', (q) => q.eq('status', 'open')),
    count('quota_applications'),
    count('quota_applications', (q) => q.eq('status', 'submitted')),
  ]);

  const { data: recent, error } = await supabase
    .from('site_visits')
    .select('visitor_id, path, created_at')
    .gte('created_at', iso(30))
    .order('created_at', { ascending: false })
    .limit(50000);
  if (error) throw error;

  const daily = {};
  for (let i = 29; i >= 0; i--) daily[new Date(now - i * 864e5).toISOString().slice(0, 10)] = { visits: 0, visitors: new Set() };
  const pages = {};
  const uniq30 = new Set();
  const uniqToday = new Set();
  for (const v of recent || []) {
    const d = v.created_at.slice(0, 10);
    if (daily[d]) { daily[d].visits++; daily[d].visitors.add(v.visitor_id); }
    uniq30.add(v.visitor_id);
    if (new Date(v.created_at) >= startOfToday) uniqToday.add(v.visitor_id);
    const p = (v.path || '/').split('?')[0];
    pages[p] = (pages[p] || 0) + 1;
  }

  res.json({
    totals: {
      colleges, hostels, jobs, openJobs, users, reviews, pendingReviews, applications, pendingApps, signups7,
      newLeads, leads, collegeApps, newCollegeApps, pendingHostels, pendingJobs, questions, subscribers,
      quotaSeats, quotaApps, newQuotaApps,
    },
    visits: {
      today: visitsToday, last7: visits7, last30: visits30, allTime: visitsAll,
      uniqueToday: uniqToday.size, unique30: uniq30.size,
    },
    daily: Object.entries(daily).map(([date, v]) => ({ date, visits: v.visits, visitors: v.visitors.size })),
    topPages: Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, views]) => ({ path, views })),
  });
}));

// ---------------------------------------------------------------- integrations & imports
router.get('/integrations', (_req, res) => res.json({
  jobs: providersStatus(),
  translate: providerName(),
  ai_chat: Boolean(process.env.ANTHROPIC_API_KEY),
  scorecard: scorecardEnabled(),
  payments: paymentsEnabled(),
  email: mailEnabled(),
  overpass: true, nominatim: true, hipolabs: true, wikidata: true,
}));

router.get('/import/runs', wrap(async (_req, res) => {
  const { data, error } = await supabase.from('import_runs').select('*').order('created_at', { ascending: false }).limit(30);
  if (error) return fail(res, error);
  res.json({ data });
}));

router.get('/import/preview', wrap(async (req, res) => {
  const r = await importCountry(req.query.country, { dryRun: true });
  res.json({ data: r });
}));

// Starts the import in the background and returns at once; progress is in /import/runs
router.post('/import/universities', wrap(async (req, res) => {
  const country = String(req.body?.country || '').trim();
  if (!country) return fail(res, new Error('country is required (e.g. IN or India)'));
  const { data: running } = await supabase.from('import_runs').select('id').eq('status', 'running')
    .gte('created_at', new Date(Date.now() - 30 * 60e3).toISOString()).limit(1);
  if (running?.length) return fail(res, new Error('Another import is running — wait for it to finish'), 409);
  importCountry(country, { startedBy: req.user.id, log: (m) => console.log(`[import ${country}] ${m}`) })
    .then(() => kickAutofill())
    .catch((e) => console.error(`[import ${country}]`, e.message));
  res.status(202).json({ ok: true, message: `Import for ${country} started` });
}));

// Spreadsheet import (AISHE list or any CSV/XLSX): 1) upload → preview + guessed mapping, 2) commit
const sheetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024, files: 1 } });
router.post('/import/sheet/preview', sheetUpload.single('file'), wrap(async (req, res) => {
  if (!req.file) return fail(res, new Error('Choose a .xlsx or .csv file'));
  const { headers, rows } = await parseSheet(req.file.buffer, req.file.originalname);
  if (!rows.length) return fail(res, new Error('No rows found in the file'));
  const token = stashUpload({ filename: req.file.originalname, headers, rows });
  res.json({ token, filename: req.file.originalname, headers, rowCount: rows.length, sample: rows.slice(0, 8), mapping: guessMapping(headers), targets: TARGETS });
}));

router.post('/import/sheet/commit', wrap(async (req, res) => {
  const { token, mapping, country, source, publish, titleCaseNames } = req.body || {};
  if (!token || !mapping?.name || !country) return fail(res, new Error('token, mapping.name and country are required'));
  importSheet({ token, mapping, country, source, publish: publish !== false, titleCaseNames: titleCaseNames !== false, startedBy: req.user.id,
    log: (m) => console.log(`[sheet] ${m}`) }).then(() => kickAutofill()).catch((e) => console.error('[sheet]', e.message));
  res.status(202).json({ ok: true, message: 'Import started — progress shows under “Recent imports”.' });
}));

router.post('/import/scorecard', wrap(async (req, res) => {
  if (!scorecardEnabled()) return fail(res, new Error('Set COLLEGE_SCORECARD_API_KEY in server/.env (free at api.data.gov/signup)'));
  importScorecard({ startedBy: req.user.id, log: (m) => console.log(`[scorecard] ${m}`) }).then(() => kickAutofill()).catch((e) => console.error('[scorecard]', e.message));
  res.status(202).json({ ok: true, message: 'US import started (≈6,000 colleges, a few minutes).' });
}));

// Official European data: UK Discover Uni (HESA, CC BY 4.0) and ETER (European Tertiary Education Register)
const ukZip = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024, files: 1 } });
router.post('/import/uk', ukZip.single('file'), wrap(async (req, res) => {
  importDiscoverUni({ zipBuffer: req.file?.buffer || null, startedBy: req.user.id, log: (m) => console.log(`[discover-uni] ${m}`) })
    .then(() => kickAutofill()).catch((e) => console.error('[discover-uni]', e.message));
  res.status(202).json({ ok: true, message: 'UK import started (≈400 providers, ≈30,000 courses; 5–15 minutes). Progress shows under “Recent imports”.' });
}));
// JoSAA seat matrix (IIT / NIT / IIIT / GFTI programmes + seats). Optional upload: the seat-matrix page saved from a browser
// ("Save page as… → HTML only") if josaa.admissions.nic.in refuses the server.
router.post('/import/josaa', sheetUpload.single('file'), wrap(async (req, res) => {
  const { importJosaa } = await import('../services/josaa.js');
  const html = req.file?.buffer ? req.file.buffer.toString('utf8') : null;
  importJosaa({ startedBy: req.user.id, html, log: (m) => console.log(`[josaa] ${m}`) }).then(() => kickAutofill()).catch((e) => console.error('[josaa]', e.message));
  res.status(202).json({ ok: true, message: 'JoSAA import started (≈1,000 programmes at ≈138 institutes, about a minute). Progress shows under “Recent imports”.' });
}));
router.post('/import/aishe-list', wrap(async (req, res) => {
  importAisheList({ startedBy: req.user.id, log: (m) => console.log(`[aishe] ${m}`) }).then(() => kickAutofill()).catch((e) => console.error('[aishe]', e.message));
  res.status(202).json({ ok: true, message: 'India import started (≈70,000 institutions, 5–10 minutes). Progress shows under “Recent imports”.' });
}));
router.post('/import/nirf-bundled', wrap(async (req, res) => {
  const { importNirf } = await import('../services/nirf.js');
  res.json({ data: await importNirf({ startedBy: req.user.id, log: (m) => console.log(`[nirf] ${m}`) }) });
}));
// NIRF institution data sheets → courses (with seats), placements (3 batches), scores. Runs in the background.
router.post('/import/nirf-data', wrap(async (req, res) => {
  const { importNirfData } = await import('../services/nirfData.js');
  const year = Number(req.body?.year) || 2025;
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : null;
  const limit = Number(req.body?.limit) || null;
  importNirfData({ year, categories, limit, startedBy: req.user.id, log: (m) => console.log(`[nirf-data] ${m}`) }).catch((e) => console.error('[nirf-data]', e.message));
  res.status(202).json({ ok: true, message: `Reading NIRF ${year} data sheets in the background (about 1,500 institutions, 20–40 minutes). Progress shows under “Recent imports”.` });
}));
router.post('/import-codes', requireSuperAdmin, wrap(async (req, res) => {
  const { createImportCode } = await import('../services/importCodes.js');
  const purpose = String(req.body?.purpose || 'nirf');
  if (purpose !== 'nirf') return fail(res, new Error('Unknown purpose'), 400);
  res.json(createImportCode(purpose, req.user.id));
}));
router.post('/import/nirf-sheet', wrap(async (req, res) => {
  const { importNirfSheet } = await import('../services/nirfData.js');
  const b = req.body || {};
  res.json(await importNirfSheet({ year: Number(b.year) || 2025, category: String(b.category || ''), pageUrl: b.pageUrl, row: b.row, pdfBase64: b.pdf || null }));
}));
// Australia — CRICOS courses with fees (newest snapshot from data.gov.au, or an uploaded .xlsx)
const cricosFile = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024, files: 1 } });
router.post('/import/cricos', cricosFile.single('file'), wrap(async (req, res) => {
  importCricos({ buffer: req.file?.buffer || null, startedBy: req.user.id, log: (m) => console.log(`[cricos] ${m}`) })
    .then(() => kickAutofill()).catch((e) => console.error('[cricos]', e.message));
  res.status(202).json({ ok: true, message: 'Australia import started (≈170 providers, ≈15,000 degree courses with fees; 5–15 minutes). Progress shows under “Recent imports”.' });
}));
// World research ranking — CWTS Leiden Ranking Open Edition (separate low-priority process; ~590 MB file)
router.post('/import/leiden', wrap(async (req, res) => {
  const { data: running } = await supabase.from('import_runs').select('id').eq('kind', 'leiden').eq('status', 'running').gte('created_at', new Date(Date.now() - 6 * 3600e3).toISOString()).limit(1);
  if (running?.length) return fail(res, new Error('The world ranking import is already running'), 409);
  const r = spawnLeidenImport({ year: Number(req.body?.year) || 2025, startedBy: req.user.id });
  res.status(202).json({ ok: true, message: `World ranking import started in the background (downloads ~590 MB, then reads it slowly so the site stays fast — 30–90 minutes). Progress shows under “Recent imports”.`, ...r });
}));
// Courses for any country from a spreadsheet: 1) upload → columns guessed, 2) check (dry run), 3) import
router.post('/import/courses-sheet/preview', sheetUpload.single('file'), wrap(async (req, res) => {
  if (!req.file) return fail(res, new Error('Choose a .xlsx or .csv file'));
  const { headers, rows } = await parseSheet(req.file.buffer, req.file.originalname);
  if (!rows.length) return fail(res, new Error('No rows found in the file'));
  const token = stashUpload({ filename: req.file.originalname, headers, rows });
  res.json({ token, filename: req.file.originalname, headers, rowCount: rows.length, sample: rows.slice(0, 5), mapping: guessCourseMapping(headers), targets: COURSE_TARGETS });
}));
router.post('/import/courses-sheet/commit', wrap(async (req, res) => {
  const { token, mapping, country, currency, dryRun } = req.body || {};
  if (dryRun) return res.json(await importCoursesSheet({ token, mapping, country, currency, dryRun: true }));
  importCoursesSheet({ token, mapping, country, currency, startedBy: req.user.id, log: (m) => console.log(`[courses-sheet] ${m}`) }).catch((e) => console.error('[courses-sheet]', e.message));
  res.status(202).json({ ok: true, message: 'Courses import started — progress shows under “Recent imports”.' });
}));
router.post('/import/eter', wrap(async (req, res) => {
  const countries = Array.isArray(req.body?.countries) ? req.body.countries.filter((c) => /^[A-Za-z]{2}$/.test(c)) : null;
  importEter({ countries, startedBy: req.user.id, log: (m) => console.log(`[eter] ${m}`) })
    .then(() => kickAutofill()).catch((e) => console.error('[eter]', e.message));
  res.status(202).json({ ok: true, message: 'Europe import started (≈3,000 institutions, a few minutes).' });
}));

// Free details & photos from Wikidata / Wikipedia / Wikimedia Commons
// GET  → preview what was found (nothing saved)   POST → save { overwrite, photoFiles:[…], fields:[…] }
const lastLookup = new Map();
router.get('/colleges/:id/enrich', wrap(async (req, res) => {
  const { data: c, error } = await supabase.from('colleges').select('id, name, short_name, website, country_code, city, wikidata_id').eq('id', req.params.id).single();
  if (error) return fail(res, error, 404);
  const wanted = req.query.wikidata_id ? { ...c, wikidata_id: String(req.query.wikidata_id).trim() } : c;
  const found = await lookupCollege(wanted);
  lastLookup.set(req.params.id, { found, at: Date.now() });
  res.json({ data: found });
}));

router.post('/colleges/:id/enrich', wrap(async (req, res) => {
  const cachedLookup = lastLookup.get(req.params.id);
  let found = cachedLookup && Date.now() - cachedLookup.at < 30 * 60e3 ? cachedLookup.found : null;
  if (!found) {
    const { data: c } = await supabase.from('colleges').select('id, name, short_name, website, country_code, city, wikidata_id').eq('id', req.params.id).single();
    found = await lookupCollege(c);
  }
  const { overwrite = false, photoFiles = null, fields = null } = req.body || {};
  const r = await applyLookup(req.params.id, found, { overwrite, photoFiles, fields });
  lastLookup.delete(req.params.id);
  const { data } = await supabase.from('colleges').select('*').eq('id', req.params.id).single();
  res.json({ data, applied: Object.keys(r.patch) });
}));

router.post('/enrich/batch', wrap(async (req, res) => {
  const { country = null, limit = 200, onlyMissingPhotos = true } = req.body || {};
  const { data: running } = await supabase.from('import_runs').select('id').eq('status', 'running').eq('kind', 'enrich')
    .gte('created_at', new Date(Date.now() - 6 * 3600e3).toISOString()).limit(1);
  if (running?.length) return fail(res, new Error('A photo/details batch is already running'), 409);
  enrichMany({ country, limit: Math.min(Number(limit) || 200, 5000), onlyMissingPhotos, startedBy: req.user.id, log: (m) => console.log(`[enrich] ${m}`) })
    .catch((e) => console.error('[enrich]', e.message));
  res.status(202).json({ ok: true, message: `Fetching details & photos for up to ${limit} colleges (about 5–10 seconds each).` });
}));

// Bulk actions on many colleges at once (publish / hide / feature / hide fields or sections / delete)
router.post('/colleges/bulk', wrap(async (req, res) => {
  const parsed = collegeBulk.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  const { ids, action, values = [] } = parsed.data;
  const simple = { publish: { is_published: true }, hide: { is_published: false }, feature: { is_featured: true }, unfeature: { is_featured: false } };
  if (simple[action]) {
    const { error } = await supabase.from('colleges').update(simple[action]).in('id', ids);
    if (error) return fail(res, error);
    return res.json({ ok: true, count: ids.length });
  }
  if (action === 'delete') {
    if (req.profile.role !== 'super_admin') return fail(res, new Error('Only a super admin can bulk-delete'), 403);
    const { error } = await supabase.from('colleges').delete().in('id', ids);
    if (error) return fail(res, error);
    return res.json({ ok: true, count: ids.length });
  }
  const col = action.endsWith('fields') ? 'hidden_fields' : 'hidden_sections';
  const allowed = schemas.colleges.shape[col].unwrap().element.options;
  const vals = values.filter((v) => allowed.includes(v));
  if (!vals.length) return fail(res, new Error('Choose at least one field or section'));
  const { data, error } = await supabase.from('colleges').select(`id, ${col}`).in('id', ids);
  if (error) return fail(res, error);
  const add = action.startsWith('hide');
  for (let i = 0; i < data.length; i += 25) {
    await Promise.all(data.slice(i, i + 25).map((r) => {
      const cur = new Set(r[col] || []);
      vals.forEach((v) => (add ? cur.add(v) : cur.delete(v)));
      return supabase.from('colleges').update({ [col]: Array.from(cur) }).eq('id', r.id);
    }));
  }
  res.json({ ok: true, count: data.length });
}));

// ---------------------------------------------------------------- uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpe?g|png|webp|gif|svg\+xml)$/.test(file.mimetype) ? cb(null, true) : cb(new Error('Only image files allowed')),
});

router.post('/upload', upload.array('files', 10), wrap(async (req, res) => {
  const folder = slugify(String(req.body.folder || 'misc')) || 'misc';
  const urls = [];
  for (const f of req.files || []) {
    const ext = (f.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, f.buffer, { contentType: f.mimetype, upsert: false });
    if (error) return fail(res, error);
    urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl);
  }
  res.json({ urls });
}));

// Documents (question papers, answer keys, notices): PDF only, 20 MB, into media/<folder>/
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => (file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Only PDF files allowed'))),
});

router.post('/upload-doc', uploadDoc.array('files', 5), wrap(async (req, res) => {
  const folder = slugify(String(req.body.folder || 'docs')) || 'docs';
  const urls = [];
  for (const f of req.files || []) {
    if (f.buffer.subarray(0, 5).toString() !== '%PDF-') return fail(res, new Error(`${f.originalname} is not a valid PDF`), 422);
    const base = slugify(f.originalname.replace(/\.pdf$/i, '')).slice(0, 50) || 'document';
    const path = `${folder}/${base}-${crypto.randomBytes(4).toString('hex')}.pdf`;
    const { error } = await supabase.storage.from('media').upload(path, f.buffer, { contentType: 'application/pdf', upsert: false });
    if (error) return fail(res, error);
    urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl);
  }
  res.json({ urls });
}));

// ---------------------------------------------------------------- rewards: manual points (bonus or correction)
router.post('/rewards/grant', wrap(async (req, res) => {
  const parsed = pointsGrant.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  const { data, error } = await supabase.from('reward_points')
    .insert({ user_id: parsed.data.user_id, points: parsed.data.points, reason: 'admin', note: `${parsed.data.note} — by ${req.profile.full_name || req.user.email}` })
    .select().single();
  if (error) return fail(res, error);
  res.status(201).json({ data });
}));

// ---------------------------------------------------------------- who is online now
router.get('/online', wrap(async (_req, res) => {
  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400e3).toISOString();
  const [{ data: live, error }, { count: today }] = await Promise.all([
    supabase.from('site_presence').select('session_id, user_id, path, city, region, country, device, first_seen, last_seen, profiles(full_name, email, username, account_type)')
      .gte('last_seen', cutoff).order('last_seen', { ascending: false }).limit(500),
    supabase.from('site_presence').select('session_id', { count: 'exact', head: true }).gte('last_seen', dayAgo),
  ]);
  if (error) return fail(res, error);
  const rows = live || [];
  const users = new Set(rows.filter((r) => r.user_id).map((r) => r.user_id));
  const byPage = {}; rows.forEach((r) => { byPage[r.path || '/'] = (byPage[r.path || '/'] || 0) + 1; });
  const byCity = {}; rows.forEach((r) => { if (r.city) byCity[r.city] = (byCity[r.city] || 0) + 1; });
  res.json({ online: rows.length, users: users.size, guests: rows.filter((r) => !r.user_id).length, sessions_24h: today || 0,
    pages: Object.entries(byPage).sort((a, b) => b[1] - a[1]).slice(0, 8), cities: Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 8), list: rows.slice(0, 100) });
}));
router.get('/users/:id/activity', wrap(async (req, res) => {
  const [l, m] = await Promise.all([
    supabase.from('login_events').select('*').eq('user_id', req.params.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('mock_attempts').select('id, title, status, score, max_score, percentile, started_at').eq('user_id', req.params.id).order('started_at', { ascending: false }).limit(20),
  ]);
  res.json({ logins: l.data || [], mocks: m.data || [] });
}));

// Nearby places diagnostics: GET /api/admin/nearby/test?lat=28.567&lng=77.21
router.get('/nearby/test', wrap(async (req, res) => {
  const geo = await import('../services/geo.js');
  const lat = Number(req.query.lat) || 28.5672; const lng = Number(req.query.lng) || 77.21;
  const report = {}; const t0 = Date.now();
  try {
    const rows = await (req.query.src === 'nominatim' ? geo.nominatimArea : geo.photonArea)(lat, lng, { report, force: true });
    const byKind = {}; for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    res.json({ ok: true, ms: Date.now() - t0, total: rows.length, byKind, errors: report.errors });
  } catch (e) { res.json({ ok: false, ms: Date.now() - t0, error: e.message, errors: report.errors }); }
}));

// ---------------------------------------------------------------- mock tests (AI question bank)
router.get('/mock/ai-status', wrap(async (_req, res) => {
  const { llmReady, llmProvider, llmModel } = await import('../services/llm.js');
  res.json({ ready: llmReady(), provider: llmProvider() || null, model: llmReady() ? llmModel() : null, check_model: llmReady() ? llmModel(true) : null });
}));
// AI provider pool (free tiers + paid + self-hosted)
router.get('/ai/providers', wrap(async (_req, res) => {
  const { providerStatus, pool } = await import('../services/llm.js');
  const { savedSecretNames } = await import('../services/secrets.js');
  const saved = await savedSecretNames();
  res.json({ data: providerStatus().map((p) => ({ ...p, saved_in_panel: saved[p.key_env] || null })), order: pool().map((p) => p.id) });
}));
// Save / remove a provider key from the admin panel (super admin only; the key is never sent back)
router.post('/ai/providers/:id/key', requireSuperAdmin, wrap(async (req, res) => {
  const { CATALOG, testProvider } = await import('../services/llm.js');
  const { saveSecret } = await import('../services/secrets.js');
  const p = CATALOG.find((x) => x.id === req.params.id);
  if (!p || ['ollama', 'custom'].includes(p.id)) return fail(res, new Error('Unknown provider'), 400);
  await saveSecret(p.key, req.body?.key, req.user.id);
  const test = await testProvider(p.id).catch((e) => ({ ok: false, error: e.message }));
  let autopilot = false;
  if (test.ok && req.body?.autopilot !== false) {
    await supabase.from('mock_settings').upsert({ id: 1, autopilot: true, updated_at: new Date().toISOString() });
    const { runAutopilot, autopilotRunning } = await import('../services/mockAutopilot.js');
    if (!autopilotRunning()) runAutopilot({ force: true }).catch((e) => console.error('[autopilot]', e.message));
    autopilot = true;
  }
  res.json({ ok: true, test, autopilot });
}));
// Job-search API keys (Jooble, Adzuna) saved from Admin → Import & APIs. Super admin; the key is never sent back.
router.get('/integrations/jobs-keys', wrap(async (_req, res) => {
  const { savedSecretNames } = await import('../services/secrets.js');
  const { providersStatus, joobleUsage } = await import('../services/jobs.js');
  const saved = await savedSecretNames();
  res.json({ jooble_site: process.env.JOOBLE_API_URL || 'https://jooble.org/api', jooble_usage: joobleUsage(), jooble_daily_max: Number(process.env.JOOBLE_DAILY_MAX || 15),
    status: { ...providersStatus(), scorecard: scorecardEnabled() }, saved: { JOOBLE_API_KEY: saved.JOOBLE_API_KEY || null, ADZUNA_APP_ID: saved.ADZUNA_APP_ID || null, ADZUNA_APP_KEY: saved.ADZUNA_APP_KEY || null, COLLEGE_SCORECARD_API_KEY: saved.COLLEGE_SCORECARD_API_KEY || null } });
}));
router.post('/integrations/jobs-keys', requireSuperAdmin, wrap(async (req, res) => {
  const { saveSecret, deleteSecret } = await import('../services/secrets.js');
  const { testJobsProvider } = await import('../services/jobs.js');
  const provider = ['adzuna', 'scorecard'].includes(req.body?.provider) ? req.body.provider : 'jooble';
  const keys = provider === 'jooble' ? { JOOBLE_API_KEY: req.body?.key, ...(req.body?.site ? { JOOBLE_API_URL: req.body.site } : {}) } : provider === 'scorecard' ? { COLLEGE_SCORECARD_API_KEY: req.body?.key }
    : { ADZUNA_APP_ID: req.body?.app_id, ADZUNA_APP_KEY: req.body?.key };
  for (const [n, v] of Object.entries(keys)) await saveSecret(n, v, req.user.id);
  const test = await (provider === 'scorecard' ? import('../services/scorecard.js').then((m) => m.testScorecardKey()) : testJobsProvider(provider))
    .catch((e) => ({ ok: false, error: e.message }));
  if (!test.ok) for (const n of Object.keys(keys)) await deleteSecret(n).catch(() => {});   // a key that doesn't work isn't kept
  let started = false;
  if (test.ok && provider === 'scorecard') {   // start the U.S. import straight away
    importScorecard({ startedBy: req.user.id, log: (m) => console.log(`[scorecard] ${m}`) }).then(() => kickAutofill()).catch((e) => console.error('[scorecard]', e.message));
    started = true;
  }
  res.json({ ok: test.ok, test, started });
}));
router.delete('/integrations/jobs-keys/:provider', requireSuperAdmin, wrap(async (req, res) => {
  const { deleteSecret } = await import('../services/secrets.js');
  const names = req.params.provider === 'adzuna' ? ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY'] : req.params.provider === 'scorecard' ? ['COLLEGE_SCORECARD_API_KEY'] : ['JOOBLE_API_KEY'];
  for (const n of names) await deleteSecret(n).catch(() => {});
  res.json({ ok: true });
}));
// Connect the email account that sends login codes and site emails (super admin only)
router.get('/email/status', wrap(async (_req, res) => {
  const { mailEnabled } = await import('../services/mailer.js');
  const from = process.env.MAIL_FROM || null;
  res.json({ enabled: mailEnabled(), from });
}));
// Last lines of the login service's log about email (super admin; secrets are masked)
router.get('/email/auth-log', requireSuperAdmin, wrap(async (_req, res) => {
  const { execFile } = await import('node:child_process');
  const { cleanEnv } = await import('../services/emailSetup.js');
  const dir = process.env.SUPABASE_DIR || '/opt/collegeolo-supabase';
  const out = await new Promise((resolve) => execFile('docker', ['compose', 'logs', '--no-color', '--tail', '400', 'auth'], { cwd: dir, timeout: 30000, maxBuffer: 8 << 20, env: cleanEnv() },
    (e, so, se) => resolve(String(so || '') + String(se || '') + (e ? `\n[exit] ${e.message}` : ''))));
  const lines = out.split('\n').filter((l) => /mail|smtp|template|error|fail|tls|dial|auth.*535|x509/i.test(l)).slice(-40)
    .map((l) => l.replace(/("?(password|pass|secret|key|token)"?\s*[:=]\s*)"?[^",\s]+/gi, '$1***').slice(0, 600));
  const env = await new Promise((resolve) => execFile('docker', ['compose', 'exec', '-T', 'auth', 'sh', '-c', 'echo host=$GOTRUE_SMTP_HOST port=$GOTRUE_SMTP_PORT user=$GOTRUE_SMTP_USER sender=$GOTRUE_SMTP_SENDER_NAME pass_len=${#GOTRUE_SMTP_PASS} tmpl=$GOTRUE_MAILER_TEMPLATES_MAGIC_LINK; wget -q -O /dev/null -T 10 "$GOTRUE_MAILER_TEMPLATES_MAGIC_LINK" && echo template_fetch=ok || echo template_fetch=FAILED'],
    { cwd: dir, timeout: 30000, env: cleanEnv() }, (e, so, se) => resolve(String(so || se || (e && e.message) || '').trim())));
  res.json({ env, lines });
}));
router.post('/email/reapply', requireSuperAdmin, wrap(async (_req, res) => {
  const { reapplyEmail } = await import('../services/emailSetup.js');
  res.json(await reapplyEmail());
}));
router.post('/email/setup', requireSuperAdmin, wrap(async (req, res) => {
  const { setupEmail } = await import('../services/emailSetup.js');
  const { email, password, host, port } = req.body || {};
  res.json(await setupEmail({ email, password, host, port, testTo: req.profile?.email || null, userId: req.user.id }));
}));
// Choose the model a provider uses (e.g. when the default has no free quota on this key)
router.post('/ai/providers/:id/model', requireSuperAdmin, wrap(async (req, res) => {
  const { CATALOG, testProvider } = await import('../services/llm.js');
  const { saveSecret } = await import('../services/secrets.js');
  const p = CATALOG.find((x) => x.id === req.params.id);
  if (!p || ['ollama', 'custom'].includes(p.id)) return fail(res, new Error('Unknown provider'), 400);
  const model = String(req.body?.model || '').replace(/^models\//, '');
  const test = await testProvider(p.id, model);
  if (!test.ok) return res.json({ ok: false, test });
  await saveSecret(p.id === 'anthropic' ? 'LLM_ANTHROPIC_MODEL' : `${p.id.toUpperCase()}_MODEL`, model, req.user.id);
  const { runAutopilot, autopilotRunning } = await import('../services/mockAutopilot.js');
  if (!autopilotRunning()) runAutopilot({ force: true }).catch((e) => console.error('[autopilot]', e.message));
  res.json({ ok: true, test });
}));
router.delete('/ai/providers/:id/key', requireSuperAdmin, wrap(async (req, res) => {
  const { CATALOG } = await import('../services/llm.js');
  const { deleteSecret } = await import('../services/secrets.js');
  const p = CATALOG.find((x) => x.id === req.params.id);
  if (!p) return fail(res, new Error('Unknown provider'), 400);
  await deleteSecret(p.key);
  res.json({ ok: true });
}));
router.post('/ai/providers/:id/test', wrap(async (req, res) => {
  const { testProvider } = await import('../services/llm.js');
  res.json(await testProvider(req.params.id, req.body?.model ? String(req.body.model).replace(/^models\//, '') : null));
}));
router.get('/ai/providers/:id/models', wrap(async (req, res) => {
  const { listModels } = await import('../services/llm.js');
  res.json({ data: await listModels(req.params.id).catch((e) => { throw Object.assign(e, { status: 502 }); }) });
}));
router.post('/mock/blueprint-draft', wrap(async (req, res) => {
  const slug = String(req.body?.exam_slug || '');
  const { draftBlueprint } = await import('../services/mockGen.js');
  res.json({ data: await draftBlueprint(slug) });
}));
router.post('/mock/generate', wrap(async (req, res) => {
  const b = req.body || {};
  const { generateQuestions } = await import('../services/mockGen.js');
  res.json(await generateQuestions({ slug: String(b.exam_slug || ''), section: String(b.section || ''), topic: b.topic ? String(b.topic) : null,
    difficulty: ['easy', 'medium', 'hard'].includes(b.difficulty) ? b.difficulty : 'mixed', count: parseInt(b.count, 10) || 10 }));
}));
router.post('/mock/generate-bank', wrap(async (req, res) => {
  const { startBankJob } = await import('../services/mockGen.js');
  res.status(202).json(startBankJob({ slug: String(req.body?.exam_slug || ''), perTopic: Math.max(1, Math.min(10, parseInt(req.body?.per_topic, 10) || 3)) }));
}));
router.get('/mock/jobs/:id', wrap(async (req, res) => {
  const { jobStatus } = await import('../services/mockGen.js');
  const j = jobStatus(req.params.id);
  if (!j) return fail(res, new Error('Job not found (finished jobs are kept for 6 hours)'), 404);
  res.json(j);
}));
// ---- autopilot (AI does the work; admins spot-check)
router.get('/mock/settings', wrap(async (_req, res) => {
  const { data, error } = await supabase.from('mock_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return fail(res, error);
  res.json({ data });
}));
router.patch('/mock/settings', wrap(async (req, res) => {
  const parsed = mockSettings.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  const { data, error } = await supabase.from('mock_settings').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', 1).select().single();
  if (error) return fail(res, error);
  await supabase.from('mock_autopilot_log').insert({ action: 'settings', detail: `${req.profile.full_name || req.user.email}: ${JSON.stringify(parsed.data)}` });
  res.json({ data });
}));
router.post('/mock/autopilot/run', wrap(async (req, res) => {
  const { runAutopilot, autopilotRunning } = await import('../services/mockAutopilot.js');
  if (autopilotRunning()) return res.status(202).json({ running: true });
  runAutopilot({ force: true, only: req.body?.exam_slug || null }).catch((e) => console.error('[autopilot]', e.message));
  res.status(202).json({ running: true });
}));
router.get('/mock/autopilot/status', wrap(async (_req, res) => {
  const { autopilotRunning } = await import('../services/mockAutopilot.js');
  const [{ data: banks, error }, { data: logRows }] = await Promise.all([
    supabase.rpc('mock_bank_status'),
    supabase.from('mock_autopilot_log').select('*').order('created_at', { ascending: false }).limit(60),
  ]);
  if (error) return fail(res, error);
  res.json({ running: autopilotRunning(), banks, log: logRows || [] });
}));
// spot-check: admin confirms or rejects auto-approved questions
router.post('/mock/spot-check', wrap(async (req, res) => {
  const ids = (req.body?.ids || []).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 200);
  const ok = req.body?.verdict === 'ok';
  if (!ids.length) return fail(res, new Error('ids required'), 422);
  const { error } = await supabase.from('mock_questions').update(ok ? { checked_by_admin: true } : { checked_by_admin: true, status: 'rejected', ai_review: 'Rejected by admin spot-check' }).in('id', ids);
  if (error) return fail(res, error);
  res.json({ ok: true, count: ids.length });
}));

router.post('/mock/papers/build', wrap(async (req, res) => {
  const { data, error } = await supabase.rpc('create_mock_papers', { p_exam: String(req.body?.exam_slug || ''), p_max_full: 10, p_max_sectional: 5, p_max_topic: 3, p_topic_size: Math.max(5, Math.min(30, parseInt(req.body?.topic_size, 10) || 10)) });
  if (error) return fail(res, error);
  res.json({ created: Number(data) || 0 });
}));
router.get('/mock/papers', wrap(async (req, res) => {
  let q = supabase.from('mock_papers').select('id, exam_slug, kind, number, title, section, topic, duration_min, is_published, created_at, question_ids').order('created_at', { ascending: false }).limit(300);
  if (req.query.exam_slug) q = q.eq('exam_slug', req.query.exam_slug);
  const { data, error } = await q;
  if (error) return fail(res, error);
  res.json({ data: (data || []).map(({ question_ids, ...p }) => ({ ...p, questions: question_ids.length })) });
}));
router.patch('/mock/papers/:id', wrap(async (req, res) => {
  const { error } = await supabase.from('mock_papers').update({ is_published: !!req.body?.is_published }).eq('id', req.params.id);
  if (error) return fail(res, error);
  res.json({ ok: true });
}));

router.post('/mock/bulk-questions', wrap(async (req, res) => {
  const ids = (req.body?.ids || []).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 500);
  const status = req.body?.status;
  if (!ids.length || !['approved', 'rejected', 'draft'].includes(status)) return fail(res, new Error('ids and status required'), 422);
  const { error } = await supabase.from('mock_questions').update({ status }).in('id', ids);
  if (error) return fail(res, error);
  res.json({ ok: true, count: ids.length });
}));

// Official fees (read from each college's own website) — review queue
router.get('/official-fees', wrap(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const { data, error, count } = await supabase.from('fee_findings')
    .select('id, course, level, fee, currency, period, fee_per_year, duration, quote, source_url, review_status, found_at, college:colleges(id, name, slug, city, country)', { count: 'exact' })
    .eq('review_status', status).order('found_at', { ascending: false }).range(Number(req.query.offset) || 0, (Number(req.query.offset) || 0) + 49);
  if (error) return fail(res, error);
  const { data: progress } = await supabase.rpc('fee_progress');
  res.json({ data, count, progress: progress || [] });
}));
router.post('/official-fees/:id/review', wrap(async (req, res) => {
  const status = req.body?.status === 'rejected' ? 'rejected' : 'approved';
  const { data: f, error } = await supabase.from('fee_findings').update({ review_status: status }).eq('id', req.params.id).select('college_id, course_id').single();
  if (error) return fail(res, error);
  if (status === 'rejected' && f.course_id) await supabase.from('courses').delete().eq('id', f.course_id);   // off the site at once
  await supabase.rpc('refresh_official_fee_range', { p_college: f.college_id });
  res.json({ ok: true });
}));
router.post('/official-fees/run', wrap(async (req, res) => {
  const { collectOfficialFees } = await import('../services/officialFees.js');
  res.json(await collectOfficialFees({ limit: Math.min(Number(req.query.limit) || 3, 10), collegeId: req.query.college || null }));
}));

// ---- student visa news (services/visaNews.js): list, hide/show, collect now; guides flagged "needs review"
router.get('/visa-news', wrap(async (req, res) => {
  let q = supabase.from('visa_news').select('id, country_code, title, url, source, official, topic, published_at, is_hidden', { count: 'exact' })
    .order('published_at', { ascending: false }).limit(150);
  if (req.query.country) q = q.eq('country_code', String(req.query.country).toUpperCase().slice(0, 2));
  if (req.query.official === '1') q = q.eq('official', true);
  const [{ data, count, error }, { data: guides }] = await Promise.all([q,
    supabase.from('visa_guides').select('country_code, title, updated_at, needs_review_since, review_reason').order('country_code')]);
  if (error) return fail(res, error);
  res.json({ data, count, guides: guides || [] });
}));
router.post('/visa-news/:id/hide', wrap(async (req, res) => {
  const { error } = await supabase.from('visa_news').update({ is_hidden: req.body?.hidden !== false }).eq('id', req.params.id);
  if (error) return fail(res, error);
  res.json({ ok: true });
}));
router.post('/visa-guides/:cc/reviewed', wrap(async (req, res) => {
  const { error } = await supabase.from('visa_guides').update({ needs_review_since: null, review_reason: null }).eq('country_code', String(req.params.cc).toUpperCase().slice(0, 2));
  if (error) return fail(res, error);
  res.json({ ok: true });
}));
router.post('/visa-news/collect', wrap(async (req, res) => {
  const { collectVisaNews } = await import('../services/visaNews.js');
  const only = req.query.country ? String(req.query.country).toUpperCase().slice(0, 2) : null;
  if (only) return res.json(await collectVisaNews({ only }));
  collectVisaNews().then((st) => console.log('[visa-news] admin run', st)).catch((e) => console.warn('[visa-news]', e.message));   // ~2 min: in the background
  res.json({ started: true });
}));

// ---- study news (services/studyNews.js): admissions, scholarships, colleges, policy, study abroad, skills
router.get('/study-news', wrap(async (req, res) => {
  let q = supabase.from('study_news').select('id, category, region, title, url, source, published_at, is_hidden', { count: 'exact' })
    .order('published_at', { ascending: false }).limit(150);
  if (req.query.category) q = q.eq('category', String(req.query.category).slice(0, 20));
  const { data, count, error } = await q;
  if (error) return fail(res, error);
  res.json({ data, count });
}));
router.post('/study-news/:id/hide', wrap(async (req, res) => {
  const { error } = await supabase.from('study_news').update({ is_hidden: req.body?.hidden !== false }).eq('id', req.params.id);
  if (error) return fail(res, error);
  res.json({ ok: true });
}));
router.post('/study-news/collect', wrap(async (_req, res) => {
  const { collectStudyNews } = await import('../services/studyNews.js');
  collectStudyNews().then((st) => console.log('[study-news] admin run', st)).catch((e) => console.warn('[study-news]', e.message));
  res.json({ started: true });
}));

// ---- college news (services/collegeNews.js)
router.get('/college-news', wrap(async (req, res) => {
  let q = supabase.from('college_news').select('id, title, url, source, published_at, is_hidden, college:colleges(id, name, slug)', { count: 'exact' })
    .order('published_at', { ascending: false }).limit(150);
  if (req.query.college) q = q.eq('college_id', String(req.query.college));
  const { data, count, error } = await q;
  if (error) return fail(res, error);
  const { count: covered } = await supabase.from('colleges').select('id', { count: 'exact', head: true }).not('news_checked_at', 'is', null);
  res.json({ data, count, covered: covered || 0 });
}));
router.post('/college-news/:id/hide', wrap(async (req, res) => {
  const { error } = await supabase.from('college_news').update({ is_hidden: req.body?.hidden !== false }).eq('id', req.params.id);
  if (error) return fail(res, error);
  res.json({ ok: true });
}));
router.post('/college-news/collect', wrap(async (_req, res) => {
  const { collectCollegeNews } = await import('../services/collegeNews.js');
  collectCollegeNews().then((st) => console.log('[college-news] admin run', st)).catch((e) => console.warn('[college-news]', e.message));
  res.json({ started: true });
}));

router.post('/exam-dates/collect', wrap(async (req, res) => {
  const { collectExamDates } = await import('../services/examDates.js');
  res.json(await collectExamDates({ limit: Math.min(Number(req.query.limit) || 5, 30) }));
}));

router.post('/job-alerts/run', wrap(async (req, res) => {
  const { runJobAlerts } = await import('../services/jobAlerts.js');
  res.json(await runJobAlerts({ dryRun: req.query.dry === '1' }));
}));

// ---------------------------------------------------------------- generic CRUD (content tables)
const crudConfig = {
  colleges:           { search: ['name', 'city', 'country', 'state', 'district'], filters: ['is_published', 'accepts_applications', 'country', 'source', 'country_code', 'state', 'is_featured'], order: 'created_at' },
  courses:            { search: ['name'], filters: ['college_id', 'level'], order: 'created_at' },
  places:             { search: ['name'], filters: ['college_id', 'kind'], order: 'created_at' },
  hostels:            { search: ['name', 'city', 'country'], filters: ['approval_status', 'is_published', 'college_id'], order: 'created_at' },
  jobs:               { search: ['title', 'company', 'city'], filters: ['approval_status', 'is_published', 'status', 'college_id'], order: 'created_at' },
  exams:              { search: ['short_name', 'full_name', 'stream'], filters: ['level', 'is_published'], order: 'created_at' },
  articles:           { search: ['title', 'excerpt'], filters: ['category', 'is_published'], order: 'published_at' },
  college_placements: { search: ['course'], filters: ['college_id', 'year'], order: 'year' },
  cutoffs:            { search: ['course'], filters: ['college_id', 'exam_slug', 'year', 'category'], order: 'year' },
  rank_bands:         { search: ['exam_slug', 'source'], filters: ['exam_slug', 'year', 'category'], order: 'year' },
  college_rankings:   { search: ['source', 'category'], filters: ['college_id', 'source', 'year', 'category'], order: 'year', select: '*, colleges(name, slug, city)' },
  scholarships:       { search: ['name', 'provider', 'field'], filters: ['host_country', 'is_published'], order: 'created_at' },
  visa_guides:        { search: ['title', 'country_code'], filters: ['is_published'], order: 'updated_at', key: 'country_code' },
  college_partners:   { search: ['contact_name', 'contact_email'], filters: ['is_active', 'auto_share'], order: 'created_at', key: 'college_id', select: '*, colleges(name, slug, city)' },
  promotions:         { search: ['note'], filters: ['item_type', 'item_id'], order: 'created_at' },
  exam_resources:     { search: ['title', 'exam_slug', 'session'], filters: ['exam_slug', 'kind', 'year', 'is_published'], order: 'created_at' },
  exam_dates:         { search: ['exam_slug', 'title', 'quote'], filters: ['exam_slug', 'event', 'is_published', 'review_status', 'origin'], order: 'date_start' },
  exam_stats:         { search: ['exam_slug', 'source'], filters: ['exam_slug', 'year'], order: 'year' },
  mock_blueprints:    { search: ['title', 'exam_slug'], filters: ['is_published'], order: 'updated_at', key: 'exam_slug' },
  mock_questions:     { search: ['stem', 'topic', 'section'], filters: ['exam_slug', 'section', 'status', 'ai_check', 'difficulty', 'source', 'auto_approved', 'checked_by_admin'], order: 'created_at' },
  reward_catalog:     { search: ['code', 'title'], filters: ['is_active'], order: 'created_at', key: 'code' },
  course_catalog:     { search: ['name', 'full_name', 'stream'], filters: ['level', 'is_published'], order: 'sort', key: 'slug' },
  quota_seats:        { search: ['course', 'academic_year'], filters: ['college_id', 'status', 'quota_type', 'level', 'is_published', 'open_to'], order: 'created_at',
                        select: '*, colleges(name, slug, city, country)' },
};

for (const [table, cfg] of Object.entries(crudConfig)) {
  const schema = schemas[table];

  router.get(`/${table}`, wrap(async (req, res) => {
    const { from, to } = page(req);
    let q = supabase.from(table).select(cfg.select || '*', { count: 'exact' }).order(cfg.order, { ascending: false }).range(from, to);
    q = applyFilters(q, req.query, cfg.filters);
    const t = term(req.query.q);
    if (t) q = q.or(cfg.search.map((c) => `${c}.ilike.%${t}%`).join(','));
    const { data, count, error } = await q;
    if (error) return fail(res, error);
    res.json({ data, count });
  }));

  router.get(`/${table}/:id`, wrap(async (req, res) => {
    const { data, error } = await supabase.from(table).select(cfg.select || '*').eq(cfg.key || 'id', req.params.id).single();
    if (error) return fail(res, error, 404);
    res.json({ data });
  }));

  router.post(`/${table}`, wrap(async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
    const row = parsed.data;
    if (table === 'colleges') { row.slug = slugify(row.slug || `${row.name}-${row.city}`); row.created_by = req.user.id; }
    if (table === 'exams') row.slug = slugify(row.slug || row.short_name);
    if (table === 'scholarships') row.slug = slugify(row.slug || row.name);
    if (table === 'promotions') { row.created_by = req.user.id; row.starts_at = row.starts_at || new Date().toISOString(); }
    if (table === 'articles') {
      row.slug = slugify(row.slug || row.title);
      row.author_id = req.user.id;
      row.author_name = row.author_name || req.profile.full_name || 'Collegeolo Team';
    }
    if (table === 'jobs' || table === 'quota_seats') row.created_by = req.user.id;
    if (['hostels', 'jobs'].includes(table) && !row.approval_status) row.approval_status = 'approved';
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) return fail(res, error);
    res.status(201).json({ data });
  }));

  router.patch(`/${table}/:id`, wrap(async (req, res) => {
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
    const row = parsed.data;
    if (row.slug) row.slug = slugify(row.slug);
    // Approving a submitted listing publishes it; rejecting hides it
    if (row.approval_status === 'approved' && row.is_published === undefined) row.is_published = true;
    if (row.approval_status === 'rejected') row.is_published = false;
    const { data, error } = await supabase.from(table).update(row).eq(cfg.key || 'id', req.params.id).select().single();
    if (error) return fail(res, error);
    res.json({ data });
  }));

  router.delete(`/${table}/:id`, wrap(async (req, res) => {
    const { error } = await supabase.from(table).delete().eq(cfg.key || 'id', req.params.id);
    if (error) return fail(res, error);
    res.json({ ok: true });
  }));
}

// ---------------------------------------------------------------- moderation tables (list / patch / delete)
const modConfig = {
  leads: {
    select: '*, colleges(name, slug), hostels(name)', filters: ['status', 'kind', 'college_id'],
    search: ['full_name', 'email', 'phone', 'city'],
  },
  college_applications: {
    select: '*, colleges(name, slug, city)', filters: ['status', 'college_id', 'batch_id'],
    search: ['full_name', 'email', 'phone', 'course'],
  },
  quota_applications: {
    select: '*, quota_seats(course, quota_type, academic_year, intake, fee_per_year, fee_period, currency), colleges(name, slug, city, country)',
    filters: ['status', 'college_id', 'seat_id', 'nationality'], search: ['full_name', 'email', 'phone', 'city', 'nationality'],
  },
  reports: { select: '*, profiles:reporter_id(full_name, email)', filters: ['status', 'target_type'], search: ['reason'] },
  college_members: { select: '*, colleges(name, slug), profiles(full_name, email)', filters: ['college_id', 'is_verified', 'relation'], search: ['course'] },
  roommate_posts: { select: '*, profiles(full_name, email)', filters: ['is_active', 'city'], search: ['city', 'about'] },
  hostel_visits: { select: '*, hostels(name, city)', filters: ['status', 'hostel_id'], search: ['name', 'phone'] },
  payments: { select: '*, profiles(full_name, email)', filters: ['status', 'item_type'], search: ['provider_order_id', 'provider_payment_id'] },
  questions: { select: '*, colleges(name, slug), profiles(full_name, email)', filters: ['status', 'college_id'], search: ['title'] },
  answers: { select: '*, questions(title), profiles(full_name, email)', filters: ['status', 'question_id'], search: ['body'] },
  hostel_reviews: { select: '*, hostels(name, city), profiles(full_name, email)', filters: ['status', 'hostel_id'], search: ['body'] },
  newsletter_subscribers: { select: '*', filters: ['unsubscribed'], search: ['email'] },
  companies: { select: '*, profiles(full_name, email, phone)', filters: ['is_verified'], search: ['name', 'city', 'country'] },
  reward_redemptions: { select: '*, profiles(full_name, email, phone), reward_catalog(title)', filters: ['status', 'user_id'], search: ['reward_code', 'voucher'] },
  ambassadors: { select: '*, profiles(full_name, email, phone, referral_code), colleges(name, slug)', filters: ['status', 'college_id'], search: ['college_name', 'city'], key: 'user_id' },
  mock_question_reports: { select: '*, mock_questions(id, exam_slug, section, stem, status), profiles(full_name, email)', filters: ['status', 'question_id'], search: ['reason'] },
  reward_points: { select: '*, profiles(full_name, email)', filters: ['status', 'reason', 'user_id'], search: ['reason', 'note'] },
  posts: { select: '*, profiles(full_name, email, username, college_id), colleges(name, slug)', filters: ['status', 'kind', 'user_id', 'college_id'], search: ['title', 'body', 'place'] },
  post_comments: { select: '*, profiles(full_name, email, username), posts(id, title, body)', filters: ['status', 'post_id', 'user_id'], search: ['body'] },
  content_reports: { select: '*, profiles:reporter_id(full_name, email)', filters: ['status', 'target_type', 'target_id'], search: ['reason'] },
  contact_messages: { select: '*', filters: ['status', 'topic'], search: ['full_name', 'email', 'message', 'about'] },
};

for (const [table, cfg] of Object.entries(modConfig)) {
  router.get(`/${table}`, wrap(async (req, res) => {
    const { from, to } = page(req);
    let q = supabase.from(table).select(cfg.select, { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    q = applyFilters(q, req.query, cfg.filters);
    const t = term(req.query.q);
    if (t) q = q.or(cfg.search.map((c) => `${c}.ilike.%${t}%`).join(','));
    const { data, count, error } = await q;
    if (error) return fail(res, error);
    res.json({ data, count });
  }));

  router.patch(`/${table}/:id`, wrap(async (req, res) => {
    const parsed = moderation[table].safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
    const { data, error } = await supabase.from(table).update(parsed.data).eq(cfg.key || 'id', req.params.id).select().single();
    if (error) return fail(res, error);
    res.json({ data });
  }));

  router.delete(`/${table}/:id`, wrap(async (req, res) => {
    const { error } = await supabase.from(table).delete().eq(cfg.key || 'id', req.params.id);
    if (error) return fail(res, error);
    res.json({ ok: true });
  }));
}

// CSV export for leads, applications and newsletter
router.get('/export/:table.csv', wrap(async (req, res) => {
  const allowed = { payments: '*', hostel_visits: '*', leads: '*', college_applications: '*', quota_applications: '*', newsletter_subscribers: '*', job_applications: '*' };
  const table = req.params.table;
  if (!allowed[table]) return fail(res, new Error('Not exportable'), 404);
  const { data, error } = await supabase.from(table).select(allowed[table]).order('created_at', { ascending: false }).limit(10000);
  if (error) return fail(res, error);
  const rows = data || [];
  const cols = rows.length ? Object.keys(rows[0]) : ['id'];
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${table}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + csv);
}));

// ---------------------------------------------------------------- college reviews moderation
router.get('/reviews', wrap(async (req, res) => {
  const { from, to } = page(req);
  let q = supabase
    .from('reviews')
    .select('*, colleges(name, slug), profiles(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  q = applyFilters(q, req.query, ['status', 'college_id', 'reward_status', 'is_verified']);
  const { data, count, error } = await q;
  if (error) return fail(res, error);
  res.json({ data, count });
}));

router.patch('/reviews/:id', wrap(async (req, res) => {
  const parsed = reviewUpdateV2.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  const row = { ...parsed.data };
  if (row.title || row.body || row.rating) row.edited_by_admin = true;
  const { data, error } = await supabase.from('reviews').update(row).eq('id', req.params.id).select().single();
  if (error) return fail(res, error);
  res.json({ data });
}));

// Signed link to the private proof (college ID / fee receipt) a reviewer uploaded
// Signed links (5 min) to the documents a student attached to a management-quota application
router.get('/quota_applications/:id/documents', wrap(async (req, res) => {
  const { data: a, error } = await supabase.from('quota_applications').select('documents').eq('id', req.params.id).single();
  if (error) return fail(res, error, 404);
  const files = [];
  for (const path of a.documents || []) {
    const { data } = await supabase.storage.from('resumes').createSignedUrl(path, 300);
    if (data?.signedUrl) files.push({ name: path.split('/').pop(), url: data.signedUrl });
  }
  res.json({ data: files });
}));

// ---------------------------------------------------------------- cutoffs & rankings from official sheets
router.post('/import/cutoffs', sheetUpload.single('file'), wrap(async (req, res) => {
  if (!req.file) return fail(res, new Error('Upload a .xlsx or .csv file'), 422);
  const { headers, rows } = await parseSheet(req.file.buffer, req.file.originalname);
  const { exam, year, round = 'Final', country = 'IN', source } = req.body || {};
  if (!exam || !year) return fail(res, new Error('Choose the exam and year'), 422);
  res.json({ data: await importCutoffs({ headers, rows, exam, year, round, country, source: source || req.file.originalname }) });
}));
router.post('/import/rankings', sheetUpload.single('file'), wrap(async (req, res) => {
  if (!req.file) return fail(res, new Error('Upload a .xlsx or .csv file'), 422);
  const { headers, rows } = await parseSheet(req.file.buffer, req.file.originalname);
  const { year, category = 'Overall', source = 'NIRF', country = 'IN', source_url } = req.body || {};
  if (!year) return fail(res, new Error('Choose the year'), 422);
  res.json({ data: await importRankings({ headers, rows, year, category, source, country, sourceUrl: source_url || null }) });
}));

// ---------------------------------------------------------------- leads → partner colleges
router.post('/leads/:id/share', wrap(async (req, res) => {
  const collegeId = req.body?.college_id;
  if (!collegeId) return fail(res, new Error('Choose a partner college'), 422);
  res.json(await shareLead(req.params.id, collegeId));
}));
router.get('/partners/summary', wrap(async (req, res) => {
  const since = req.query.since || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: partners, error } = await supabase.from('college_partners').select('*, colleges(name, slug, city)');
  if (error) return fail(res, error);
  const out = [];
  for (const p of partners || []) {
    const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('shared_with', p.college_id).gte('shared_at', since);
    out.push({ ...p, leads: count || 0, amount_due: (count || 0) * Number(p.lead_price || 0) });
  }
  res.json({ data: out, since });
}));

router.get('/reviews/:id/proof', wrap(async (req, res) => {
  const { data: r, error } = await supabase.from('reviews').select('proof_url').eq('id', req.params.id).single();
  if (error || !r?.proof_url) return fail(res, new Error('No proof uploaded'), 404);
  const { data, error: e2 } = await supabase.storage.from('resumes').createSignedUrl(r.proof_url, 300);
  if (e2) return fail(res, e2);
  res.json({ url: data.signedUrl });
}));

router.delete('/reviews/:id', wrap(async (req, res) => {
  const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
  if (error) return fail(res, error);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- job applications
router.get('/applications', wrap(async (req, res) => {
  const { from, to } = page(req);
  let q = supabase
    .from('job_applications')
    .select('*, jobs(title, company, city)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  q = applyFilters(q, req.query, ['status', 'job_id']);
  const { data, count, error } = await q;
  if (error) return fail(res, error);
  res.json({ data, count });
}));

router.patch('/applications/:id', wrap(async (req, res) => {
  const parsed = applicationUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  const { data, error } = await supabase.from('job_applications').update(parsed.data).eq('id', req.params.id).select().single();
  if (error) return fail(res, error);
  res.json({ data });
}));

router.get('/applications/:id/resume', wrap(async (req, res) => {
  const { data: app, error } = await supabase.from('job_applications').select('resume_path').eq('id', req.params.id).single();
  if (error || !app?.resume_path) return fail(res, new Error('No resume uploaded'), 404);
  const { data, error: e2 } = await supabase.storage.from('resumes').createSignedUrl(app.resume_path, 300);
  if (e2) return fail(res, e2);
  res.json({ url: data.signedUrl });
}));

// ---------------------------------------------------------------- users & admins
router.get('/users', wrap(async (req, res) => {
  const { from, to } = page(req);
  let q = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (req.query.role) q = q.eq('role', req.query.role);
  const t = term(req.query.q);
  if (t) q = q.or(`email.ilike.%${t}%,full_name.ilike.%${t}%,phone.ilike.%${t}%`);
  const { data, count, error } = await q;
  if (error) return fail(res, error);
  res.json({ data, count });
}));

// Block / unblock: any admin (but not other admins). Change role: super admin only.
router.patch('/users/:id', wrap(async (req, res, next) => {
  const parsed = userUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  if (req.params.id === req.user.id) return fail(res, new Error('You cannot change your own account here'), 403);

  const { data: target } = await supabase.from('profiles').select('role').eq('id', req.params.id).single();
  if (!target) return fail(res, new Error('User not found'), 404);

  const isSuper = req.profile.role === 'super_admin';
  if (parsed.data.role !== undefined && !isSuper) return requireSuperAdmin(req, res, next);
  if (!isSuper && target.role !== 'student') return fail(res, new Error('Only super admin can modify admins'), 403);

  const { data, error } = await supabase.from('profiles').update(parsed.data).eq('id', req.params.id).select().single();
  if (error) return fail(res, error);
  res.json({ data });
}));

// ---------------------------------------------------------------- selfie verifications (AI decides; admin sees the "review" ones)
router.get('/verifications', wrap(async (req, res) => {
  const status = ['review', 'verified', 'rejected', 'pending', 'expired'].includes(req.query.status) ? req.query.status : 'review';
  const { data, error } = await supabase.from('identity_verifications')
    .select('id, user_id, status, challenge, selfie_paths, ai, reason, decided_by, created_at, decided_at, profiles(full_name, email, username, gender, avatar_url, college_id, colleges(name))')
    .eq('status', status).order('created_at', { ascending: false }).limit(100);
  if (error) return fail(res, error);
  const rows = await Promise.all((data || []).map(async (r) => ({
    ...r,
    selfies: await Promise.all((r.selfie_paths || []).map(async (p) => (await supabase.storage.from('verification').createSignedUrl(p, 300)).data?.signedUrl || null)),
  })));
  res.json({ data: rows });
}));

router.post('/verifications/:id/decide', wrap(async (req, res) => {
  const approve = req.body?.approve === true;
  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : null;
  const { data: r } = await supabase.from('identity_verifications').select('id, user_id, selfie_paths').eq('id', req.params.id).maybeSingle();
  if (!r) return fail(res, new Error('Not found'), 404);
  const status = approve ? 'verified' : 'rejected';
  const reason = approve ? 'You are verified.' : (note || 'We could not verify these photos. Please try again with a clear profile photo of your face.');
  await supabase.from('identity_verifications').update({ status, reason, decided_by: 'admin', decided_at: new Date().toISOString(), selfie_paths: [] }).eq('id', r.id);
  await supabase.from('profiles').update({ verification: status, verified_at: approve ? new Date().toISOString() : null }).eq('id', r.user_id);
  if (r.selfie_paths?.length) await supabase.storage.from('verification').remove(r.selfie_paths);
  await supabase.from('notifications').insert({ user_id: r.user_id, kind: 'verification', title: approve ? 'You are verified ✔' : 'Verification not approved', body: reason, link: '/verify' });
  res.json({ ok: true, status });
}));

// remove the tick (e.g. after a report)
router.post('/users/:id/unverify', wrap(async (req, res) => {
  const { error } = await supabase.from('profiles').update({ verification: 'none', verified_at: null }).eq('id', req.params.id);
  if (error) return fail(res, error);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- report investigation: what was reported + the person's history
router.get('/content_reports/:id/context', wrap(async (req, res) => {
  const { data: rep } = await supabase.from('content_reports').select('*').eq('id', req.params.id).maybeSingle();
  if (!rep) return fail(res, new Error('Not found'), 404);
  let target = null; let userId = null; let messages = null;
  if (rep.target_type === 'post') {
    ({ data: target } = await supabase.from('posts').select('*').eq('id', rep.target_id).maybeSingle()); userId = target?.user_id;
  } else if (rep.target_type === 'comment') {
    ({ data: target } = await supabase.from('post_comments').select('*').eq('id', rep.target_id).maybeSingle()); userId = target?.user_id;
  } else if (rep.target_type === 'user') {
    userId = rep.target_id;
  } else if (rep.target_type === 'conversation') {
    ({ data: target } = await supabase.from('conversations').select('*').eq('id', rep.target_id).maybeSingle());
    if (target) {
      userId = target.user_a === rep.reporter_id ? target.user_b : target.user_a;
      ({ data: messages } = await supabase.from('messages').select('sender_id, body, created_at').eq('conversation_id', target.id).order('created_at', { ascending: false }).limit(100));
    }
  }
  const [{ data: user }, { count: reports }, { data: posts }] = userId ? await Promise.all([
    supabase.from('profiles').select('id, full_name, email, username, gender, verification, is_blocked, created_at, college_id, colleges(name)').eq('id', userId).maybeSingle(),
    supabase.from('content_reports').select('id', { count: 'exact', head: true }).or(`target_id.eq.${userId}`),
    supabase.from('posts').select('id, kind, title, body, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ]) : [{ data: null }, { count: 0 }, { data: [] }];
  res.json({ report: rep, target, user, user_reports: reports || 0, recent_posts: posts || [], messages: messages ? [...messages].reverse() : null });
}));

// ---------------------------------------------------------------- page quality for Google (migration 018): run after big imports
router.post('/seo/refresh', wrap(async (_req, res) => {
  const { data, error } = await supabase.rpc('refresh_seo', {});
  if (error) return fail(res, error);
  const { data: cities } = await supabase.rpc('refresh_city_counts');
  res.json({ data: { ...(data?.[0] || {}), cities_with_colleges: cities } });
}));

router.get('/contact_messages/count', wrap(async (_req, res) => {
  const { count } = await supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'open');
  res.json({ open: count || 0 });
}));

// ---------------------------------------------------------------- automatic photos & details + review invitations
router.get('/autofill/status', wrap(async (_req, res) => {
  const [{ count: waiting }, { count: withPhotos }, { count: total }, { count: invites }] = await Promise.all([
    supabase.from('colleges').select('id', { count: 'exact', head: true }).is('enriched_at', null),
    supabase.from('colleges').select('id', { count: 'exact', head: true }).not('cover_url', 'is', null),
    supabase.from('colleges').select('id', { count: 'exact', head: true }),
    supabase.from('review_invites').select('user_id', { count: 'exact', head: true }),
  ]);
  res.json({ ...autofillStatus(), waiting: waiting || 0, with_photos: withPhotos || 0, total: total || 0, invites_sent: invites || 0 });
}));
router.post('/autofill/run', wrap(async (_req, res) => {
  runAutofill({ reason: 'admin' }).catch(() => {});
  res.status(202).json({ ok: true, message: 'Started — it works through the colleges in the background.' });
}));
router.post('/review-invites/run', wrap(async (_req, res) => { res.json(await runReviewInvites()); }));

// ---------------------------------------------------------------- exam news alerts (migration 021)
router.get('/exam-news/status', wrap(async (_req, res) => {
  const [{ count: follows }, { count: emailOn }, { count: items }] = await Promise.all([
    supabase.from('exam_follows').select('user_id', { count: 'exact', head: true }),
    supabase.from('exam_follows').select('user_id', { count: 'exact', head: true }).eq('email', true),
    supabase.from('exam_news').select('id', { count: 'exact', head: true }),
  ]);
  res.json({ ...examNewsStatus(), follows: follows || 0, email_on: emailOn || 0, items: items || 0 });
}));
router.post('/exam-news/collect', wrap(async (req, res) => {
  const examId = req.body?.exam_id || null;
  if (examId) return res.json(await collectExamNews({ examId }));
  collectExamNews().catch((e) => console.warn('[exam-news]', e.message));
  res.status(202).json({ ok: true, message: 'Collecting news in the background (about 6 seconds per exam).' });
}));
router.post('/exam-news/digest', wrap(async (_req, res) => { res.json(await sendExamNewsDigests()); }));

// ---------------------------------------------------------------- system health (services/health.js)
router.get('/health', wrap(async (req, res) => {
  const s = healthStatus();
  const stale = !s.lastRun || Date.now() - Date.parse(s.lastRun) > 60e3;
  res.json(req.query.fresh === '1' || stale ? await runHealthChecks({ notify: false }) : s);
}));
router.post('/health/test-alert', wrap(async (_req, res) => { res.json(await sendTestAlert()); }));
// API errors with cause + fix, automatic repairs, and the repair buttons (services/errorWatch.js, autoFix.js)
router.get('/errors', wrap(async (_req, res) => {
  const [report, fixes] = await Promise.all([errorReport(), fixHistory()]);
  res.json({ ...report, fixes, actions: actionList(), load: loadStatus(), auto_fix: process.env.AUTO_FIX !== 'off' });
}));
router.post('/errors/resolve', wrap(async (req, res) => { res.json(await markResolved(req.body?.key || null)); }));
router.post('/fix/:action', requireSuperAdmin, wrap(async (req, res) => {
  res.json(await runFix(req.params.action, `started by hand by ${req.user?.email || 'an admin'}`, { manual: true }));
}));

export default router;
