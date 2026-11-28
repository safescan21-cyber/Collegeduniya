-- 067 · Degree programmes of German universities, read from each university's OWN website (server/src/services/germanCourses.js).
--   courses_checked_at: when we last read that university's programme pages (so each is read about once a quarter).
alter table public.colleges add column if not exists courses_checked_at timestamptz;

-- next German universities to read: world-ranked first (best rank first), then the rest; never-read first
create or replace function public.de_course_targets(p_lim int default 4, p_recheck_days int default 90)
returns table (id uuid, name text, city text, country text, website text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.city, c.country, c.website
  from colleges c
  left join lateral (select min(r.rank) as best from college_rankings r where r.college_id = c.id and r.rank is not null) rk on true
  where c.country = 'Germany' and c.is_published and c.website is not null
    and coalesce(c.website_status, 'ok') not in ('dead', 'bad')
    and (c.courses_checked_at is null or c.courses_checked_at < now() - make_interval(days => greatest(p_recheck_days, 7)))
  order by c.courses_checked_at nulls first, rk.best asc nulls last, c.name
  limit least(greatest(coalesce(p_lim, 4), 1), 50)
$$;
revoke execute on function public.de_course_targets(int, int) from public, anon, authenticated;
grant execute on function public.de_course_targets(int, int) to service_role;
