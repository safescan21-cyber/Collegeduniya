'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/components/LangProvider';

// Region → currency for guessing the visitor's own currency from the browser locale.
const REGION_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF',
  RO: 'RON', RU: 'RUB', UA: 'UAH', TR: 'TRY', AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', OM: 'OMR', BH: 'BHD', EG: 'EGP', IL: 'ILS',
  NG: 'NGN', KE: 'KES', GH: 'GHS', ZA: 'ZAR', ET: 'ETB', UG: 'UGX', TZ: 'TZS', MA: 'MAD', PK: 'PKR', BD: 'BDT', NP: 'NPR', LK: 'LKR',
  CN: 'CNY', HK: 'HKD', TW: 'TWD', JP: 'JPY', KR: 'KRW', SG: 'SGD', MY: 'MYR', TH: 'THB', VN: 'VND', ID: 'IDR', PH: 'PHP',
  BR: 'BRL', MX: 'MXN', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', IR: 'IRR', IQ: 'IQD', KZ: 'KZT', UZ: 'UZS',
};
export const HOME_CURRENCIES = Array.from(new Set(['USD', 'EUR', 'GBP', 'INR', ...Object.values(REGION_CURRENCY)])).sort();
const KEY = 'ses_currency';
const EVT = 'ses-currency';

function guess(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
  } catch {}
  for (const l of navigator.languages || [navigator.language]) {
    const region = (l.split('-')[1] || '').toUpperCase();
    if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return 'USD';
}

export function useHomeCurrency(): [string | null, (c: string) => void] {
  const [cur, setCur] = useState<string | null>(null);
  useEffect(() => {
    setCur(guess());
    const on = (e: Event) => setCur((e as CustomEvent).detail);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const set = (c: string) => {
    try { localStorage.setItem(KEY, c); } catch {}
    window.dispatchEvent(new CustomEvent(EVT, { detail: c }));
  };
  return [cur, set];
}

const rateCache = new Map<string, Promise<Record<string, number> | null>>();
function rates(base: string) {
  if (!rateCache.has(base)) {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    rateCache.set(base, fetch(`${API}/api/fx?base=${base}`).then((r) => (r.ok ? r.json() : null)).then((j) => j?.data?.rates || null).catch(() => null));
  }
  return rateCache.get(base)!;
}

function fmt(v: number, c: string, lang: string) {
  try { return new Intl.NumberFormat(c === 'INR' ? 'en-IN' : lang, { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v); }
  catch { return `${c} ${Math.round(v).toLocaleString()}`; }
}

// "≈ ₹31,20,000" — the fee converted to the visitor's currency (hidden when it's the same currency)
export function ApproxFee({ amount, currency, className = 'text-xs text-slate-400' }: { amount: number | null; currency: string | null; className?: string }) {
  const [home] = useHomeCurrency();
  const { lang } = useLang();
  const [v, setV] = useState<number | null>(null);
  useEffect(() => {
    setV(null);
    if (amount == null || !currency || !home || home === currency) return;
    let live = true;
    rates(currency).then((r) => { if (live && r?.[home]) setV(amount * r[home]); });
    return () => { live = false; };
  }, [amount, currency, home]);
  if (v == null || !home) return null;
  return <span className={className} title="Approximate, today’s exchange rate">≈ {fmt(v, home, lang)}</span>;
}

export function CurrencyPicker({ label }: { label: string }) {
  const [home, setHome] = useHomeCurrency();
  if (!home) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      {label}
      <select value={home} onChange={(e) => setHome(e.target.value)} className="input w-auto py-1.5">
        {HOME_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
      </select>
    </label>
  );
}
