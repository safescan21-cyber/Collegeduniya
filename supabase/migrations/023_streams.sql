-- =====================================================================
-- Collegeolo — migration 023: stream hubs (Engineering, Management, Medical …)
-- Counts and top cities per stream for /streams pages, the Streams menu and the home page. Read-only.
-- Run AFTER 022. No DROP statements.
-- =====================================================================

create or replace function public.stream_overview()
returns table (stream text, colleges int, exams int, courses int)
language sql stable security definer set search_path = public as $$
  with c as (select s as stream, count(*)::int n from colleges, unnest(streams) s where is_published group by s),
       e as (select stream, count(*)::int n from exams where is_published and stream is not null group by stream),
       k as (select stream, count(*)::int n from course_catalog where is_published and stream is not null group by stream)
  select coalesce(c.stream, e.stream, k.stream), coalesce(c.n, 0), coalesce(e.n, 0), coalesce(k.n, 0)
  from c full join e on e.stream = c.stream full join k on k.stream = coalesce(c.stream, e.stream)
$$;
grant execute on function public.stream_overview() to anon, authenticated;

create or replace function public.stream_cities(p_stream text, p_country text default 'India', p_lim int default 12)
returns table (city text, state text, colleges int)
language sql stable security definer set search_path = public as $$
  select city, max(state), count(*)::int from colleges
  where is_published and p_stream = any(streams) and city is not null and (p_country is null or country = p_country)
  group by city order by count(*) desc, city limit least(greatest(p_lim, 1), 50)
$$;
grant execute on function public.stream_cities(text, text, int) to anon, authenticated;
