// Daily: rupees per 1 unit of every currency → public.fx_rates, so course fees in EUR / USD / GBP … can be compared and
// sorted in ₹ on /courses/search. Source: Exchange Rate API (open.er-api.com, free, no key) via services/fx.js.
import { supabase } from '../supabase.js';
import { ratesFor } from './fx.js';

export async function syncFxRates() {
  const { rates } = await ratesFor('INR');                       // 1 INR = rates[X] units of X
  const rows = Object.entries(rates || {}).filter(([, v]) => Number(v) > 0)
    .map(([currency, v]) => ({ currency, inr: Number((1 / Number(v)).toPrecision(8)), updated_at: new Date().toISOString() }));
  if (!rows.length) return 0;
  const { error } = await supabase.from('fx_rates').upsert(rows, { onConflict: 'currency' });
  if (error) throw new Error(error.message);
  return rows.length;
}

export function startFxSync() {
  const run = () => syncFxRates().then((n) => n && console.log(`[fx] ${n} rates saved`)).catch((e) => console.warn('[fx]', e.message));
  setTimeout(run, 2 * 60e3);
  setInterval(run, 12 * 3600e3).unref();
}
