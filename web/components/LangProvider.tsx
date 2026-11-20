'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Check } from 'lucide-react';
import { EN, LANG_COOKIE, LANGUAGES, RTL, type Dict, type DictKey, type Lang } from '@/lib/i18n';

type Ctx = { lang: Lang; dict: Dict; t: (k: DictKey) => string; setLang: (l: Lang) => void };
const LangContext = createContext<Ctx>({ lang: 'en', dict: EN, t: (k) => EN[k], setLang: () => {} });

export function LangProvider({ lang, dict, children }: { lang: Lang; dict: Dict; children: React.ReactNode }) {
  const router = useRouter();
  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    document.documentElement.dir = RTL.has(l) ? 'rtl' : 'ltr';
    router.refresh();
  }, [router]);
  return <LangContext.Provider value={{ lang, dict, t: (k) => dict[k] ?? EN[k], setLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

// Globe button with a searchable list of all supported languages
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const current = LANGUAGES.find((l) => l.code === lang)?.name || 'English';
  const list = LANGUAGES.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.code.toLowerCase().startsWith(q.toLowerCase()));
  return (
    <div className={`relative ${className}`} ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-label="Change language"
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
        <Globe size={14} /><span className="max-w-20 truncate">{current}</span>
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search language…" className="input mb-2 py-2 text-sm" />
          <ul className="max-h-72 overflow-y-auto">
            {list.map((l) => (
              <li key={l.code}>
                <button type="button" onClick={() => { setOpen(false); setQ(''); if (l.code !== lang) setLang(l.code); }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm hover:bg-brand-50">
                  <span>{l.name}</span>{l.code === lang && <Check size={14} className="text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 px-2 text-[10px] text-slate-400">Languages other than English and Hindi are machine-translated.</p>
        </div>
      )}
    </div>
  );
}
