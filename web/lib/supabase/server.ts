import { createClient } from '@supabase/supabase-js';

// Anonymous read-only client for public pages rendered on the server. RLS makes sure only published rows are returned.
//
// Caching: public pages are the same for every visitor, so read-only answers are kept in Next.js's data cache for a
// short time (default 2 minutes) and shared by all visitors — a popular college page then costs one set of database
// queries per 2 minutes instead of one per visitor. Writes and live numbers (online counters) are never cached.
// Pass { revalidate: 0 } for an always-fresh read; a longer value for slow-changing data (rankings, cities).
const READ_RPCS = new Set(['college_search', 'scholarship_stories_public', 'colleges_in_city', 'cutoff_options', 'course_rank_lists', 'course_search', 'college_countries', 'college_states', 'trending_courses', 'exam_calendar', 'college_report_card', 'feed', 'stream_place_counts', 'stream_overview', 'stream_cities', 'course_catalog_counts', 'top_colleges_table_v2', 'top_colleges_table',
  'paper_leaderboard', 'rank_predictor_exams', 'quota_countries', 'nearby_hostels', 'nearby_colleges', 'nearby_jobs', 'mock_catalog_v2', 'mock_catalog', 'exam_papers',
  'college_rows', 'city_local_name', 'top_study_cities', 'top_placements', 'sitemap_colleges', 'sitemap_college_count', 'site_counters', 'resolve_top',
  'referral_leaderboard', 'recommend_colleges', 'ranking_list_index', 'rank_card_facts', 'world_top_table', 'world_top_countries', 'rank_from_reports', 'public_profile_v2', 'predict_rank', 'predict_colleges',
  'post_comments_list', 'placement_trends', 'mock_stats', 'daily_question', 'course_stats', 'course_colleges', 'search_colleges', 'cities_with_colleges',
  'country_college_counts', 'college_quality', 'stream_overview']);

function cachedFetch(revalidate: number): typeof fetch {
  return (input: any, init?: any) => {
    const method = String(init?.method || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : input?.url || String(input);
    const rpc = url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/)?.[1];
    const readOnly = revalidate > 0 && url.includes('/rest/v1/') && (method === 'GET' || method === 'HEAD' || (method === 'POST' && !!rpc && READ_RPCS.has(rpc)));
    if (!readOnly) return fetch(input, { ...init, cache: 'no-store' });
    return fetch(input, { ...init, cache: 'force-cache', next: { revalidate, tags: ['db'] } } as any);
  };
}

export function supabasePublic({ revalidate = 120 }: { revalidate?: number } = {}) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key',
    { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: cachedFetch(revalidate) } },
  );
}

export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
