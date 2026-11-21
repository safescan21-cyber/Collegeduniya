export function money(value: number | null | undefined, currency = 'INR') {
  if (value === null || value === undefined) return '—';
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', {
      style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${currency} ${Number(value).toLocaleString()}`;
  }
}

export function range(min: number | null, max: number | null, currency?: string | null) {
  const c = currency || 'INR';
  if (min == null && max == null) return 'Not disclosed';
  if (min != null && max != null && min !== max) return `${money(min, c)} – ${money(max, c)}`;
  return money((min ?? max) as number, c);
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  const units: [number, string][] = [[31536000, 'year'], [2592000, 'month'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [sec, name] of units) {
    const n = Math.floor(s / sec);
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.collegeolo.com').replace(/\/$/, '');

export const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#312e81"/><stop offset="1" stop-color="#4f46e5"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/><text x="400" y="240" font-family="sans-serif" font-size="36" fill="#c7d2fe" text-anchor="middle">Collegeolo</text></svg>',
  );

// Compact Indian format for tables: ₹85K, ₹1.2 L, ₹2.4 Cr (other currencies fall back to money())
export function short(value: number | string | null | undefined, currency = 'INR') {
  if (value === null || value === undefined || value === '') return '—';
  const v = Number(value);
  if ((currency || 'INR') !== 'INR') return money(v, currency);
  const t = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '');
  if (v >= 1e7) return `₹${t(v / 1e7)} Cr`;
  if (v >= 1e5) return `₹${t(v / 1e5)} L`;
  if (v >= 1e3) return `₹${t(v / 1e3)}K`;
  return `₹${v}`;
}
// salary packages: ₹6 LPA
export const lpa = (value: number | string | null | undefined, currency = 'INR') =>
  value == null ? '—' : (currency || 'INR') === 'INR' && Number(value) >= 1e5 ? `₹${(Math.round(Number(value) / 1e4) / 10).toString().replace(/\.0$/, '')} LPA` : money(Number(value), currency);
