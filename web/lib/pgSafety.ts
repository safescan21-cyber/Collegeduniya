export const SAFETY: { key: string; label: string }[] = [
  { key: 'cctv', label: 'CCTV in common areas' },
  { key: 'biometric', label: 'Biometric / app entry' },
  { key: 'guard', label: 'Security guard' },
  { key: 'warden', label: 'Resident warden' },
  { key: 'women_only_floor', label: 'Women-only floor' },
  { key: 'fire_safety', label: 'Fire extinguishers & exits' },
  { key: 'first_aid', label: 'First-aid kit' },
  { key: 'police_verified', label: 'Owner police-verified' },
];
export const safetyLabel = (k: string) => SAFETY.find((s) => s.key === k)?.label || k;

// YouTube / Vimeo link → embeddable URL (anything else: shown as a link)
export function embedUrl(u?: string | null) {
  if (!u) return null;
  try {
    const url = new URL(u);
    if (/youtu\.be$/.test(url.hostname)) return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    if (/youtube\.com$/.test(url.hostname.replace(/^www\.|^m\./, ''))) {
      const id = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (/vimeo\.com$/.test(url.hostname)) return `https://player.vimeo.com/video/${url.pathname.split('/').filter(Boolean).pop()}`;
  } catch { /* not a URL */ }
  return null;
}
