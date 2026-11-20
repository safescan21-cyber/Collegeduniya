import type { MetadataRoute } from 'next';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/format';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = ['', '/colleges', '/hostels', '/jobs', '/exams', '/news', '/questions', '/predictor', '/compare', '/apply', '/management-quota', '/counselling', '/study-abroad/calculator', '/near-me', '/cities', '/partners'].map((p) => ({
    url: `${SITE_URL}${p}`, changeFrequency: 'daily', priority: p ? 0.8 : 1,
  }));
  if (!hasSupabase) return base;
  const sb = supabasePublic();
  const [c, h, j, e, a, q, ct] = await Promise.all([
    sb.from('colleges_public').select('slug, updated_at').eq('is_published', true).limit(5000),
    sb.from('hostels').select('id, updated_at').eq('is_published', true).limit(5000),
    sb.from('jobs').select('id, updated_at').eq('is_published', true).eq('status', 'open').limit(5000),
    sb.from('exams').select('slug, updated_at').eq('is_published', true).limit(1000),
    sb.from('articles').select('slug, updated_at').eq('is_published', true).lte('published_at', new Date().toISOString()).limit(5000),
    sb.from('questions_public').select('id, created_at').limit(5000),
    sb.from('cities').select('slug').order('population', { ascending: false }).limit(10000),
  ]);
  return [
    ...base,
    ...(c.data || []).map((r) => ({ url: `${SITE_URL}/colleges/${r.slug}`, lastModified: r.updated_at, priority: 0.9 })),
    ...(h.data || []).map((r) => ({ url: `${SITE_URL}/hostels/${r.id}`, lastModified: r.updated_at, priority: 0.6 })),
    ...(j.data || []).map((r) => ({ url: `${SITE_URL}/jobs/${r.id}`, lastModified: r.updated_at, priority: 0.6 })),
    ...(e.data || []).map((r) => ({ url: `${SITE_URL}/exams/${r.slug}`, lastModified: r.updated_at, priority: 0.8 })),
    ...(a.data || []).map((r) => ({ url: `${SITE_URL}/news/${r.slug}`, lastModified: r.updated_at, priority: 0.7 })),
    ...(q.data || []).map((r) => ({ url: `${SITE_URL}/questions/${r.id}`, lastModified: r.created_at, priority: 0.5 })),
    ...(ct.data || []).map((r) => ({ url: `${SITE_URL}/city/${r.slug}`, priority: 0.6 })),
  ];
}
