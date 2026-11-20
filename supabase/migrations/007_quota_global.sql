-- =====================================================================
-- StudyEarnstay.com — migration 007: management quota / direct admission worldwide
-- Any country, any currency, international-student fields. Run AFTER 006. Safe to re-run.
-- =====================================================================

-- More admission routes (India's management/NRI quota, plus direct / self-financed /
-- international-student seats used in the UK, US, Australia, Canada, Europe, Asia, Africa…)
alter table public.quota_seats drop constraint if exists quota_seats_quota_type_check;
alter table public.quota_seats add constraint quota_seats_quota_type_check check (quota_type in (
  'Management','NRI','NRI Sponsored','Institutional','Foreign National',
  'International','Direct admission','Self-financed','Private / fee-paying','Scholarship','Other'));

alter table public.quota_seats drop constraint if exists quota_seats_level_check;
alter table public.quota_seats add constraint quota_seats_level_check check (level in (
  'Foundation','UG','PG','Diploma','PhD','Certificate','Language','Other'));

-- Currency: blank → the college's currency → its country's currency → USD
alter table public.quota_seats alter column currency drop not null;
alter table public.quota_seats alter column currency drop default;
alter table public.quota_seats add column if not exists fee_period         text not null default 'year'
  check (fee_period in ('year','semester','term','month','total'));
alter table public.quota_seats add column if not exists intake             text;   -- "September 2027", "Fall 2027", "July session"
alter table public.quota_seats add column if not exists english_requirement text;  -- "IELTS 6.5 (no band < 6.0) / TOEFL iBT 90"
alter table public.quota_seats add column if not exists scholarship_note   text;
alter table public.quota_seats add column if not exists open_to            text not null default 'all'
  check (open_to in ('all','domestic','international'));

create or replace function public.quota_seat_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.currency is null or new.currency = '' then
    select coalesce(nullif(c.currency, ''), k.currency_code) into new.currency
    from colleges c
    left join countries k on k.code = c.country_code or (c.country_code is null and lower(k.name) = lower(c.country))
    where c.id = new.college_id limit 1;
    new.currency := coalesce(new.currency, 'USD');
  end if;
  new.currency := upper(new.currency);
  return new;
end $$;
drop trigger if exists quota_seats_defaults on public.quota_seats;
create trigger quota_seats_defaults before insert or update on public.quota_seats
  for each row execute function public.quota_seat_defaults();
update public.quota_seats set currency = currency;   -- normalise existing rows

-- International applicant details
alter table public.quota_applications add column if not exists nationality    text;
alter table public.quota_applications add column if not exists english_test   text;   -- IELTS / TOEFL / PTE / Duolingo / none
alter table public.quota_applications add column if not exists english_score  text;
alter table public.quota_applications add column if not exists needs_visa     boolean;
alter table public.quota_applications add column if not exists preferred_lang text;   -- site language the student used

-- Public view with the new fields + the country's continent for filtering
drop view if exists public.quota_seats_public;
create view public.quota_seats_public as
select s.id, s.college_id, s.course, s.level, s.quota_type, s.academic_year, s.intake, s.open_to,
       s.seats_total, s.seats_available,
       case when 'fees' = any(c.hidden_fields) then null else s.fee_per_year end as fee_per_year,
       case when 'fees' = any(c.hidden_fields) then null else s.total_fee end as total_fee,
       s.currency, s.fee_period,
       case when 'fees' = any(c.hidden_fields) then null else s.fee_note end as fee_note,
       s.scholarship_note, s.english_requirement,
       s.eligibility, s.min_percentage, s.exams_accepted, s.documents_required, s.last_date, s.description,
       case when s.last_date is not null and s.last_date < current_date then 'closed' else s.status end as status,
       s.is_featured, s.created_at,
       c.slug as college_slug, c.name as college_name, c.short_name as college_short_name, c.city, c.state, c.country,
       coalesce(c.country_code, k.code) as country_code, k.continent, c.type as college_type,
       case when 'logo' = any(c.hidden_fields) then null else c.logo_url end as logo_url,
       case when 'photos' = any(c.hidden_fields) then null else c.cover_url end as cover_url,
       case when 'accreditation' = any(c.hidden_fields) then null else c.accreditation end as accreditation
from public.quota_seats s
join public.colleges c on c.id = s.college_id
left join public.countries k on k.code = c.country_code or (c.country_code is null and lower(k.name) = lower(c.country))
where s.is_published and c.is_published and not public.college_section_hidden(s.college_id, 'quota');
grant select on public.quota_seats_public to anon, authenticated;

-- Countries that currently have open seats (for the country chips / sitemap)
create or replace function public.quota_countries()
returns table (country_code text, country text, seats bigint)
language sql stable security definer set search_path = public as $$
  select country_code, max(country), count(*) from quota_seats_public
  where status = 'open' and country_code is not null group by country_code order by count(*) desc;
$$;
grant execute on function public.quota_countries() to anon, authenticated;
