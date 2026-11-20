-- =====================================================================
-- StudyEarnstay.com — migration 005: free college details & photos
-- (Wikidata + Wikipedia + Wikimedia Commons). Run AFTER 004. Safe to re-run.
-- =====================================================================

alter table public.colleges add column if not exists wikipedia_url      text;
alter table public.colleges add column if not exists photo_credits      jsonb not null default '[]'::jsonb;  -- [{url, author, license, license_url, page}]
alter table public.colleges add column if not exists description_source text;   -- 'wikipedia' | null (written by your team)
alter table public.colleges add column if not exists enriched_at        timestamptz;
alter table public.colleges add column if not exists enrich_status      text;   -- matched | no_match | error
create index if not exists colleges_enrich_idx on public.colleges (enriched_at nulls first);

-- Public view gets the new columns (photo credits disappear when photos are hidden)
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
  case when 'photos' = any(c.hidden_fields) then '[]'::jsonb else c.photo_credits end as photo_credits,
  case when 'description' = any(c.hidden_fields) then null else c.description_source end as description_source,
  c.wikipedia_url,
  c.is_featured, c.is_published, c.accepts_applications and not ('apply' = any(c.hidden_sections)) as accepts_applications,
  c.application_note, c.source, c.wikidata_id, c.hidden_sections, c.hidden_fields,
  c.created_at, c.updated_at, c.data_updated_at
from public.colleges c
where c.is_published;
grant select on public.colleges_public to anon, authenticated;

-- fast lookups for city pages / filters with large imports
create index if not exists colleges_city_gid_idx on public.colleges (city_geoname_id);
create index if not exists colleges_institution_idx on public.colleges ((facts->>'institution'));
create index if not exists colleges_state_idx on public.colleges (country_code, state);
