-- 065 · The two queries that used most of the database's time (Admin → System health → Database queries):
--   1. Location lookups (nearby_colleges / nearest_city) measured the distance to EVERY college or city
--      (88,734 colleges; the world city list) on each call — ~0.5 s × 169,000 calls. Now they first take only the
--      square around the point (an index finds it), then measure distances inside it.
--   2. City pages read colleges with  city_geoname_id = … OR city ILIKE '…'  — ILIKE can't use an index, so every city
--      page scanned all colleges. colleges_in_city() uses the two existing indexes instead.
-- Indexes are built CONCURRENTLY so the site keeps working while they build (the migration runner is autocommit).

create index concurrently if not exists colleges_lat_lng_idx on public.colleges (latitude, longitude)
  where is_published and latitude is not null;
create index concurrently if not exists cities_lat_lng_idx on public.cities (latitude, longitude);
create index concurrently if not exists colleges_streams_idx on public.colleges using gin (streams);

create or replace function public.nearby_colleges(lat double precision, lng double precision, radius_km double precision default 50)
returns table (id uuid, slug text, name text, city text, country text, cover_url text, logo_url text,
               fees_min numeric, fees_max numeric, currency text, distance numeric)
language sql stable security definer set search_path = public as $$
  with box as (
    select least(greatest(coalesce(radius_km, 50), 0.1), 500) / 111.0 as dlat,
           least(greatest(coalesce(radius_km, 50), 0.1), 500) / (111.0 * greatest(cos(radians(lat)), 0.05)) as dlng
  )
  select c.id, c.slug, c.name, c.city, c.country,
         case when 'photos' = any(c.hidden_fields) then null else c.cover_url end,
         case when 'logo' = any(c.hidden_fields) then null else c.logo_url end,
         case when 'fees' = any(c.hidden_fields) then null else c.fees_min end,
         case when 'fees' = any(c.hidden_fields) then null else c.fees_max end,
         c.currency,
         round(public.distance_km(lat, lng, c.latitude, c.longitude)::numeric, 1)
  from public.colleges c, box
  where c.is_published and c.latitude is not null
    and c.latitude between lat - box.dlat and lat + box.dlat
    and c.longitude between lng - box.dlng and lng + box.dlng
    and not ('map' = any(c.hidden_fields))
    and public.distance_km(lat, lng, c.latitude, c.longitude) <= radius_km
  order by 11 limit 50;
$$;
grant execute on function public.nearby_colleges(double precision, double precision, double precision) to anon, authenticated;

-- colleges of one city page (same columns as colleges_public), using the geoname-id and lower(city) indexes
create or replace function public.colleges_in_city(p_gid bigint, p_name text, p_lim int default 24)
returns setof public.colleges_public
language sql stable security definer set search_path = public as $$
  select v.* from public.colleges_public v
  where v.id in (
    select c.id from public.colleges c
    where c.is_published and ((p_gid is not null and c.city_geoname_id = p_gid) or lower(c.city) = lower(p_name))
  )
  order by v.ranking asc nulls last, v.name
  limit least(greatest(coalesce(p_lim, 24), 1), 60);
$$;
grant execute on function public.colleges_in_city(bigint, text, int) to anon, authenticated;
