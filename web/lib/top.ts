// URLs for the programmatic "Top {stream} colleges in {place}" pages: /top/engineering, /top/engineering/pune,
// /top/engineering/maharashtra, /top/engineering/in. The same slug rule runs in SQL (public.simple_slug).
export const simpleSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const topPath = (stream: string, place?: string | null) => `/top/${simpleSlug(stream)}${place ? `/${simpleSlug(place)}` : ''}`;
export const topLabel = (stream: string, place?: string | null) => `Top ${stream} colleges${place ? ` in ${place}` : ''}`;
