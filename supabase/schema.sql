-- =====================================================================
-- StudyEarnstay.com — Supabase schema
-- Run this whole file once in Supabase Dashboard → SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
-- =====================================================================

-- gen_random_uuid() is built into Postgres 13+, no extension needed.

-- ---------------------------------------------------------------------
-- PROFILES (one row per auth user)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  city        text,
  country     text,
  course_interest text,
  role        text not null default 'student'
              check (role in ('student','admin','super_admin')),
  is_blocked  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Create profile automatically when a user signs up with email OTP.
-- Name / phone passed in signInWithOtp({ options: { data: {...} } }) are copied.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'phone','')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers used by RLS policies
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','super_admin') and not is_blocked
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not is_blocked);
$$;

-- Students may not promote themselves or unblock themselves.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_blocked := old.is_blocked;
    new.email := old.email;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------
-- COLLEGES
-- ---------------------------------------------------------------------
create table if not exists public.colleges (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  short_name    text,
  type          text default 'Private' check (type in ('Public','Private','Deemed','Autonomous','Other')),
  country       text not null,
  state         text,
  city          text not null,
  address       text,
  latitude      double precision,
  longitude     double precision,
  established   int,
  ranking       int,
  accreditation text,
  website       text,
  email         text,
  phone         text,
  description   text,
  fees_min      numeric,
  fees_max      numeric,
  currency      text default 'INR',
  streams       text[] default '{}',     -- Engineering, Medical, MBA ...
  facilities    text[] default '{}',     -- Library, Wi-Fi, Hostel ...
  logo_url      text,
  cover_url     text,
  photos        text[] default '{}',
  is_featured   boolean default false,
  is_published  boolean default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists colleges_country_city_idx on public.colleges (country, city);
create index if not exists colleges_name_trgm_idx on public.colleges using gin (to_tsvector('simple', name || ' ' || coalesce(city,'') || ' ' || coalesce(country,'')));

create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  college_id  uuid not null references public.colleges(id) on delete cascade,
  name        text not null,              -- B.Tech Computer Science
  level       text default 'UG' check (level in ('UG','PG','Diploma','PhD','Certificate')),
  duration    text,                       -- 4 years
  fees        numeric,                    -- per year
  currency    text default 'INR',
  seats       int,
  eligibility text,
  created_at  timestamptz default now()
);
create index if not exists courses_college_idx on public.courses (college_id);

-- Nearby companies / hospitals / banks etc. shown on a college page
create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  college_id  uuid not null references public.colleges(id) on delete cascade,
  kind        text not null check (kind in ('company','hospital','bank','transport','other')),
  name        text not null,
  address     text,
  distance_km numeric,
  phone       text,
  website     text,
  created_at  timestamptz default now()
);
create index if not exists places_college_idx on public.places (college_id, kind);

