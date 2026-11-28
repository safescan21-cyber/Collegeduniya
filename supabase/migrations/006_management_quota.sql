-- =====================================================================
-- Collegeolo.com — migration 006: Management quota admissions
-- Admins post management / NRI / institutional quota seats for a college + course;
-- logged-in students apply (with documents); admins track every application.
-- Run AFTER 005. Safe to re-run.
-- =====================================================================

create table if not exists public.quota_seats (
  id                 uuid primary key default gen_random_uuid(),
  college_id         uuid not null references public.colleges(id) on delete cascade,
  course             text not null,                       -- e.g. B.Tech Computer Science
  level              text default 'UG' check (level in ('UG','PG','Diploma','PhD','Certificate','Other')),
  quota_type         text not null default 'Management'
                     check (quota_type in ('Management','NRI','NRI Sponsored','Institutional','Foreign National','Other')),
  academic_year      text,                                -- e.g. 2027-28
  seats_total        int check (seats_total is null or seats_total >= 0),
  seats_available    int check (seats_available is null or seats_available >= 0),
  fee_per_year       numeric,                             -- official tuition per year
  total_fee          numeric,                             -- whole course, if known
  currency           text not null default 'INR',
  fee_note           text,                                -- hostel / one-time charges, instalments
  eligibility        text,
  min_percentage     numeric,
  exams_accepted     text[] default '{}',                 -- JEE Main, NEET, CAT, none …
  documents_required text[] default '{}',
  last_date          date,
  description        text,
  status             text not null default 'open' check (status in ('open','closed','filled')),
  is_published       boolean not null default true,
  is_featured        boolean not null default false,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists quota_seats_college_idx on public.quota_seats (college_id);
create index if not exists quota_seats_open_idx on public.quota_seats (status, is_published, last_date);

create table if not exists public.quota_applications (
  id                  uuid primary key default gen_random_uuid(),
  seat_id             uuid not null references public.quota_seats(id) on delete cascade,
  college_id          uuid references public.colleges(id) on delete cascade,   -- filled by trigger
  user_id             uuid not null references public.profiles(id) on delete cascade,
  full_name           text not null,
  email               text not null,
  phone               text not null,
  dob                 date,
  gender              text,
  city                text,
  state               text,
  country             text,
  parent_name         text,
  parent_phone        text,
  qualification       text,
  board_or_university text,
  percentage          numeric,
  passing_year        int,
  entrance_exam       text,
  entrance_score      text,
  category            text,
  message             text,
  documents           text[] not null default '{}',  -- paths in the private "resumes" bucket: <user_id>/quota-…
  fee_acknowledged    boolean not null default false,
  status              text not null default 'submitted'
                      check (status in ('submitted','under_review','contacted','shortlisted','offered','admitted','rejected','withdrawn')),
  admin_note          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (seat_id, user_id)
);
create index if not exists quota_apps_user_idx on public.quota_applications (user_id);
create index if not exists quota_apps_status_idx on public.quota_applications (status, created_at desc);
create index if not exists quota_apps_seat_idx on public.quota_applications (seat_id);

-- ---------------------------------------------------------------- RLS
alter table public.quota_seats enable row level security;
drop policy if exists "quota seats public read" on public.quota_seats;
drop policy if exists "quota seats admin all" on public.quota_seats;
create policy "quota seats public read" on public.quota_seats for select using (
  is_published and exists (select 1 from public.colleges c where c.id = college_id and c.is_published)
  and not public.college_section_hidden(college_id, 'quota')
);
create policy "quota seats admin all" on public.quota_seats for all using (public.is_admin()) with check (public.is_admin());

alter table public.quota_applications enable row level security;
drop policy if exists "quota apps own read" on public.quota_applications;
drop policy if exists "quota apps own insert" on public.quota_applications;
drop policy if exists "quota apps own withdraw" on public.quota_applications;
drop policy if exists "quota apps admin all" on public.quota_applications;
create policy "quota apps own read" on public.quota_applications for select using (user_id = auth.uid());
create policy "quota apps own insert" on public.quota_applications for insert with check (
  user_id = auth.uid() and public.is_active_user() and status = 'submitted' and fee_acknowledged
  and exists (
    select 1 from public.quota_seats s join public.colleges c on c.id = s.college_id
    where s.id = seat_id and s.is_published and s.status = 'open' and c.is_published
      and (s.last_date is null or s.last_date >= current_date)
      and (s.seats_available is null or s.seats_available > 0)
      and not public.college_section_hidden(s.college_id, 'quota')
  )
);
create policy "quota apps own withdraw" on public.quota_applications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quota apps admin all" on public.quota_applications for all using (public.is_admin()) with check (public.is_admin());

-- college_id always comes from the seat; students can only withdraw
create or replace function public.quota_application_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select college_id into new.college_id from quota_seats where id = new.seat_id;
    if not public.is_admin() and auth.uid() is not null then
      new.status := 'submitted'; new.admin_note := null;
      -- documents must live in the student's own folder
      if exists (select 1 from unnest(new.documents) d where split_part(d, '/', 1) <> auth.uid()::text) then
        raise exception 'Invalid document path';
      end if;
    end if;
    return new;
  end if;
  if public.is_admin() or auth.uid() is null then
    new.college_id := (select college_id from quota_seats where id = new.seat_id);
    return new;
  end if;
  if new.status <> old.status and not (new.status = 'withdrawn' and old.status in ('submitted','under_review','contacted')) then
    new.status := old.status;
  end if;
  new.admin_note := old.admin_note; new.user_id := old.user_id; new.seat_id := old.seat_id;
  new.college_id := old.college_id; new.documents := old.documents; new.fee_acknowledged := old.fee_acknowledged;
  return new;
end $$;
drop trigger if exists quota_apps_guard on public.quota_applications;
create trigger quota_apps_guard before insert or update on public.quota_applications
  for each row execute function public.quota_application_guard();

do $$
declare t text;
begin
  foreach t in array array['quota_seats','quota_applications'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- public listing view (seat + college card info)
drop view if exists public.quota_seats_public;
create view public.quota_seats_public as
select s.id, s.college_id, s.course, s.level, s.quota_type, s.academic_year, s.seats_total, s.seats_available,
       case when 'fees' = any(c.hidden_fields) then null else s.fee_per_year end as fee_per_year,
       case when 'fees' = any(c.hidden_fields) then null else s.total_fee end as total_fee,
       s.currency, case when 'fees' = any(c.hidden_fields) then null else s.fee_note end as fee_note,
       s.eligibility, s.min_percentage, s.exams_accepted, s.documents_required, s.last_date, s.description,
       case when s.last_date is not null and s.last_date < current_date then 'closed' else s.status end as status,
       s.is_featured, s.created_at,
       c.slug as college_slug, c.name as college_name, c.short_name as college_short_name, c.city, c.state, c.country,
       c.country_code, c.type as college_type,
       case when 'logo' = any(c.hidden_fields) then null else c.logo_url end as logo_url,
       case when 'photos' = any(c.hidden_fields) then null else c.cover_url end as cover_url,
       case when 'accreditation' = any(c.hidden_fields) then null else c.accreditation end as accreditation
from public.quota_seats s
join public.colleges c on c.id = s.college_id
where s.is_published and c.is_published and not public.college_section_hidden(s.college_id, 'quota');
grant select on public.quota_seats_public to anon, authenticated;
