-- =====================================================================
-- Collegeolo.com — migration 008: every city, town & village + city names in every language
-- Run AFTER 007. Safe to re-run.
-- =====================================================================

-- District / county and GeoNames feature code (PPLC capital, PPLA state capital, PPL town/village…)
alter table public.cities add column if not exists admin2       text;
alter table public.cities add column if not exists feature_code text;
create index if not exists cities_admin_idx on public.cities (country_code, admin1, admin2);
create index if not exists cities_slug_pop_idx on public.cities (population desc, geoname_id);

-- Local-language names from GeoNames alternateNames: पुणे, புனே, Пуна, 浦那 …
create table if not exists public.city_names (
  geoname_id   bigint not null references public.cities(geoname_id) on delete cascade,
  lang         text not null,              -- site language code (hi, ta, zh-CN …)
  name         text not null,
  is_preferred boolean not null default false,
  primary key (geoname_id, lang, name)
);
create index if not exists city_names_prefix_idx on public.city_names (lower(name) text_pattern_ops);
create index if not exists city_names_lang_idx on public.city_names (geoname_id, lang, is_preferred desc);
alter table public.city_names enable row level security;
drop policy if exists "city names public read" on public.city_names;
create policy "city names public read" on public.city_names for select using (true);
grant select on public.city_names to anon, authenticated;

-- Best name of a city in a language (falls back to the English/official name)
create or replace function public.city_local_name(gid bigint, p_lang text)
returns text language sql stable as $$
  select coalesce(
    (select n.name from public.city_names n where n.geoname_id = gid and n.lang = p_lang
      order by n.is_preferred desc, length(n.name) limit 1),
    (select n.name from public.city_names n where n.geoname_id = gid and n.lang = split_part(p_lang, '-', 1)
      order by n.is_preferred desc, length(n.name) limit 1),
    (select c.name from public.cities c where c.geoname_id = gid));
$$;
grant execute on function public.city_local_name to anon, authenticated;

-- City search in any script: "pun", "पुण", "புனே" all find Pune. Returns the name in the visitor's language too.
drop function if exists public.search_cities(text, text, int);
drop function if exists public.search_cities(text, text, int, text);
create or replace function public.search_cities(q text, country text default null, lim int default 10, lang text default null)
returns table (geoname_id bigint, name text, local_name text, admin1 text, admin2 text, country text, country_code char(2),
               latitude double precision, longitude double precision, population bigint, slug text)
language sql stable as $$
  with hits as (
    select c.geoname_id from public.cities c
    where (lower(c.ascii_name) like lower(q) || '%' or lower(c.name) like lower(q) || '%')
      and (country is null or c.country_code = upper(country) or lower(c.country) = lower(country))
    union
    select n.geoname_id from public.city_names n
    join public.cities c on c.geoname_id = n.geoname_id
    where lower(n.name) like lower(q) || '%'
      and (country is null or c.country_code = upper(country) or lower(c.country) = lower(country))
  )
  select c.geoname_id, c.name,
         case when lang is null or lang = 'en' then c.name else public.city_local_name(c.geoname_id, lang) end,
         c.admin1, c.admin2, c.country, c.country_code, c.latitude, c.longitude, c.population, c.slug
  from hits h join public.cities c on c.geoname_id = h.geoname_id
  order by c.population desc nulls last
  limit least(greatest(lim, 1), 50);
$$;
grant execute on function public.search_cities to anon, authenticated;

-- How many cities / towns we know per country (for the /cities page)
create or replace function public.city_counts()
returns table (country_code char(2), country text, cities bigint)
language sql stable security definer set search_path = public as $$
  select country_code, max(country), count(*) from cities group by country_code order by count(*) desc;
$$;
grant execute on function public.city_counts to anon, authenticated;
