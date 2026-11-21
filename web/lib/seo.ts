import { SITE_URL, money } from '@/lib/format';

// Titles and descriptions say only what the page really has — no promise of "fees, placements, reviews" on an empty page.
const LABEL: Record<string, string> = { courses: 'Courses & Fees', fees: 'Fees', placements: 'Placements', cutoffs: 'Cutoffs', reviews: 'Reviews', qa: 'Q&A', stay: 'Hostels' };
const ORDER = ['courses', 'fees', 'placements', 'cutoffs', 'reviews', 'qa', 'stay'];

export function collegeTitle(c: { name: string; city: string }, signals: string[]) {
  const have = ORDER.filter((s) => signals.includes(s)).filter((s, _, a) => !(s === 'fees' && a.includes('courses'))).map((s) => LABEL[s]).slice(0, 3);
  return `${c.name}, ${c.city}${have.length ? ` — ${have.join(', ')}` : ''}`;
}

export function collegeDescription(c: any, r: { avg: number; count: number }) {
  if (c.description && c.description_source !== 'wikipedia' && c.description.length >= 120) return c.description.replace(/\s+/g, ' ').slice(0, 158);
  const bits: string[] = [];
  const place = [c.city, c.state].filter(Boolean).join(', ');
  bits.push(`${c.type && c.type !== 'Other' ? `${c.type} ` : ''}${/university/i.test(c.name) ? 'university' : 'college'} in ${place}${c.established ? `, established ${c.established}` : ''}.`);
  if (c.fees_min) bits.push(`Fees from ${money(Number(c.fees_min), c.currency || 'INR')} a year.`);
  if (r.count) bits.push(`${r.count} student review${r.count > 1 ? 's' : ''}, rated ${r.avg.toFixed(1)}/5.`);
  if (c.accreditation) bits.push(`${c.accreditation}.`);
  return bits.join(' ').slice(0, 158);
}

export const breadcrumbs = (items: [string, string][]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE_URL}${path}` })),
});

export const updatedOn = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null);
