// Every shot has its own page: /community/shots/<words-from-the-caption>-<id>
// The words make the link readable and searchable; only the id at the end is used to find the shot.
export function shotSlug(body: string | null | undefined) {
  const words = String(body || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9#\s-]/g, ' ').replace(/#/g, ' ')
    .split(/\s+/).filter((w) => w.length > 1).slice(0, 8).join('-')
    .replace(/-+/g, '-').slice(0, 70).replace(/-$/, '');
  return words || 'shot';
}
export const shotPath = (id: string, body?: string | null) => `/community/shots/${shotSlug(body)}-${id}`;
export const shotIdFrom = (param: string) => (decodeURIComponent(param).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i) || [])[1] || null;
export const hashtags = (body: string | null | undefined) => [...new Set((String(body || '').match(/#[\p{L}\p{N}_]{2,30}/gu) || []).map((t) => t.slice(1).toLowerCase()))].slice(0, 10);
