'use client';
import { createContext, useCallback, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_COOKIE, translate, type DictKey, type Lang } from '@/lib/i18n';

type Ctx = { lang: Lang; t: (k: DictKey) => string; setLang: (l: Lang) => void };
const LangContext = createContext<Ctx>({ lang: 'en', t: (k) => translate('en', k), setLang: () => {} });

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const router = useRouter();
  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    router.refresh();
  }, [router]);
  return <LangContext.Provider value={{ lang, t: (k) => translate(lang, k), setLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button type="button" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
      className={`rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 ${className}`}
      aria-label="Switch language">
      {lang === 'en' ? 'हिंदी' : 'English'}
    </button>
  );
}
