// A link to another website, made safe: "www.iitb.ac.in" → "https://www.iitb.ac.in" (without a scheme the browser
// treats it as a page on Collegeolo and sends people to the wrong place). Returns null for anything that isn't a web address.
export function extUrl(u: string | null | undefined): string | null {
  let s = String(u || '').trim().replace(/\s+/g, '');
  if (!s) return null;
  if (/^\/\//.test(s)) s = `https:${s}`;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s.replace(/^\/+/, '')}`;
  try {
    const x = new URL(s);
    if (!/^https?:$/.test(x.protocol) || !/\.[a-z]{2,}$/i.test(x.hostname)) return null;
    return x.toString();
  } catch { return null; }
}
export const urlLabel = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
