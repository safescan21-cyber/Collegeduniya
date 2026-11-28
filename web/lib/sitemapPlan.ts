import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

// Google allows 50,000 URLs per sitemap file. Sitemap 0 = pages, PGs, jobs, exams, news, Q&A, quota seats;
// then one file per 40,000 colleges; then one per 40,000 cities/towns (population ≥ CITY_MIN_POP).
// Only pages with real content are listed: colleges with seo_score ≥ 4 (or forced by an admin), towns with seo_ok (migration 018).
export const SHARD = 40000;
export const CITY_MIN_POP = Number(process.env.SITEMAP_CITY_MIN_POP || 1000);

export async function sitemapPlan() {
  if (!hasSupabase) return { colleges: 0, cities: 0, collegeShards: 0, cityShards: 0 };
  const sb = supabasePublic();
  const [c, y] = await Promise.all([
    sb.rpc('sitemap_college_count'),
    sb.from('cities').select('geoname_id', { count: 'exact', head: true }).eq('seo_ok', true).or(`colleges_count.gt.0,population.gte.${CITY_MIN_POP}`),
  ]);
  const colleges = Number((c as any).data) || 0; const cities = y.count || 0;
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
