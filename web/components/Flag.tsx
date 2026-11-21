// Country flags (SVGs from the MIT-licensed "flag-icons" project, served from /public/flags).
// Used for colleges outside India: as a small badge, and in place of a missing logo or cover photo.
const HOME = 'IN';

export function flagSrc(code?: string | null) {
  const cc = String(code || '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(cc) ? `/flags/${cc === 'uk' ? 'gb' : cc === 'el' ? 'gr' : cc}.svg` : null;
}

export const isForeign = (code?: string | null) => Boolean(code && code.toUpperCase() !== HOME && flagSrc(code));

export function Flag({ code, country, className = 'h-3.5 w-5' }: { code?: string | null; country?: string | null; className?: string }) {
  const src = flagSrc(code);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={country ? `${country} flag` : ''} title={country || undefined} className={`inline-block shrink-0 rounded-[2px] object-cover shadow-sm ring-1 ring-black/10 ${className}`} loading="lazy" />;
}