-- ---------------------------------------------------------------------
-- PG / HOSTELS
-- ---------------------------------------------------------------------
create table if not exists public.hostels (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text default 'PG' check (type in ('PG','Hostel','Flat','Homestay')),
  gender        text default 'Co-ed' check (gender in ('Boys','Girls','Co-ed')),
  college_id    uuid references public.colleges(id) on delete set null,
  country       text not null,
  city          text not null,
  address       text,
  latitude      double precision,
  longitude     double precision,
  rent_min      numeric,
  rent_max      numeric,
  currency      text default 'INR',
  rent_period   text default 'month',
  amenities     text[] default '{}',     -- Food, AC, Wi-Fi, Laundry
  description   text,
  photos        text[] default '{}',
  contact_name  text,
  contact_phone text,
  contact_email text,
  is_verified   boolean default false,
  is_published  boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists hostels_city_idx on public.hostels (country, city);
create index if not exists hostels_college_idx on public.hostels (college_id);

-- ---------------------------------------------------------------------
-- PART-TIME JOBS
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  company       text not null,
  company_logo  text,
  job_type      text default 'Part-time' check (job_type in ('Part-time','Internship','Full-time','Freelance','Weekend')),
  college_id    uuid references public.colleges(id) on delete set null,
  country       text not null,
  city          text not null,
  address       text,
  latitude      double precision,
  longitude     double precision,
  is_remote     boolean default false,
  pay_min       numeric,
  pay_max       numeric,
  currency      text default 'INR',
  pay_unit      text default 'month' check (pay_unit in ('hour','day','week','month','project')),
  hours_per_week int,
  description   text,
  requirements  text,
  skills        text[] default '{}',
  deadline      date,
  status        text default 'open' check (status in ('open','closed')),
  is_published  boolean default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists jobs_city_idx on public.jobs (country, city);
create index if not exists jobs_college_idx on public.jobs (college_id);

create table if not exists public.job_applications (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  full_name     text not null,
  phone         text not null,
  email         text,
  cover_letter  text,
  resume_path   text,                    -- path inside private "resumes" bucket
  status        text default 'pending' check (status in ('pending','shortlisted','rejected','hired')),
  admin_note    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (job_id, user_id)
);
create index if not exists applications_user_idx on public.job_applications (user_id);

-- ---------------------------------------------------------------------
-- REVIEWS
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  college_id      uuid not null references public.colleges(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  rating          int not null check (rating between 1 and 5),
  rating_faculty  int check (rating_faculty between 1 and 5),
  rating_campus   int check (rating_campus between 1 and 5),
  rating_placement int check (rating_placement between 1 and 5),
  title           text not null,
  body            text not null,
  course          text,
  batch_year      int,
  status          text not null default 'approved' check (status in ('approved','pending','blocked')),
  edited_by_admin boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (college_id, user_id)
);
create index if not exists reviews_college_idx on public.reviews (college_id, status);

-- Public view with reviewer first name only (no email/phone leak)
create or replace view public.reviews_public
with (security_invoker = false) as
select r.id, r.college_id, r.rating, r.rating_faculty, r.rating_campus, r.rating_placement,
       r.title, r.body, r.course, r.batch_year, r.edited_by_admin, r.created_at,
       coalesce(split_part(p.full_name,' ',1),'Student') as reviewer_name
from public.reviews r
left join public.profiles p on p.id = r.user_id
where r.status = 'approved';

-- Rating summary per college
create or replace view public.college_ratings
with (security_invoker = false) as
select college_id, round(avg(rating)::numeric,1) as avg_rating, count(*)::int as review_count
from public.reviews where status = 'approved'
group by college_id;

-- ---------------------------------------------------------------------
-- SITE VISITS (how many students come to the site)
-- ---------------------------------------------------------------------
create table if not exists public.site_visits (
  id          bigint generated always as identity primary key,
  visitor_id  text not null,          -- anonymous id stored in browser
  user_id     uuid references public.profiles(id) on delete set null,
  path        text,
  referrer    text,
  user_agent  text,
  country     text,
  created_at  timestamptz default now()
);
create index if not exists site_visits_created_idx on public.site_visits (created_at);
create index if not exists site_visits_visitor_idx on public.site_visits (visitor_id);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['colleges','hostels','jobs','job_applications','reviews'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- Users editing their own review: send back to approved unless blocked, never let them unblock
create or replace function public.protect_review_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.status := case when old.status = 'blocked' then 'blocked' else new.status end;
    if new.status not in ('approved','pending') then new.status := old.status; end if;
    new.edited_by_admin := old.edited_by_admin;
    new.user_id := old.user_id;
    new.college_id := old.college_id;
  end if;
  return new;
end $$;
drop trigger if exists reviews_protect on public.reviews;
create trigger reviews_protect before update on public.reviews
  for each row execute function public.protect_review_columns();

-- Applicants may only change their cover letter / resume, never the status
create or replace function public.protect_application_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.status := old.status;
    new.admin_note := old.admin_note;
    new.user_id := old.user_id;
    new.job_id := old.job_id;
  end if;
  return new;
end $$;
drop trigger if exists applications_protect on public.job_applications;
create trigger applications_protect before update on public.job_applications
  for each row execute function public.protect_application_columns();

-- ---------------------------------------------------------------------
-- NEARBY search (Haversine, no PostGIS needed)
-- ---------------------------------------------------------------------
create or replace function public.distance_km(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.nearby_colleges(lat double precision, lng double precision, radius_km double precision default 50)
returns table (id uuid, slug text, name text, city text, country text, cover_url text, logo_url text,
               fees_min numeric, fees_max numeric, currency text, distance numeric)
language sql stable as $$
  select c.id, c.slug, c.name, c.city, c.country, c.cover_url, c.logo_url, c.fees_min, c.fees_max, c.currency,
         round(public.distance_km(lat, lng, c.latitude, c.longitude)::numeric, 1)
  from public.colleges c
  where c.is_published and c.latitude is not null
    and public.distance_km(lat, lng, c.latitude, c.longitude) <= radius_km
  order by 11 limit 50;
$$;

create or replace function public.nearby_hostels(lat double precision, lng double precision, radius_km double precision default 10)
returns table (id uuid, name text, type text, gender text, city text, country text, photos text[],
               rent_min numeric, rent_max numeric, currency text, amenities text[], distance numeric)
language sql stable as $$
  select h.id, h.name, h.type, h.gender, h.city, h.country, h.photos, h.rent_min, h.rent_max, h.currency, h.amenities,
         round(public.distance_km(lat, lng, h.latitude, h.longitude)::numeric, 1)
  from public.hostels h
  where h.is_published and h.latitude is not null
    and public.distance_km(lat, lng, h.latitude, h.longitude) <= radius_km
  order by 12 limit 50;
$$;

create or replace function public.nearby_jobs(lat double precision, lng double precision, radius_km double precision default 15)
returns table (id uuid, title text, company text, job_type text, city text, country text,
               pay_min numeric, pay_max numeric, currency text, pay_unit text, is_remote boolean, distance numeric)
language sql stable as $$
  select j.id, j.title, j.company, j.job_type, j.city, j.country, j.pay_min, j.pay_max, j.currency, j.pay_unit, j.is_remote,
         round(public.distance_km(lat, lng, j.latitude, j.longitude)::numeric, 1)
  from public.jobs j
  where j.is_published and j.status = 'open' and j.latitude is not null
    and public.distance_km(lat, lng, j.latitude, j.longitude) <= radius_km
  order by 12 limit 50;
$$;

-- Public counters for the homepage
create or replace function public.site_counters()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'colleges',  (select count(*) from colleges where is_published),
    'countries', (select count(distinct country) from colleges where is_published),
    'hostels',   (select count(*) from hostels where is_published),
    'jobs',      (select count(*) from jobs where is_published and status = 'open'),
    'students',  (select count(*) from profiles),
    'reviews',   (select count(*) from reviews where status = 'approved')
  );
$$;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.colleges          enable row level security;
alter table public.courses           enable row level security;
alter table public.places            enable row level security;
alter table public.hostels           enable row level security;
alter table public.jobs              enable row level security;
alter table public.job_applications  enable row level security;
alter table public.reviews           enable row level security;
alter table public.site_visits       enable row level security;

-- profiles
drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles admin all"   on public.profiles;
create policy "profiles self read"   on public.profiles for select using (id = auth.uid());
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin all"   on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- public catalogue tables: anyone reads published rows, admins do everything
do $$
declare t text;
begin
  foreach t in array array['colleges','hostels','jobs'] loop
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('drop policy if exists "%s admin all" on public.%I', t, t);
    execute format('create policy "%s public read" on public.%I for select using (is_published or public.is_admin())', t, t);
    execute format('create policy "%s admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
  foreach t in array array['courses','places'] loop
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('drop policy if exists "%s admin all" on public.%I', t, t);
    execute format('create policy "%s public read" on public.%I for select using (true)', t, t);
    execute format('create policy "%s admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- reviews
drop policy if exists "reviews public read"  on public.reviews;
drop policy if exists "reviews own insert"   on public.reviews;
drop policy if exists "reviews own update"   on public.reviews;
drop policy if exists "reviews own delete"   on public.reviews;
drop policy if exists "reviews admin all"    on public.reviews;
create policy "reviews public read" on public.reviews for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "reviews own insert"  on public.reviews for insert with check (user_id = auth.uid() and public.is_active_user() and status in ('approved','pending'));
create policy "reviews own update"  on public.reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews own delete"  on public.reviews for delete using (user_id = auth.uid());
create policy "reviews admin all"   on public.reviews for all using (public.is_admin()) with check (public.is_admin());

-- job applications
drop policy if exists "apps own read"   on public.job_applications;
drop policy if exists "apps own insert" on public.job_applications;
drop policy if exists "apps own update" on public.job_applications;
drop policy if exists "apps own delete" on public.job_applications;
drop policy if exists "apps admin all"  on public.job_applications;
create policy "apps own read"   on public.job_applications for select using (user_id = auth.uid());
create policy "apps own insert" on public.job_applications for insert with check (
  user_id = auth.uid() and public.is_active_user() and status = 'pending'
  and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'open' and j.is_published)
);
create policy "apps own update" on public.job_applications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "apps own delete" on public.job_applications for delete using (user_id = auth.uid() and status = 'pending');
create policy "apps admin all"  on public.job_applications for all using (public.is_admin()) with check (public.is_admin());

-- site visits: written only by the Node API (service role); admins can read
drop policy if exists "visits admin read" on public.site_visits;
create policy "visits admin read" on public.site_visits for select using (public.is_admin());

grant select on public.reviews_public, public.college_ratings to anon, authenticated;
grant execute on function public.nearby_colleges, public.nearby_hostels, public.nearby_jobs, public.site_counters to anon, authenticated;

-- ---------------------------------------------------------------------
-- STORAGE BUCKETS
--   media   : public  — college/hostel photos, logos (admin uploads via Node API)
--   resumes : private — student CVs, path = <user_id>/<file>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media','media', true), ('resumes','resumes', false)
on conflict (id) do nothing;

drop policy if exists "media public read"   on storage.objects;
drop policy if exists "media admin write"   on storage.objects;
drop policy if exists "resume own upload"   on storage.objects;
drop policy if exists "resume own read"     on storage.objects;
drop policy if exists "resume admin read"   on storage.objects;

create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "media admin write" on storage.objects for all
  using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());
create policy "resume own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resume own read" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resume admin read" on storage.objects for select
  using (bucket_id = 'resumes' and public.is_admin());

-- ---------------------------------------------------------------------
-- MAKE YOURSELF SUPER ADMIN (run after you log in once with your email):
--   update public.profiles set role = 'super_admin' where email = 'you@example.com';
-- ---------------------------------------------------------------------
