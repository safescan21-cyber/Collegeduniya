import type { MetadataRoute } from 'next';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/format';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = ['', '/colleges', '/hostels', '/jobs', '/near-me'].map((p) => ({
    url: `${SITE_URL}${p}`, changeFrequency: 'daily', priority: p ? 0.8 : 1,
  }));
  if (!hasSupabase) return base;
  const sb = supabasePublic();
  const [c, h, j] = await Promise.all([
    sb.from('colleges').select('slug, updated_at').eq('is_published', true).limit(5000),
    sb.from('hostels').select('id, updated_at').eq('is_published', true).limit(5000),
    sb.from('jobs').select('id, updated_at').eq('is_published', true).eq('status', 'open').limit(5000),
  ]);
  return [
    ...base,
    ...(c.data || []).map((r) => ({ url: `${SITE_URL}/colleges/${r.slug}`, lastModified: r.updated_at, priority: 0.9 })),
    ...(h.data || []).map((r) => ({ url: `${SITE_URL}/hostels/${r.id}`, lastModified: r.updated_at, priority: 0.6 })),
    ...(j.data || []).map((r) => ({ url: `${SITE_URL}/jobs/${r.id}`, lastModified: r.updated_at, priority: 0.6 })),
  ];
}
