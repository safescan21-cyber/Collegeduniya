import { supabasePublic, hasSupabase } from './supabase/server';

export type Rating = { college_id: string; avg_rating: number; review_count: number };

export async function ratingsFor(ids: string[]) {
  const map: Record<string, Rating> = {};
  if (!hasSupabase || ids.length === 0) return map;
  const { data } = await supabasePublic().from('college_ratings').select('*').in('college_id', ids);
  (data || []).forEach((r: Rating) => (map[r.college_id] = r));
  return map;
}

export async function counters() {
  const empty = { colleges: 0, countries: 0, hostels: 0, jobs: 0, students: 0, reviews: 0 };
  if (!hasSupabase) return empty;
  const { data } = await supabasePublic().rpc('site_counters');
  return { ...empty, ...(data || {}) } as typeof empty;
}

export async function distinctValues(table: 'colleges' | 'hostels' | 'jobs', column: 'country' | 'city' | 'state', where?: Record<string, string>) {
  if (!hasSupabase) return [] as string[];
  let q = supabasePublic().from(table).select(column).eq('is_published', true);
  for (const [k, v] of Object.entries(where || {})) if (v) q = q.eq(k, v);
  const { data } = await q.limit(5000);
  return Array.from(new Set((data || []).map((r: any) => r[column]).filter(Boolean))).sort() as string[];
}

// /colleges dropdowns — distinct values straight from the database (cached with the other public reads)
export async function collegeCountries() {
  if (!hasSupabase) return [] as string[];
  const { data } = await supabasePublic().rpc('college_countries');
  return ((data || []) as { country: string }[]).map((r) => r.country);
}
export async function collegeStates(country: string) {
  if (!hasSupabase || !country) return [] as string[];
  const { data } = await supabasePublic().rpc('college_states', { p_country: country });
  return ((data || []) as { state: string }[]).map((r) => r.state);
}

// Strip characters that would break a PostgREST or() filter
export const cleanTerm = (s?: string) => (s || '').replace(/[%,()*]/g, ' ').trim().slice(0, 80);
