// Small fetch helper: timeout, JSON, polite User-Agent (required by OpenStreetMap / Wikidata policies)
export const USER_AGENT = process.env.HTTP_USER_AGENT
  || 'Collegeolo/1.0 (+https://www.collegeolo.com; hello@collegeolo.com)';

export async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
      body,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && (data.error?.message || data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(`${new URL(url).host}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${new URL(url).host}: timed out`);
    if (e.cause) throw new Error(`${new URL(url).host}: ${e.message} (${e.cause.code || e.cause.message || e.cause})`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Simple per-host throttle (Nominatim allows max 1 request / second)
const last = new Map();
export async function throttle(host, minGapMs) {
  const prev = last.get(host) || 0;
  const wait = prev + minGapMs - Date.now();
  last.set(host, Math.max(Date.now(), prev + minGapMs));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
