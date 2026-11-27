-- 068 · Course reader for more countries (server/src/services/officialCourses.js): same queue as 067, any country.
create or replace function public.course_targets(p_country text, p_lim int default 4, p_recheck_days int default 90)
returns table (id uuid, name text, city text, country text, website text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.city, c.country, c.website
  from colleges c
  left join lateral (select min(r.rank) as best from college_rankings r where r.college_id = c.id and r.rank is not null) rk on true
  where c.country = p_country and c.is_published and c.website is not null
    and coalesce(c.website_status, 'ok') not in ('dead', 'bad')
    and (c.courses_checked_at is null or c.courses_checked_at < now() - make_interval(days => greatest(p_recheck_days, 7)))
  order by c.courses_checked_at nulls first, rk.best asc nulls last, c.name
  limit least(greatest(coalesce(p_lim, 4), 1), 50)
$$;
revoke execute on function public.course_targets(text, int, int) from public, anon, authenticated;
grant execute on function public.course_targets(text, int, int) to service_role;
