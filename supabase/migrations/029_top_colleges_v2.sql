-- =====================================================================
-- Collegeolo — migration 029: top-colleges table v2
--   • "All" ranks by NIRF Overall (no more mixing a #1 in Engineering with the #1 Overall)
--   • a stream with its own NIRF list (Engineering, Management, Medical …) uses that list directly,
--     even when the college's stream tags are missing; other streams fall back to tags + Overall rank
--   • other_ranks: the college's other NIRF ranks of the same year ("#3 Universities, #1 Engineering")
-- Run AFTER 028. No DROP statements (new function name).
-- =====================================================================
create or replace function public.top_colleges_table_v2(p_stream text default null, p_country text default 'India', p_lim int default 10)
returns table (id uuid, slug text, name text, city text, state text, logo_url text, rank_source text, rank_value int, rank_year int, rank_category text,
               fee_low numeric, currency text, placement_avg numeric, placement_highest numeric, avg_rating numeric, review_count int,
               cutoff_exam text, cutoff_rank int, other_ranks jsonb)
language sql stable security definer set search_path = public as $$
  with cat as (
    select case
      when p_stream is null or p_stream ilike 'all' then 'Overall'
      when p_stream ilike 'architect%' then 'Architecture & Planning'
      when p_stream ilike 'agricult%' then 'Agriculture'
      when exists (select 1 from college_rankings k where k.category ilike p_stream || '%') then (select k.category from college_rankings k where k.category ilike p_stream || '%' limit 1)
      else null end as c
  ), yr as (
    select max(k.year) y from college_rankings k, cat where k.category = coalesce(cat.c, 'Overall')
  ), best as (
    select k.college_id, k.source, k.rank, k.year, k.category
    from college_rankings k, cat, yr
    where k.year = yr.y and k.rank is not null and k.category = coalesce(cat.c, 'Overall')
  ), picked as (
    select c.*, b.source as rsrc, b.rank as rnk, b.year as ryear, b.category as rcat
    from best b join colleges c on c.id = b.college_id, cat
    where c.is_published and (p_country is null or c.country = p_country)
      and not ('ranking' = any(c.hidden_fields))
      and (cat.c is not null or p_stream = any(c.streams))
    order by b.rank, c.name
    limit least(greatest(p_lim, 1), 50)
  )
  select p.id, p.slug, p.name, p.city, p.state, case when 'logo' = any(p.hidden_fields) then null else p.logo_url end,
         p.rsrc, p.rnk, p.ryear, p.rcat, r.fee_low, p.currency, r.placement_avg, r.placement_highest, r.avg_rating, r.review_count,
         r.cutoff_exam, r.cutoff_rank,
         (select coalesce(jsonb_agg(jsonb_build_object('category', o.category, 'rank', o.rank) order by o.rank), '[]'::jsonb)
            from (select k.category, k.rank from college_rankings k where k.college_id = p.id and k.year = p.ryear and k.category <> p.rcat and k.rank is not null order by k.rank limit 3) o)
  from picked p cross join lateral public.college_rows(array[p.id]) r
  order by p.rnk, p.name;
$$;
grant execute on function public.top_colleges_table_v2(text, text, int) to anon, authenticated;
