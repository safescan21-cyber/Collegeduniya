-- =====================================================================
-- Collegeolo — migration 031: a page for every city in the world that has colleges
--   • cities.colleges_count (published colleges placed in the city), refreshed by refresh_city_counts()
--   • a city page goes to Google as soon as it has 1+ college (or a PG / job), not 3+
--   • directory helpers: cities_with_colleges(country …), country_college_counts()
-- Run AFTER 030. No DROP statements.
-- =====================================================================
alter table public.cities add column if not exists colleges_count int not null default 0;
create index if not exists cities_country_colleges_idx on public.cities (country_code, colleges_count desc) where colleges_count > 0;

create or replace function public.refresh_city_counts()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update cities ci set colleges_count = coalesce(x.n, 0)
  from (select g.geoname_id, k.n from cities g
        left join (select city_geoname_id, count(*)::int n from colleges where is_published and city_geoname_id is not null group by 1) k
          on k.city_geoname_id = g.geoname_id) x
  where ci.geoname_id = x.geoname_id and ci.colleges_count is distinct from coalesce(x.n, 0);
  update cities ci set seo_ok = true where ci.colleges_count >= 1 and not ci.seo_ok;
  select count(*) into n from cities where colleges_count > 0;
  return n;
end $$;
revoke execute on function public.refresh_city_counts() from public, anon, authenticated;

create or replace function public.cities_with_colleges(p_country text, p_q text default null, p_offset int default 0, p_lim int default 200)
returns table (name text, slug text, admin1 text, colleges_count int, total bigint)
language sql stable security definer set search_path = public as $$
  select c.name, c.slug, c.admin1, c.colleges_count, count(*) over ()
  from cities c
  where c.country_code = upper(p_country) and c.colleges_count > 0
    and (p_q is null or c.name ilike '%' || p_q || '%' or c.admin1 ilike '%' || p_q || '%')
  order by c.colleges_count desc, c.name
  offset greatest(p_offset, 0) limit least(greatest(p_lim, 1), 500);
$$;

create or replace function public.country_college_counts()
returns table (code text, cities int, colleges bigint)
language sql stable security definer set search_path = public as $$
  select country_code, count(*)::int, sum(colleges_count)::bigint from cities where colleges_count > 0 group by country_code;
$$;
grant execute on function public.cities_with_colleges(text, text, int, int), public.country_college_counts() to anon, authenticated;

select public.refresh_city_counts();
