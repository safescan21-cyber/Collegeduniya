-- =====================================================================
-- Collegeolo.com — migration 003: worldwide data + partner portals
-- Run AFTER 002_growth.sql in Supabase → SQL Editor. Safe to re-run.
--
-- Adds: world cities & countries (GeoNames), translation cache, account
-- types (student / PG owner / employer), company profiles, PG room
-- availability, caches for external APIs (jobs, OpenStreetMap), and
-- source fields so colleges can be imported from Hipolabs / Wikidata.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COUNTRIES + CITIES (filled by server/scripts/import-cities.js)
-- ---------------------------------------------------------------------
create table if not exists public.countries (
  code          char(2) primary key,      -- ISO 3166-1 alpha-2
  name          text not null,
  capital       text,
  continent     text,
  currency_code text,
  languages     text,                     -- e.g. "hi,en-IN,bn"
  population    bigint
);

create table if not exists public.cities (
  geoname_id   bigint primary key,
  name         text not null,
  ascii_name   text not null,
  country_code char(2) not null,
  country      text,
  admin1       text,                      -- state / province
  latitude     double precision not null,
  longitude    double precision not null,
  population   bigint default 0,
  timezone     text,
  slug         text unique not null       -- e.g. pune-maharashtra-in
);
create index if not exists cities_ascii_prefix_idx on public.cities (lower(ascii_name) text_pattern_ops);
create index if not exists cities_name_prefix_idx  on public.cities (lower(name) text_pattern_ops);
create index if not exists cities_country_pop_idx  on public.cities (country_code, population desc);

alter table public.countries enable row level security;
alter table public.cities enable row level security;
drop policy if exists "countries read" on public.countries;
drop policy if exists "cities read" on public.cities;
create policy "countries read" on public.countries for select using (true);
create policy "cities read"    on public.cities    for select using (true);

-- Autocomplete: prefix match on name, biggest cities first
create or replace function public.search_cities(q text, country text default null, lim int default 10)
returns table (geoname_id bigint, name text, admin1 text, country text, country_code char(2),
               latitude double precision, longitude double precision, population bigint, slug text)
language sql stable as $$
  select c.geoname_id, c.name, c.admin1, c.country, c.country_code, c.latitude, c.longitude, c.population, c.slug
  from public.cities c
  where (lower(c.ascii_name) like lower(q) || '%' or lower(c.name) like lower(q) || '%')
    and (country is null or c.country_code = upper(country) or lower(c.country) = lower(country))
  order by c.population desc nulls last
  limit least(greatest(lim, 1), 50);
$$;
grant execute on function public.search_cities to anon, authenticated;

-- Nearest known city to a point (used for "near me" and imports)
create or replace function public.nearest_city(lat double precision, lng double precision)
returns table (geoname_id bigint, name text, admin1 text, country text, country_code char(2), slug text, distance numeric)
language sql stable as $$
  select c.geoname_id, c.name, c.admin1, c.country, c.country_code, c.slug,
         round(public.distance_km(lat, lng, c.latitude, c.longitude)::numeric, 1)
  from public.cities c
  where c.latitude between lat - 1 and lat + 1 and c.longitude between lng - 1.5 and lng + 1.5
  order by public.distance_km(lat, lng, c.latitude, c.longitude)
  limit 1;
$$;
grant execute on function public.nearest_city to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. TRANSLATION CACHE (server-only; filled by /api/translate)
-- ---------------------------------------------------------------------
create table if not exists public.translations (
  lang            text not null,
  source_hash     text not null,            -- sha1 of source text
  source_text     text not null,
  translated_text text not null,
  provider        text,
  created_at      timestamptz default now(),
  primary key (lang, source_hash)
);
alter table public.translations enable row level security;  -- no policies: service role only

-- ---------------------------------------------------------------------
-- 3. ACCOUNT TYPES: student / PG owner / employer
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists account_type text not null default 'student';
do $$ begin
  alter table public.profiles add constraint profiles_account_type_chk check (account_type in ('student','pg_owner','employer'));
