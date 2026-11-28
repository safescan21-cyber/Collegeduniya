-- =====================================================================
-- Collegeolo — migration 026
--   • search_colleges(): word-by-word college search ranked by best match ("Delhi University" finds
--     "University of Delhi"), used by the profile college picker
--   • colleges.nearby_fetched_at: background collection of nearby places (hospitals, food, places to visit)
--   • notifications in realtime, so the site can chime when one arrives
-- Run AFTER 025. No DROP statements.
-- =====================================================================
alter table public.colleges add column if not exists nearby_fetched_at timestamptz;

create or replace function public.search_colleges(p_q text, p_limit int default 8)
returns table (id uuid, name text, city text, state text, country text, country_code text)
language sql stable security definer set search_path = public as $$
  with w as (
    select array_agg(x) words from (
      select lower(x) x from regexp_split_to_table(regexp_replace(
        regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(p_q, '')),
          '\miiit\M', 'indian institute information technology', 'g'),
          '\miit\M', 'indian institute technology', 'g'),
          '\mnit\M', 'national institute technology', 'g'),
          '\miim\M', 'indian institute management', 'g'),
          '\maiims\M', 'all india institute medical sciences', 'g'),
          '\mdu\M', 'delhi university', 'g'),
        '[^[:alnum:]\s]', ' ', 'g'), '\s+') x
      where length(x) >= 2 and lower(x) not in ('of', 'the', 'and', 'for', 'in', 'at')
    ) t
  ), q as (select lower(trim(p_q)) full_q, words from w)
  select c.id, c.name, c.city, c.state, c.country, c.country_code
  from colleges c, q
  where c.is_published
    and q.words is not null
    and (select bool_and((lower(c.name) || ' ' || lower(coalesce(c.short_name, '')) || ' ' || lower(coalesce(c.city, ''))) like '%' || wd || '%') from unnest(q.words) wd)
  order by
    (lower(c.name) = q.full_q or lower(coalesce(c.short_name, '')) = q.full_q) desc,
    (lower(c.name) like q.full_q || '%') desc,
    (select bool_and(lower(c.name) like '%' || wd || '%') from unnest(q.words) wd) desc,
    (c.facts->>'institution' = 'University' or c.name ilike '%universit%') desc,
    length(c.name) < length(q.full_q) + 15 desc,
    (c.cover_url is not null) desc,
    length(c.name)
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;
grant execute on function public.search_colleges(text, int) to anon, authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.notifications'; exception when duplicate_object then null; end;
  end if;
end $$;
