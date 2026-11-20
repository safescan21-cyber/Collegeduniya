import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { fetchJson } from './http.js';

// Machine translation with a permanent cache in the `translations` table, so each
// unique sentence is paid for only once per language.
// Provider (first one configured wins):
//   GOOGLE_TRANSLATE_API_KEY  → Google Cloud Translation Basic v2 (first 500K chars / month free)
//   LIBRETRANSLATE_URL (+ LIBRETRANSLATE_API_KEY) → self-hosted / hosted LibreTranslate

export const LANGUAGES = [
  ['en', 'English'], ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['mr', 'मराठी'],
  ['gu', 'ગુજરાતી'], ['kn', 'ಕನ್ನಡ'], ['ml', 'മലയാളം'], ['pa', 'ਪੰਜਾਬੀ'], ['or', 'ଓଡ଼ିଆ'], ['ur', 'اردو'],
  ['ne', 'नेपाली'], ['si', 'සිංහල'], ['ar', 'العربية'], ['fa', 'فارسی'], ['tr', 'Türkçe'], ['ru', 'Русский'],
  ['uk', 'Українська'], ['de', 'Deutsch'], ['fr', 'Français'], ['es', 'Español'], ['pt', 'Português'], ['it', 'Italiano'],
  ['nl', 'Nederlands'], ['pl', 'Polski'], ['sv', 'Svenska'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['ja', '日本語'],
  ['ko', '한국어'], ['vi', 'Tiếng Việt'], ['th', 'ไทย'], ['id', 'Bahasa Indonesia'], ['ms', 'Bahasa Melayu'], ['fil', 'Filipino'],
  ['sw', 'Kiswahili'], ['am', 'አማርኛ'], ['he', 'עברית'],
];
const CODES = new Set(LANGUAGES.map(([c]) => c));
export const isSupported = (lang) => CODES.has(lang);

export function providerName() {
  if (process.env.GOOGLE_TRANSLATE_API_KEY) return 'google';
  if (process.env.LIBRETRANSLATE_URL) return 'libretranslate';
  return null;
}

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

async function google(texts, target, source) {
  const out = [];
  for (let i = 0; i < texts.length; i += 100) {
    const chunk = texts.slice(i, i + 100);
    const data = await fetchJson(`${process.env.GOOGLE_TRANSLATE_URL || 'https://translation.googleapis.com/language/translate/v2'}?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: chunk, target, source: source || undefined, format: 'text' }),
    });
    out.push(...(data?.data?.translations || []).map((t) => t.translatedText));
  }
  return out;
}

async function libre(texts, target, source) {
  const base = process.env.LIBRETRANSLATE_URL.replace(/\/$/, '');
  const data = await fetchJson(`${base}/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, source: source || 'auto', target: target.split('-')[0], format: 'text', api_key: process.env.LIBRETRANSLATE_API_KEY || undefined }),
  });
  const t = data?.translatedText;
  return Array.isArray(t) ? t : [t];
}

// Translate many strings. Returns array aligned with input. Unknown provider → returns originals.
export async function translateMany(texts, target, source) {
  if (!texts.length || !target || target === source) return texts;
  const provider = providerName();
  const clean = texts.map((t) => String(t ?? ''));
  const hashes = clean.map(sha1);
  const result = new Array(clean.length);

  const { data: hits } = await supabase.from('translations').select('source_hash, translated_text')
    .eq('lang', target).in('source_hash', Array.from(new Set(hashes)));
  const map = new Map((hits || []).map((h) => [h.source_hash, h.translated_text]));

  const missing = [];
  clean.forEach((t, i) => {
    if (!t.trim()) result[i] = t;
    else if (map.has(hashes[i])) result[i] = map.get(hashes[i]);
    else missing.push(i);
  });
  if (!missing.length) return result;
  if (!provider) { missing.forEach((i) => { result[i] = clean[i]; }); return result; }

  const uniq = Array.from(new Set(missing.map((i) => clean[i])));
  const translated = provider === 'google' ? await google(uniq, target, source) : await libre(uniq, target, source);
  const byText = new Map(uniq.map((t, k) => [t, translated[k] ?? t]));
  missing.forEach((i) => { result[i] = byText.get(clean[i]); });

  const rows = uniq.map((t) => ({ lang: target, source_hash: sha1(t), source_text: t.slice(0, 5000), translated_text: byText.get(t), provider }));
  supabase.from('translations').upsert(rows, { onConflict: 'lang,source_hash' }).then(() => {}, (e) => console.warn('[translate cache]', e.message));
  return result;
}
