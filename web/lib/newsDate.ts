// News items: the full date (India time) plus "today / yesterday / 3 days ago" for recent ones — e.g. "26 Nov 2026 · yesterday"
export function newsDate(iso: string) {
  const d = new Date(iso);
  const full = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const diff = Math.round((Date.parse(day(new Date())) - Date.parse(day(d))) / 864e5);
  const rel = diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : diff < 7 ? `${diff} days ago` : '';
  return rel ? `${full} · ${rel}` : full;
}
// a readable source: "gov.uk — UK Visas and Immigration", "timesofindia.indiatimes.com" → "timesofindia.indiatimes.com"
export const sourceName = (s: string | null | undefined) => (s || 'news website').replace(/^www\./, '');
// the website a link points to, for "Source: nta.ac.in"
export const hostOf = (u: string | null | undefined) => { try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch { return 'official website'; } };
// a notice with no date of its own: say when we first saw it, not that it was published then
export const seenDate = (iso: string) => `Seen on ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`;
