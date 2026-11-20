import { cookies } from 'next/headers';
import { LANG_COOKIE, isLang, translate, type DictKey, type Lang } from './i18n';

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : 'en';
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: (k: DictKey) => translate(lang, k) };
}
