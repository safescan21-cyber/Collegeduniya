import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

// Google allows 50,000 URLs per sitemap file. Sitemap 0 = pages, PGs, jobs, exams, news, Q&A, quota seats;
// then one file per 40,000 colleges; then one per 40,000 cities/towns (population ≥ CITY_MIN_POP).
export const SHARD = 40000;
export const CITY_MIN_POP = Number(process.env.SITEMAP_CITY_MIN_POP || 1000);

export async function sitemapPlan() {
  if (!hasSupabase) return { colleges: 0, cities: 0, collegeShards: 0, cityShards: 0 };
  const sb = supabasePublic();
  const [c, y] = await Promise.all([
    sb.from('colleges_public').select('id', { count: 'exact', head: true }).eq('is_published', true),
    sb.from('cities').select('geoname_id', { count: 'exact', head: true }).gte('population', CITY_MIN_POP),
  ]);
  const colleges = c.count || 0; const cities = y.count || 0;
  return { colleges, cities, collegeShards: Math.ceil(colleges / SHARD), cityShards: Math.ceil(cities / SHARD) };
}

// Read [from, to) in 1,000-row pages (the API returns at most 1,000 rows per request)
export async function readRange<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>, from: number, to: number) {
  const out: T[] = [];
  for (let i = from; i < to; i += 1000) {
    const { data } = await build(i, Math.min(i + 999, to - 1));
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
