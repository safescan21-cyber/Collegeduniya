import type { MetadataRoute } from 'next';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/format';
import { sitemapPlan, readRange, SHARD, CITY_MIN_POP } from '@/lib/sitemapPlan';
import { topPath } from '@/lib/top';

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
      sb.rpc('sitemap_colleges', { p_offset: a, p_lim: b - a + 1 }), from, from + SHARD);
    return rows.map((r) => ({ url: `${SITE_URL}/colleges/${r.slug}`, lastModified: r.updated_at, priority: 0.9 }));
  }
  if (n > plan.collegeShards) {
    const from = (n - 1 - plan.collegeShards) * SHARD;
    const rows = await readRange<{ slug: string }>((a, b) =>
      sb.from('cities').select('slug').eq('seo_ok', true).gte('population', CITY_MIN_POP).order('geoname_id').range(a, b), from, from + SHARD);
    return rows.map((r) => ({ url: `${SITE_URL}/city/${r.slug}`, priority: 0.6 }));
  }

  const base: MetadataRoute.Sitemap = ['', '/colleges', '/hostels', '/jobs', '/exams', '/news', '/questions', '/predictor', '/compare', '/apply', '/management-quota', '/recommend', '/career-quiz', '/roommates', '/scholarships', '/study-abroad/visa', '/counselling', '/study-abroad/calculator', '/near-me', '/cities', '/partners', '/top', '/mock-tests', '/community', '/about', '/editorial-policy', '/contact', '/privacy', '/terms', '/community-guidelines', '/papers', '/trends', '/rewards', '/ambassador'].map((p) => ({
    url: `${SITE_URL}${p}`, changeFrequency: 'daily', priority: p ? 0.8 : 1,
  }));
  const [h, j, e, a, q, qs, qc, cc] = await Promise.all([
    sb.from('hostels').select('id, updated_at').eq('is_published', true).limit(5000),
    sb.from('jobs').select('id, updated_at').eq('is_published', true).eq('status', 'open').limit(5000),
    sb.from('exams').select('slug, updated_at').eq('is_published', true).limit(1000),
    sb.from('articles').select('slug, updated_at').eq('is_published', true).lte('published_at', new Date().toISOString()).limit(5000),
    sb.from('questions_public').select('id, created_at').gt('answer_count', 0).limit(5000),
    sb.from('quota_seats_public').select('id, created_at').eq('status', 'open').limit(5000),
    sb.rpc('quota_countries'),
    sb.from('countries').select('code').limit(300),
  ]);
  const tops = await readRange<any>((a, b) => sb.rpc('stream_place_counts', { p_min: 3 }).range(a, b), 0, 20000);
  const topUrls = new Set<string>();
  for (const r of tops) { topUrls.add(topPath(r.stream_slug)); topUrls.add(topPath(r.stream_slug, r.place_slug)); }
  const { data: mocks } = await sb.rpc('mock_catalog');
  const { data: courseCounts } = await sb.rpc('course_catalog_counts');
  const { data: posts } = await sb.rpc('feed', { p_sort: 'new', p_lim: 50, p_offset: 0 });   // latest; older ones are reached by links
  const { data: blogs } = await sb.rpc('feed', { p_kind: 'blog', p_sort: 'new', p_lim: 50, p_offset: 0 });
  const [ex, sch, visa] = await Promise.all([
    sb.from('exams').select('slug').eq('is_published', true).neq('level', 'Abroad').limit(500),
    sb.from('scholarships').select('slug, updated_at').eq('is_published', true).limit(5000),
    sb.from('visa_guides').select('country_code, updated_at').eq('is_published', true),
  ]);
  return [
    ...base,
    ...((mocks || []) as any[]).filter((m) => Number(m.ready_questions) > 0).map((m) => ({ url: `${SITE_URL}/mock-tests/${m.exam_slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...Array.from(topUrls).map((u) => ({ url: `${SITE_URL}${u}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...((cc.data || []) as any[]).map((r) => ({ url: `${SITE_URL}/cities?country=${r.code}`, priority: 0.5 })),
    ...(h.data || []).map((r) => ({ url: `${SITE_URL}/hostels/${r.id}`, lastModified: r.updated_at, priority: 0.6 })),
    ...(j.data || []).map((r) => ({ url: `${SITE_URL}/jobs/${r.id}`, lastModified: r.updated_at, priority: 0.6 })),
    ...(e.data || []).map((r) => ({ url: `${SITE_URL}/exams/${r.slug}`, lastModified: r.updated_at, priority: 0.8 })),
    ...(a.data || []).map((r) => ({ url: `${SITE_URL}/news/${r.slug}`, lastModified: r.updated_at, priority: 0.7 })),
    ...(q.data || []).map((r) => ({ url: `${SITE_URL}/questions/${r.id}`, lastModified: r.created_at, priority: 0.5 })),
    ...((qs.data || []) as any[]).map((r) => ({ url: `${SITE_URL}/management-quota/${r.id}`, lastModified: r.created_at, priority: 0.7 })),
    ...((qc.data || []) as any[]).map((r) => ({ url: `${SITE_URL}/management-quota?country=${r.country_code}`, priority: 0.7 })),
    ...((ex.data || []) as any[]).map((r) => ({ url: `${SITE_URL}/predictor/${r.slug}`, priority: 0.9 })),
    ...((sch.data || []) as any[]).map((r) => ({ url: `${SITE_URL}/scholarships/${r.slug}`, lastModified: r.updated_at, priority: 0.6 })),
    ...Array.from(new Map([...((blogs || []) as any[]), ...((posts || []) as any[])]
      .filter((r) => r.kind === 'blog' || (r.body || '').length >= 280 || r.comments >= 3).map((r) => [r.id, r])).values())
      .map((r) => ({ url: `${SITE_URL}/community/post/${r.id}`, lastModified: r.edited_at || r.created_at, priority: 0.5 })),
    { url: `${SITE_URL}/courses`, changeFrequency: 'weekly' as const, priority: 0.8 },
    ...((courseCounts || []) as any[]).filter((r) => Number(r.colleges) >= 3).map((r) => ({ url: `${SITE_URL}/courses/${r.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...((visa.data || []) as any[]).map((r) => ({ url: `${SITE_URL}/study-abroad/visa/${r.country_code.toLowerCase()}`, lastModified: r.updated_at, priority: 0.6 })),
  ];
}
