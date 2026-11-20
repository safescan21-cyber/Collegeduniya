import { headers } from 'next/headers';
import { LANGUAGES } from '@/lib/i18n';
import { SITE_URL } from '@/lib/format';

const PRIVATE = /^\/(admin|dashboard|login|owner|employer|offline)(\/|$)/;

// <link rel="alternate" hreflang="…"> for every site language → Google indexes each language version
// (?hl=xx switches the language, see proxy.ts). React hoists these tags into <head>.
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
      {LANGUAGES.map((l) => <link key={l.code} rel="alternate" hrefLang={l.code} href={url(l.code)} />)}
    </>
  );
}
