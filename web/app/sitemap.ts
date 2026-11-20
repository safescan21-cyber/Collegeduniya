import type { MetadataRoute } from 'next';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/format';
import { sitemapPlan, readRange, SHARD, CITY_MIN_POP } from '@/lib/sitemapPlan';

export const revalidate = 86400;

// /sitemap/0.xml, /sitemap/1.xml … — all listed in robots.txt
export async function generateSitemaps() {
  const p = await sitemapPlan();
  return Array.from({ length: 1 + p.collegeShards + p.cityShards }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const n = Number(await id);
  if (!hasSupabase) return n === 0 ? [{ url: SITE_URL, priority: 1 }] : [];
  const sb = supabasePublic();
  const plan = await sitemapPlan();

  if (n >= 1 && n <= plan.collegeShards) {
    const from = (n - 1) * SHARD;
    const rows = await readRange<{ slug: string; updated_at: string }>((a, b) =>
      sb.from('colleges_public').select('slug, updated_at').eq('is_published', true).order('slug').range(a, b), from, from + SHARD);
    return rows.map((r) => ({ url: `${SITE_URL}/colleges/${r.slug}`, lastModified: r.updated_at, priority: 0.9 }));
  }
  if (n > plan.collegeShards) {
    const from = (n - 1 - plan.collegeShards) * SHARD;
    const rows = await readRange<{ slug: string }>((a, b) =>
      sb.from('cities').select('slug').gte('population', CITY_MIN_POP).order('geoname_id').range(a, b), from, from + SHARD);
    return rows.map((r) => ({ url: `${SITE_URL}/city/${r.slug}`, priority: 0.6 }));
  }

  const base: MetadataRoute.Sitemap = ['', '/colleges', '/hostels', '/jobs', '/exams', '/news', '/questions', '/predictor', '/compare', '/apply', '/management-quota', '/counselling', '/study-abroad/calculator', '/near-me', '/cities', '/partners'].map((p) => ({
    url: `${SITE_URL}${p}`, changeFrequency: 'daily', priority: p ? 0.8 : 1,
  }));
  const [h, j, e, a, q, qs, qc, cc] = await Promise.all([
    sb.from('hostels').select('id, updated_at').eq('is_published', true).limit(5000),
    sb.from('jobs').select('id, updated_at').eq('is_published', true).eq('status', 'open').limit(5000),
    sb.from('exams').select('slug, updated_at').eq('is_published', true).limit(1000),
    sb.from('articles').select('slug, updated_at').eq('is_published', true).lte('published_at', new Date().toISOString()).limit(5000),
    sb.from('questions_public').select('id, created_at').limit(5000),
    sb.from('quota_seats_public').select('id, created_at').eq('status', 'open').limit(5000),
    sb.rpc('quota_countries'),
    sb.from('countries').select('code').limit(300),
  ]);
  return [
    ...base,
    ...((cc.data || []) as any[]).map((r) => ({ url: `${SITE_URL}/cities?country=${r.code}`, priority: 0.5 })),
    ...(h.data || []).map((r) => ({ url: `${SITE_URL}/hostels/${r.id}`, lastModified: r.updated_at, priority: 0.6 })),
    ...(j.data || []).map((r) => ({ url: `${SITE_URL}/jobs/${r.id}`, lastModified: r.updated_at, priority: 0.6 })),
    ...(e.data || []).map((r) => ({ url: `${SITE_URL}/exams/${r.slug}`, lastModified: r.updated_at, priority: 0.8 })),
    ...(a.data || []).map((r) => ({ url: `${SITE_URL}/news/${r.slug}`, lastModified: r.updated_at, priority: 0.7 })),
    ...(q.data || []).map((r) => ({ url: `${SITE_URL}/questions/${r.id}`, lastModified: r.created_at, priority: 0.5 })),
    ...((qs.data || []) as any[]).map((r) => ({ url: `${SITE_URL}/management-quota/${r.id}`, lastModified: r.created_at, priority: 0.7 })),
    ...((qc.data || []) as any[]).map((r) => ({ url: `${SITE_URL}/management-quota?country=${r.country_code}`, priority: 0.7 })),
  ];
}
