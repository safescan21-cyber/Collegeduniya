import { supabase } from '../supabase.js';

// Read-through cache stored in the api_cache table (survives restarts, shared by PM2 instances).
// Falls back to a small in-memory cache if the table is missing.
const mem = new Map();

export async function cached(key, maxAgeMs, fetcher) {
  const now = Date.now();
  const m = mem.get(key);
  if (m && now - m.at < maxAgeMs) return m.value;

  let stale = null;
  try {
    const { data } = await supabase.from('api_cache').select('payload, fetched_at').eq('key', key).maybeSingle();
    if (data) {
      const age = now - new Date(data.fetched_at).getTime();
      if (age < maxAgeMs) { mem.set(key, { value: data.payload, at: now - age }); return data.payload; }
      stale = data.payload;
    }
  } catch { /* table missing — ignore */ }

  try {
    const value = await fetcher();
    mem.set(key, { value, at: now });
    if (mem.size > 2000) mem.delete(mem.keys().next().value);
    supabase.from('api_cache').upsert({ key, payload: value, fetched_at: new Date().toISOString() }).then(() => {}, () => {});
    return value;
  } catch (e) {
    if (stale) return stale;          // serve old data rather than nothing
    throw e;
  }
}