exception when duplicate_object then null; end $$;
alter table public.profiles add column if not exists preferred_lang text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare t text := coalesce(new.raw_user_meta_data->>'account_type', 'student');
begin
  if t not in ('student','pg_owner','employer') then t := 'student'; end if;
  insert into public.profiles (id, email, full_name, phone, account_type)
  values (new.id, new.email,
          nullif(new.raw_user_meta_data->>'full_name',''),
          nullif(new.raw_user_meta_data->>'phone',''),
          t)
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. COMPANIES (employer profile)
-- ---------------------------------------------------------------------
create table if not exists public.companies (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null unique references public.profiles(id) on delete cascade,
  name           text not null,
  slug           text unique not null,
  logo_url       text,
  website        text,
  industry       text,
  size           text,                     -- 1-10, 11-50, ...
  about          text,
  address        text,
  city           text,
  country        text,
  contact_email  text,
  contact_phone  text,
  registration_no text,                    -- GST / company reg. (shown to admins only via API)
  is_verified    boolean not null default false,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
alter table public.companies enable row level security;
drop policy if exists "companies read" on public.companies;
drop policy if exists "companies own insert" on public.companies;
drop policy if exists "companies own update" on public.companies;
drop policy if exists "companies admin all" on public.companies;
create policy "companies read"       on public.companies for select using (true);
create policy "companies own insert" on public.companies for insert with check (owner_id = auth.uid() and public.is_active_user());
create policy "companies own update" on public.companies for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "companies admin all"  on public.companies for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.protect_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.is_verified := case when tg_op = 'UPDATE' then old.is_verified else false end;
    new.owner_id := case when tg_op = 'UPDATE' then old.owner_id else auth.uid() end;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists companies_protect on public.companies;
create trigger companies_protect before insert or update on public.companies
  for each row execute function public.protect_company();

-- Public view hides registration number
create or replace view public.companies_public with (security_invoker = false) as
select id, name, slug, logo_url, website, industry, size, about, city, country, is_verified, created_at
from public.companies;
grant select on public.companies_public to anon, authenticated;

alter table public.jobs add column if not exists company_id uuid references public.companies(id) on delete set null;
create index if not exists jobs_company_idx on public.jobs (company_id);

-- ---------------------------------------------------------------------
-- 5. PG ROOMS & AVAILABILITY (owners update freely — no re-approval)
-- ---------------------------------------------------------------------
create table if not exists public.hostel_rooms (
  id              uuid primary key default gen_random_uuid(),
  hostel_id       uuid not null references public.hostels(id) on delete cascade,
  room_type       text not null default 'Double'
                  check (room_type in ('Single','Double','Triple','Four sharing','Dormitory','Studio','1 BHK','2 BHK','3 BHK')),
  beds_total      int not null default 1 check (beds_total >= 0),
  beds_available  int not null default 0 check (beds_available >= 0),
  rent            numeric,
  currency        text default 'INR',
  rent_period     text default 'month',
  deposit         numeric,
  ac              boolean default false,
  attached_bath   boolean default false,
  food_included   boolean default false,
  available_from  date,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  check (beds_available <= beds_total)
);
create index if not exists hostel_rooms_hostel_idx on public.hostel_rooms (hostel_id);
alter table public.hostel_rooms enable row level security;

create or replace function public.owns_hostel(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hostels where id = h and submitted_by = auth.uid());
$$;

drop policy if exists "rooms read" on public.hostel_rooms;
drop policy if exists "rooms owner write" on public.hostel_rooms;
drop policy if exists "rooms admin all" on public.hostel_rooms;
create policy "rooms read" on public.hostel_rooms for select using (
  exists (select 1 from public.hostels h where h.id = hostel_id and h.is_published) or public.owns_hostel(hostel_id) or public.is_admin());
create policy "rooms owner write" on public.hostel_rooms for all using (public.owns_hostel(hostel_id)) with check (public.owns_hostel(hostel_id));
create policy "rooms admin all" on public.hostel_rooms for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists hostel_rooms_touch on public.hostel_rooms;
create trigger hostel_rooms_touch before update on public.hostel_rooms for each row execute function public.touch_updated_at();

create or replace view public.hostel_availability with (security_invoker = false) as
select r.hostel_id,
       sum(r.beds_available)::int as beds_available,
       sum(r.beds_total)::int as beds_total,
       min(r.rent) filter (where r.beds_available > 0) as rent_from,
       max(r.updated_at) as updated_at
from public.hostel_rooms r
join public.hostels h on h.id = r.hostel_id and h.is_published
group by r.hostel_id;
grant select on public.hostel_availability to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. COLLEGE DATA SOURCES (Hipolabs / Wikidata imports)
-- ---------------------------------------------------------------------
alter table public.colleges add column if not exists source text not null default 'admin';
alter table public.colleges add column if not exists external_id text;        -- hipolabs: primary domain
alter table public.colleges add column if not exists wikidata_id text;        -- e.g. Q49108
alter table public.colleges add column if not exists domains text[] default '{}';
alter table public.colleges add column if not exists students_count int;
alter table public.colleges add column if not exists country_code char(2);
alter table public.colleges add column if not exists city_geoname_id bigint;
alter table public.colleges add column if not exists data_updated_at timestamptz;
-- Non-partial unique indexes (NULLs never collide) so the importer can upsert on them
drop index if exists public.colleges_source_ext_idx;
drop index if exists public.colleges_wikidata_idx;
create unique index if not exists colleges_source_ext_uidx on public.colleges (source, external_id);
create unique index if not exists colleges_wikidata_uidx on public.colleges (wikidata_id);
create index if not exists colleges_country_code_idx on public.colleges (country_code);

alter table public.hostels add column if not exists source text not null default 'owner';

-- ---------------------------------------------------------------------
-- 7. CACHES FOR EXTERNAL APIs + IMPORT LOG (service role only)
-- ---------------------------------------------------------------------
create table if not exists public.api_cache (
  key        text primary key,              -- e.g. jobs:adzuna:in:pune:  /  osm:hospital:18.52:73.86:3000
  payload    jsonb not null,
  fetched_at timestamptz not null default now()
);
create index if not exists api_cache_fetched_idx on public.api_cache (fetched_at);
alter table public.api_cache enable row level security;

create table if not exists public.import_runs (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,                 -- universities, cities, enrich
  params     jsonb,
  status     text not null default 'running' check (status in ('running','done','failed')),
  inserted   int default 0,
  updated    int default 0,
  skipped    int default 0,
  message    text,
  started_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  finished_at timestamptz
);
alter table public.import_runs enable row level security;
drop policy if exists "imports admin read" on public.import_runs;
create policy "imports admin read" on public.import_runs for select using (public.is_admin());

-- Counters now include cities
create or replace function public.site_counters()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'colleges',  (select count(*) from colleges where is_published),
    'countries', (select count(distinct country) from colleges where is_published),
    'hostels',   (select count(*) from hostels where is_published),
    'jobs',      (select count(*) from jobs where is_published and status = 'open'),
    'students',  (select count(*) from profiles),
    'reviews',   (select count(*) from reviews where status = 'approved'),
    'questions', (select count(*) from questions where status = 'approved'),
    'exams',     (select count(*) from exams where is_published),
    'cities',    (select case when k.reltuples > 50000 then k.reltuples::bigint else (select count(*) from cities) end
                  from pg_class k where k.oid = 'public.cities'::regclass),
    'companies', (select count(*) from companies)
  );
$$;

-- ---------------------------------------------------------------------
-- 8. PG owners can see enquiries sent about their own PGs
-- ---------------------------------------------------------------------
drop policy if exists "leads hostel owner read" on public.leads;
create policy "leads hostel owner read" on public.leads for select using (hostel_id is not null and public.owns_hostel(hostel_id));
