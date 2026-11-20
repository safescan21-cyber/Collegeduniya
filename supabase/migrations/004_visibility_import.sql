-- =====================================================================
-- StudyEarnstay.com — migration 004: per-college visibility + bulk imports
-- Run AFTER 003_global.sql. Safe to re-run.
--
-- Admins can hide a whole college (is_published), single fields (fees,
-- contact details, website, address, ranking…) or whole sections
-- (courses, placements, cutoffs, reviews, Q&A…). Hidden data is removed
-- at the database level for visitors — not just hidden in the page.
-- =====================================================================

alter table public.colleges add column if not exists hidden_fields   text[] not null default '{}';
alter table public.colleges add column if not exists hidden_sections text[] not null default '{}';
alter table public.colleges add column if not exists district        text;
alter table public.colleges add column if not exists management      text;     -- e.g. Private Un-Aided, State Government
alter table public.colleges add column if not exists affiliated_to   text;     -- affiliating university
alter table public.colleges add column if not exists admission_rate  numeric;  -- 0..1 (US Scorecard)
alter table public.colleges add column if not exists facts           jsonb not null default '{}'::jsonb;  -- extra source data
alter table public.colleges add column if not exists admin_note      text;     -- internal only, never shown

-- Allowed values (documented here; enforced in the API):
--   hidden_fields:   fees, contact, website, address, map, ranking, accreditation, established, students, logo, photos, description
--   hidden_sections: courses, placements, cutoffs, reviews, qa, hostels, jobs, nearby, gallery, apply, enquiry

create or replace function public.college_section_hidden(cid uuid, section text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select section = any(hidden_sections) or not is_published from public.colleges where id = cid), true);
$$;

-- ---------------------------------------------------------------------
-- Public view: published colleges with hidden fields blanked out.
-- The website reads this view; admins edit the table through the API.
-- ---------------------------------------------------------------------
drop view if exists public.colleges_public;
create view public.colleges_public with (security_invoker = false) as
select
  c.id, c.slug, c.name, c.short_name, c.type, c.country, c.country_code, c.state, c.district, c.city, c.city_geoname_id,
  case when 'address' = any(c.hidden_fields) then null else c.address end as address,
  case when 'map' = any(c.hidden_fields) then null else c.latitude end as latitude,
  case when 'map' = any(c.hidden_fields) then null else c.longitude end as longitude,
  case when 'established' = any(c.hidden_fields) then null else c.established end as established,
  case when 'ranking' = any(c.hidden_fields) then null else c.ranking end as ranking,
  case when 'accreditation' = any(c.hidden_fields) then null else c.accreditation end as accreditation,
  case when 'website' = any(c.hidden_fields) then null else c.website end as website,
  case when 'contact' = any(c.hidden_fields) then null else c.email end as email,
  case when 'contact' = any(c.hidden_fields) then null else c.phone end as phone,
  case when 'description' = any(c.hidden_fields) then null else c.description end as description,
  case when 'fees' = any(c.hidden_fields) then null else c.fees_min end as fees_min,
  case when 'fees' = any(c.hidden_fields) then null else c.fees_max end as fees_max,
  c.currency, c.streams, c.facilities,
  case when 'logo' = any(c.hidden_fields) then null else c.logo_url end as logo_url,
  case when 'photos' = any(c.hidden_fields) then null else c.cover_url end as cover_url,
  case when 'photos' = any(c.hidden_fields) or 'gallery' = any(c.hidden_sections) then '{}'::text[] else c.photos end as photos,
  case when 'students' = any(c.hidden_fields) then null else c.students_count end as students_count,
  c.admission_rate, c.management, c.affiliated_to, c.facts,
  c.is_featured, c.is_published, c.accepts_applications and not ('apply' = any(c.hidden_sections)) as accepts_applications,
  c.application_note, c.source, c.wikidata_id, c.hidden_sections, c.hidden_fields,
  c.created_at, c.updated_at, c.data_updated_at
from public.colleges c
where c.is_published;
grant select on public.colleges_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- Hidden sections are also locked at row level
-- ---------------------------------------------------------------------
do $$
declare t text; s text;
begin
  for t, s in select * from (values ('courses','courses'), ('college_placements','placements'), ('cutoffs','cutoffs'), ('places','nearby')) v(t, s) loop
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('create policy "%s public read" on public.%I for select using (not public.college_section_hidden(college_id, %L) or public.is_admin())', t, t, s);
  end loop;
end $$;

create or replace view public.reviews_public
with (security_invoker = false) as
select r.id, r.college_id, r.rating, r.rating_faculty, r.rating_campus, r.rating_placement,
       r.title, r.body, r.course, r.batch_year, r.edited_by_admin, r.created_at,
       coalesce(split_part(p.full_name,' ',1),'Student') as reviewer_name,
       r.is_verified
from public.reviews r
left join public.profiles p on p.id = r.user_id
join public.colleges c on c.id = r.college_id and c.is_published and not ('reviews' = any(c.hidden_sections))
where r.status = 'approved';

create or replace view public.college_ratings
with (security_invoker = false) as
select r.college_id, round(avg(r.rating)::numeric,1) as avg_rating, count(*)::int as review_count
from public.reviews r
join public.colleges c on c.id = r.college_id and not ('reviews' = any(c.hidden_sections))
where r.status = 'approved'
group by r.college_id;

create or replace view public.questions_public with (security_invoker = false) as
select q.id, q.college_id, q.title, q.body, q.created_at,
       coalesce(split_part(p.full_name,' ',1),'Student') as asker_name,
       c.name as college_name, c.slug as college_slug,
       (select count(*) from public.answers a where a.question_id = q.id and a.status = 'approved')::int as answer_count
from public.questions q
left join public.profiles p on p.id = q.user_id
left join public.colleges c on c.id = q.college_id
where q.status = 'approved' and (q.college_id is null or (c.is_published and not ('qa' = any(c.hidden_sections))));

grant select on public.reviews_public, public.college_ratings, public.questions_public to anon, authenticated;

-- Nearby search must not leak hidden fees / hidden map position
create or replace function public.nearby_colleges(lat double precision, lng double precision, radius_km double precision default 50)
returns table (id uuid, slug text, name text, city text, country text, cover_url text, logo_url text,
               fees_min numeric, fees_max numeric, currency text, distance numeric)
language sql stable as $$
  select c.id, c.slug, c.name, c.city, c.country,
         case when 'photos' = any(c.hidden_fields) then null else c.cover_url end,
         case when 'logo' = any(c.hidden_fields) then null else c.logo_url end,
         case when 'fees' = any(c.hidden_fields) then null else c.fees_min end,
         case when 'fees' = any(c.hidden_fields) then null else c.fees_max end,
         c.currency,
         round(public.distance_km(lat, lng, c.latitude, c.longitude)::numeric, 1)
  from public.colleges c
  where c.is_published and c.latitude is not null and not ('map' = any(c.hidden_fields))
    and public.distance_km(lat, lng, c.latitude, c.longitude) <= radius_km
  order by 11 limit 50;
$$;

create index if not exists colleges_district_idx on public.colleges (country, state, district);
