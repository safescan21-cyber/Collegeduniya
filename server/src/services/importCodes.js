import crypto from 'node:crypto';
// Short-lived, single-purpose codes for browser-assisted imports (e.g. NIRF sheets posted from nirfindia.org).
// Kept in memory only (a restart clears them); stored as hashes; expire after 3 hours.
const codes = new Map();   // sha256 → { purpose, by, until }
const h = (c) => crypto.createHash('sha256').update(String(c)).digest('hex');
export function createImportCode(purpose, by) {
  const code = crypto.randomBytes(18).toString('base64url');
  codes.set(h(code), { purpose, by, until: Date.now() + 3 * 3600e3 });
  return { code, expires_at: new Date(Date.now() + 3 * 3600e3).toISOString() };
}
export function checkImportCode(code, purpose) {
  const e = code && codes.get(h(code));
  if (!e || e.purpose !== purpose || e.until < Date.now()) return null;
  return e;
}
