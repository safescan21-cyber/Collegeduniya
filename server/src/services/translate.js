import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { fetchJson } from './http.js';

// Machine translation with a permanent cache in the `translations` table, so each
// unique sentence is paid for only once per language.
// Provider (first one configured wins):
//   GOOGLE_TRANSLATE_API_KEY  → Google Cloud Translation Basic v2 (first 500K chars / month free)
//   LIBRETRANSLATE_URL (+ LIBRETRANSLATE_API_KEY) → self-hosted / hosted LibreTranslate

export const LANGUAGES = [
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["bn", "বাংলা"],
  ["ta", "தமிழ்"],
  ["te", "తెలుగు"],
  ["mr", "मराठी"],
  ["gu", "ગુજરાતી"],
  ["kn", "ಕನ್ನಡ"],
  ["ml", "മലയാളം"],
  ["pa", "ਪੰਜਾਬੀ"],
  ["or", "ଓଡ଼ିଆ"],
  ["ur", "اردو"],
  ["as", "অসমীয়া"],
  ["mai", "मैथिली"],
  ["bho", "भोजपुरी"],
  ["sa", "संस्कृतम्"],
  ["gom", "कोंकणी"],
  ["doi", "डोगरी"],
  ["mni-Mtei", "ꯃꯤꯇꯩꯂꯣꯟ"],
  ["lus", "Mizo ṭawng"],
  ["sd", "سنڌي"],
  ["ne", "नेपाली"],
  ["si", "සිංහල"],
  ["dv", "ދިވެހި"],
  ["ar", "العربية"],
  ["fa", "فارسی"],
  ["ps", "پښتو"],
  ["ckb", "کوردیی ناوەندی"],
  ["ku", "Kurdî"],
  ["he", "עברית"],
  ["yi", "ייִדיש"],
  ["ug", "ئۇيغۇرچە"],
  ["tr", "Türkçe"],
  ["az", "Azərbaycan"],
  ["uz", "Oʻzbek"],
  ["kk", "Қазақ"],
  ["ky", "Кыргызча"],
  ["tk", "Türkmen"],
  ["tg", "Тоҷикӣ"],
  ["tt", "Татар"],
  ["mn", "Монгол"],
  ["ru", "Русский"],
  ["uk", "Українська"],
  ["be", "Беларуская"],
  ["pl", "Polski"],
  ["cs", "Čeština"],
  ["sk", "Slovenčina"],
  ["sl", "Slovenščina"],
  ["hr", "Hrvatski"],
  ["bs", "Bosanski"],
  ["sr", "Српски"],
  ["mk", "Македонски"],
  ["bg", "Български"],
  ["ro", "Română"],
  ["hu", "Magyar"],
  ["el", "Ελληνικά"],
  ["sq", "Shqip"],
  ["hy", "Հայերեն"],
  ["ka", "ქართული"],
  ["lt", "Lietuvių"],
  ["lv", "Latviešu"],
  ["et", "Eesti"],
  ["fi", "Suomi"],
  ["sv", "Svenska"],
  ["no", "Norsk"],
  ["da", "Dansk"],
  ["is", "Íslenska"],
  ["de", "Deutsch"],
  ["nl", "Nederlands"],
  ["fy", "Frysk"],
  ["lb", "Lëtzebuergesch"],
  ["fr", "Français"],
  ["co", "Corsu"],
  ["es", "Español"],
  ["ca", "Català"],
  ["eu", "Euskara"],
  ["gl", "Galego"],
  ["pt", "Português"],
  ["it", "Italiano"],
  ["mt", "Malti"],
  ["la", "Latina"],
  ["ga", "Gaeilge"],
  ["gd", "Gàidhlig"],
  ["cy", "Cymraeg"],
  ["eo", "Esperanto"],
  ["zh-CN", "简体中文"],
  ["zh-TW", "繁體中文"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["vi", "Tiếng Việt"],
  ["th", "ไทย"],
  ["lo", "ລາວ"],
  ["km", "ខ្មែរ"],
  ["my", "မြန်မာ"],
  ["id", "Bahasa Indonesia"],
  ["ms", "Bahasa Melayu"],
  ["jv", "Basa Jawa"],
  ["su", "Basa Sunda"],
  ["fil", "Filipino"],
  ["ceb", "Cebuano"],
  ["ilo", "Ilokano"],
  ["hmn", "Hmoob"],
  ["mi", "Māori"],
  ["sm", "Gagana Samoa"],
  ["haw", "ʻŌlelo Hawaiʻi"],
  ["mg", "Malagasy"],
  ["sw", "Kiswahili"],
  ["am", "አማርኛ"],
  ["ti", "ትግርኛ"],
  ["om", "Afaan Oromoo"],
  ["so", "Soomaali"],
  ["ha", "Hausa"],
  ["yo", "Yorùbá"],
  ["ig", "Igbo"],
  ["ak", "Akan"],
  ["ee", "Eʋegbe"],
  ["kri", "Krio"],
  ["bm", "Bamanankan"],
  ["ln", "Lingála"],
  ["lg", "Luganda"],
  ["rw", "Kinyarwanda"],
  ["ny", "Chichewa"],
  ["sn", "chiShona"],
  ["st", "Sesotho"],
  ["nso", "Sepedi"],
  ["ts", "Xitsonga"],
  ["xh", "isiXhosa"],
  ["zu", "isiZulu"],
  ["af", "Afrikaans"],
  ["ht", "Kreyòl ayisyen"],
  ["qu", "Runasimi"],
  ["ay", "Aymar aru"],
  ["gn", "Avañe'ẽ"],
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
  let translated;
  try {
    translated = provider === 'google' ? await google(uniq, target, source) : await libre(uniq, target, source);
  } catch (e) {
    // e.g. LibreTranslate doesn't offer this language → show the original text, don't cache
    console.warn(`[translate] ${provider} → ${target}: ${e.message}`);
    missing.forEach((i) => { result[i] = clean[i]; });
    return result;
  }
  const byText = new Map(uniq.map((t, k) => [t, translated[k] ?? t]));
  missing.forEach((i) => { result[i] = byText.get(clean[i]); });

  const rows = uniq.map((t) => ({ lang: target, source_hash: sha1(t), source_text: t.slice(0, 5000), translated_text: byText.get(t), provider }));
  supabase.from('translations').upsert(rows, { onConflict: 'lang,source_hash' }).then(() => {}, (e) => console.warn('[translate cache]', e.message));
  return result;
}
