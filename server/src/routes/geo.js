import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { searchCities, reverseCity, nearbyPlaces, NEARBY_KINDS, geocode, PendingError } from '../services/geo.js';
import { localJobs, providersStatus } from '../services/jobs.js';
import { translateMany, LANGUAGES, isSupported, providerName } from '../services/translate.js';
import { supabase } from '../supabase.js';
import { ratesFor } from '../services/fx.js';

const router = Router();
const limit = (n) => rateLimit({ windowMs: 60_000, limit: n, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, slow down a little.' } });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const num = (v) => (v === undefined || v === '' ? NaN : Number(v));
const validLatLng = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// GET /api/fx?base=GBP → { base, rates:{INR:…}, updated }  (cached 12 h, for "≈ fee in your currency")
router.get('/fx', limit(120), wrap(async (req, res) => {
  try { res.set('Cache-Control', 'public, max-age=21600').json({ data: await ratesFor(req.query.base) }); }
  catch (e) { res.status(503).json({ error: e.message }); }
}));

// GET /api/cities?q=pun&country=IN
router.get('/cities', limit(120), wrap(async (req, res) => {
  const lang = /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/.test(String(req.query.lang || '')) ? String(req.query.lang) : null;
  const rows = await searchCities(req.query.q, req.query.country, Math.min(Number(req.query.limit) || 10, 20), lang);
  res.set('Cache-Control', 'public, max-age=3600').json({ data: rows });
}));

// GET /api/cities/nearest?lat=..&lng=..
router.get('/cities/nearest', limit(60), wrap(async (req, res) => {
  const lat = num(req.query.lat); const lng = num(req.query.lng);
  if (!validLatLng(lat, lng)) return res.status(422).json({ error: 'lat/lng required' });
  res.json({ data: await reverseCity(lat, lng) });
}));

// GET /api/geocode?q=Kamla Nagar, Delhi  (used by PG owners / employers when posting)
router.get('/geocode', limit(20), wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  if (q.length < 3) return res.status(422).json({ error: 'Address too short' });
  res.json({ data: await geocode(q) });
}));

// GET /api/nearby?lat=..&lng=..&kind=hospital&radius=3000   (OpenStreetMap)
router.get('/nearby', limit(60), wrap(async (req, res) => {
  const lat = num(req.query.lat); const lng = num(req.query.lng);
  const kind = String(req.query.kind || 'hospital');
  if (!validLatLng(lat, lng)) return res.status(422).json({ error: 'lat/lng required' });
  if (!NEARBY_KINDS[kind]) return res.status(422).json({ error: `kind must be one of ${Object.keys(NEARBY_KINDS).join(', ')}` });
  try {
    const data = await nearbyPlaces(kind, lat, lng, req.query.radius);
    res.set('Cache-Control', 'public, max-age=86400').json({ data, attribution: '© OpenStreetMap contributors' });
  } catch (e) {
    if (e instanceof PendingError) return res.set('Cache-Control', 'no-store').json({ data: [], pending: true, attribution: '© OpenStreetMap contributors' });
    console.warn('[overpass]', e.message);
    res.set('Cache-Control', 'no-store').json({ data: [], error: 'Map data is busy right now — try again shortly.' });
  }
}));

// GET /api/local-jobs?city=Pune&country=IN&q=part time
router.get('/local-jobs', limit(40), wrap(async (req, res) => {
  const city = String(req.query.city || '').trim().slice(0, 80);
  const country = String(req.query.country || '').trim().slice(0, 2).toUpperCase();
  const what = String(req.query.q || 'part time').trim().slice(0, 80);
  let countryName = String(req.query.country_name || '').slice(0, 80);
  if (!countryName && country) {
    const { data } = await supabase.from('countries').select('name').eq('code', country).maybeSingle();
    countryName = data?.name || '';
  }
  const result = await localJobs({ city, country, countryName, what });
  res.set('Cache-Control', 'public, max-age=1800').json(result);
}));

router.get('/integrations/public', (_req, res) => res.json({ jobs: providersStatus(), translate: Boolean(providerName()) }));

// Languages for the picker
router.get('/languages', (_req, res) => res.set('Cache-Control', 'public, max-age=86400')
  .json({ data: LANGUAGES.map(([code, name]) => ({ code, name, rtl: ['ar', 'ur', 'fa', 'he'].includes(code) })), translate: Boolean(providerName()) }));

// POST /api/translate { texts: string[], target: 'ta', source?: 'en' }
const translateSchema = z.object({
  texts: z.array(z.string().max(5000)).min(1).max(300),
  target: z.string().min(2).max(6),
  source: z.string().min(2).max(6).optional(),
});
router.post('/translate', limit(60), wrap(async (req, res) => {
  const parsed = translateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Send { texts: [...], target }' });
  const { texts, target, source } = parsed.data;
  if (!isSupported(target)) return res.status(422).json({ error: 'Language not supported' });
  const total = texts.reduce((n, t) => n + t.length, 0);
  if (total > 20000) return res.status(413).json({ error: 'Too much text in one request' });
  try {
    const out = await translateMany(texts, target, source); // no source → provider auto-detects
    res.json({ data: out, provider: providerName() });
  } catch (e) {
    console.warn('[translate]', e.message);
    res.json({ data: texts, provider: null, error: 'Translation unavailable right now' });
  }
}));

export default router;
