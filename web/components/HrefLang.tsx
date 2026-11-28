import { headers } from 'next/headers';
import { LANGUAGES } from '@/lib/i18n';
import { SITE_URL } from '@/lib/format';

const PRIVATE = /^\/(admin|dashboard|login|owner|employer|offline)(\/|$)/;

// <link rel="alternate" hreflang="…"> only for languages with real, reviewed translations (English + Hindi by default).
// The other ~130 languages are machine-translated menus around English content: listing them would show Google
// 130 near-copies of every page, which hurts rankings. Students can still switch language (?hl=xx, see proxy.ts).
// Add a language here once its pages are properly translated: HREFLANG_LANGS=en,hi,ta
const INDEXED = (process.env.HREFLANG_LANGS || 'en,hi').split(',').map((s) => s.trim()).filter(Boolean);
export default async function HrefLang() {
  const path = (await headers()).get('x-ses-path') || '/';
  if (PRIVATE.test(path)) return null;
  const url = (code?: string) => {
    if (!code) return `${SITE_URL}${path}`;
    return `${SITE_URL}${path}${path.includes('?') ? '&' : '?'}hl=${encodeURIComponent(code)}`;
  };
  return (
    <>
      <link rel="alternate" hrefLang="x-default" href={url()} />
      {LANGUAGES.filter((l) => INDEXED.includes(l.code)).map((l) => <link key={l.code} rel="alternate" hrefLang={l.code} href={url(l.code === 'en' ? undefined : l.code)} />)}
    </>
  );
}
