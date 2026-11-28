import { cookies, headers } from 'next/headers';
import { LANG_COOKIE, isLang, EN, HI, type Dict, type DictKey, type Lang } from './i18n';

const API = (process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const dicts = new Map<string, Dict>();          // per-process cache of machine-translated UI text
const pending = new Map<string, Promise<Dict>>();

// Pick language: cookie → browser Accept-Language → English
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(v)) return v as string;
  const accept = (await headers()).get('accept-language') || '';
  for (const part of accept.split(',')) {
    const code = part.split(';')[0].trim();
    if (isLang(code)) return code;
    const base = code.split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

async function fetchDict(lang: string): Promise<Dict> {
  const keys = Object.keys(EN) as DictKey[];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${API}/api/translate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ texts: keys.map((k) => EN[k]), target: lang, source: 'en' }),
    });
    clearTimeout(timer);
    const body = await res.json();
    if (!res.ok || !Array.isArray(body.data) || !body.provider) return EN;   // no provider configured → English
    const d = {} as Dict;
    keys.forEach((k, i) => { d[k] = body.data[i] || EN[k]; });
    dicts.set(lang, d);
    return d;
  } catch {
    return EN;
  }
}

export async function getDict(lang: Lang): Promise<Dict> {
  if (lang === 'en') return EN;
  if (lang === 'hi') return HI;
  if (dicts.has(lang)) return dicts.get(lang)!;
  if (!pending.has(lang)) pending.set(lang, fetchDict(lang).finally(() => pending.delete(lang)));
  return pending.get(lang)!;
}

export async function getT() {
  const lang = await getLang();
  const dict = await getDict(lang);
  return { lang, dict, t: (k: DictKey) => dict[k] ?? EN[k] };
}
