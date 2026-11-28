-- 056 · College website check (services/websiteCheck.js)
--   Some stored websites were wrong: written without https:// (the browser then opened a page on Collegeolo instead),
--   domains that have expired, been sold / parked, or now redirect somewhere unrelated (spam, betting…).
--   1. addresses without a scheme get https://
--   2. the server checks every website (ranked & most viewed first) and records what it found:
--        ok · moved (now redirects to another address — admin decides) · blocked (site refuses servers: not judged)
--        dead (domain doesn't exist / page gone, seen twice) · bad (parked, for sale or spam) → hidden from the public page
--   3. Admin → Website check lists the problems; "Use new address", "Remove website" or "It's fine".

alter table public.colleges add column if not exists website_status text check (website_status in ('ok', 'moved', 'blocked', 'dead', 'bad'));
alter table public.colleges add column if not exists website_final text;
alter table public.colleges add column if not exists website_note text;
alter table public.colleges add column if not exists website_checked_at timestamptz;
alter table public.colleges add column if not exists website_fails int not null default 0;
create index if not exists colleges_website_problem_idx on public.colleges (website_status) where website_status in ('moved', 'dead', 'bad');

update public.colleges set website = 'https://' || regexp_replace(trim(website), '^/+', '')
 where website is not null and trim(website) <> '' and trim(website) !~* '^https?://' and trim(website) ~* '^[a-z0-9-]+(\.[a-z0-9-]+)+(/|$)';

create or replace view public.colleges_public with (security_invoker = false) as
select
  c.id, c.slug, c.name, c.short_name, c.type, c.country, c.country_code, c.state, c.district, c.city, c.city_geoname_id,
  case when 'address' = any(c.hidden_fields) then null else c.address end as address,
  case when 'map' = any(c.hidden_fields) then null else c.latitude end as latitude,
  case when 'map' = any(c.hidden_fields) then null else c.longitude end as longitude,
  case when 'established' = any(c.hidden_fields) then null else c.established end as established,
  case when 'ranking' = any(c.hidden_fields) then null else c.ranking end as ranking,
  case when 'accreditation' = any(c.hidden_fields) then null else c.accreditation end as accreditation,
  case when 'website' = any(c.hidden_fields) or c.website_status in ('dead', 'bad') then null else c.website end as website,
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
  c.created_at, c.updated_at, c.data_updated_at,
  c.approvals, c.exams_accepted, c.brochure_url,
  case when 'admission' = any(c.hidden_sections) then null else c.admission_process end as admission_process,
  case when 'admission' = any(c.hidden_sections) then null else c.important_dates end as important_dates,
  case when 'scholarships' = any(c.hidden_sections) then null else c.scholarship_info end as scholarship_info,
  case when 'faqs' = any(c.hidden_sections) then null else c.faqs end as faqs,
  c.details_source,
  c.website_status
from public.colleges c
where c.is_published;
grant select on public.colleges_public to anon, authenticated;

-- next websites to check: never checked → ranked / viewed first → oldest check; problems re-checked after 3 days, ok after 30
create or replace function public.website_check_targets(p_lim int default 200)
returns table (id uuid, name text, website text, website_status text, website_fails int)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.website, c.website_status, c.website_fails
  from colleges c
  where c.is_published and c.website is not null
    and (c.website_checked_at is null
         or (c.website_status in ('dead', 'bad', 'moved', 'blocked') and c.website_checked_at < now() - interval '3 days')
         or c.website_checked_at < now() - interval '30 days')
  order by c.website_checked_at nulls first,
           exists (select 1 from college_rankings r where r.college_id = c.id and r.rank is not null) desc,
           c.ranking nulls last
  limit least(greatest(coalesce(p_lim, 200), 1), 1000);
$$;
revoke execute on function public.website_check_targets(int) from public, anon, authenticated;
