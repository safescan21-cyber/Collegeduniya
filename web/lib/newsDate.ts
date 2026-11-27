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
