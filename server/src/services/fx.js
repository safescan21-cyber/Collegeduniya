import { fetchJson } from './http.js';
import { cached } from './cache.js';

// Free daily exchange rates, no key: https://www.exchangerate-api.com/docs/free  (attribution: "Rates by Exchange Rate API")
const FX_URL = process.env.FX_API_URL || 'https://open.er-api.com/v6/latest';

export async function ratesFor(base) {
  const b = String(base || 'USD').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'USD';
  return cached(`fx:${b}`, 12 * 3600e3, async () => {
    const r = await fetchJson(`${FX_URL}/${b}`, { timeoutMs: 10000 });
    if (r?.result !== 'success' || !r.rates) throw new Error('Exchange rates unavailable');
    return { base: b, rates: r.rates, updated: r.time_last_update_utc || null, source: 'Exchange Rate API (open.er-api.com)' };
  });
}
