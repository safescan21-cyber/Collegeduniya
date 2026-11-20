-- =====================================================================
-- StudyEarnstay.com — migration 002: growth features
-- Run AFTER schema.sql, in Supabase → SQL Editor. Safe to re-run.
--
-- Adds: shortlist, enquiries/leads & counselling, PG reviews, owner/employer
-- self-listing, Q&A, articles/news, exams, newsletter, placements, cutoffs,
-- college predictor, common application, verified/rewarded reviews.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SHORTLIST (saved colleges / PGs / jobs)
-- ---------------------------------------------------------------------
create table if not exists public.saved_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_type  text not null check (item_type in ('college','hostel','job')),
  item_id    uuid not null,
  created_at timestamptz default now(),
  unique (user_id, item_type, item_id)
);
alter table public.saved_items enable row level security;
drop policy if exists "saved own" on public.saved_items;
create policy "saved own" on public.saved_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. LEADS — counselling requests and college / PG enquiries
--    Inserted by the Node API (rate-limited, spam-checked).
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null default 'counselling' check (kind in ('counselling','college','hostel','job','other')),
  college_id      uuid references public.colleges(id) on delete set null,
  hostel_id       uuid references public.hostels(id) on delete set null,
  user_id         uuid references public.profiles(id) on delete set null,
  full_name       text not null,
  email           text,
  phone           text not null,
  city            text,
  course_interest text,
  message         text,
  source_path     text,
  status          text not null default 'new' check (status in ('new','contacted','converted','closed')),
  admin_note      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists leads_status_idx on public.leads (status, created_at desc);
alter table public.leads enable row level security;
drop policy if exists "leads admin all" on public.leads;
drop policy if exists "leads own read" on public.leads;
create policy "leads admin all" on public.leads for all using (public.is_admin()) with check (public.is_admin());
create policy "leads own read"  on public.leads for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. VERIFIED + REWARDED COLLEGE REVIEWS
-- ---------------------------------------------------------------------
alter table public.reviews add column if not exists is_verified boolean not null default false;
alter table public.reviews add column if not exists reward_status text not null default 'none'
  check (reward_status in ('none','eligible','paid'));
alter table public.reviews add column if not exists proof_url text; -- optional ID-card / fee-receipt link

create or replace function public.protect_review_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.status := case when old.status = 'blocked' then 'blocked' else new.status end;
    if new.status not in ('approved','pending') then new.status := old.status; end if;
    new.edited_by_admin := old.edited_by_admin;
    new.user_id := old.user_id;
    new.college_id := old.college_id;
    new.is_verified := old.is_verified;
    new.reward_status := old.reward_status;
  end if;
  return new;
end $$;

create or replace view public.reviews_public
with (security_invoker = false) as
select r.id, r.college_id, r.rating, r.rating_faculty, r.rating_campus, r.rating_placement,
       r.title, r.body, r.course, r.batch_year, r.edited_by_admin, r.created_at,
       coalesce(split_part(p.full_name,' ',1),'Student') as reviewer_name,
       r.is_verified
from public.reviews r
left join public.profiles p on p.id = r.user_id
where r.status = 'approved';

-- ---------------------------------------------------------------------
-- 4. PG / HOSTEL REVIEWS
-- ---------------------------------------------------------------------
create table if not exists public.hostel_reviews (
  id         uuid primary key default gen_random_uuid(),
  hostel_id  uuid not null references public.hostels(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  rating_food int check (rating_food between 1 and 5),
  rating_safety int check (rating_safety between 1 and 5),
  rating_cleanliness int check (rating_cleanliness between 1 and 5),
  body       text not null,
  stayed_from int,
  status     text not null default 'approved' check (status in ('approved','pending','blocked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (hostel_id, user_id)
);
alter table public.hostel_reviews enable row level security;
drop policy if exists "hreviews read" on public.hostel_reviews;
drop policy if exists "hreviews own insert" on public.hostel_reviews;
drop policy if exists "hreviews own update" on public.hostel_reviews;
drop policy if exists "hreviews own delete" on public.hostel_reviews;
drop policy if exists "hreviews admin all" on public.hostel_reviews;
create policy "hreviews read" on public.hostel_reviews for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "hreviews own insert" on public.hostel_reviews for insert with check (user_id = auth.uid() and public.is_active_user() and status = 'approved');
create policy "hreviews own update" on public.hostel_reviews for update using (user_id = auth.uid() and status <> 'blocked') with check (user_id = auth.uid() and status <> 'blocked');
create policy "hreviews own delete" on public.hostel_reviews for delete using (user_id = auth.uid());
create policy "hreviews admin all" on public.hostel_reviews for all using (public.is_admin()) with check (public.is_admin());

create or replace view public.hostel_reviews_public with (security_invoker = false) as
select r.id, r.hostel_id, r.rating, r.rating_food, r.rating_safety, r.rating_cleanliness, r.body, r.stayed_from, r.created_at,
       coalesce(split_part(p.full_name,' ',1),'Student') as reviewer_name
from public.hostel_reviews r left join public.profiles p on p.id = r.user_id
where r.status = 'approved';

create or replace view public.hostel_ratings with (security_invoker = false) as
select hostel_id, round(avg(rating)::numeric,1) as avg_rating, count(*)::int as review_count
from public.hostel_reviews where status = 'approved' group by hostel_id;

-- ---------------------------------------------------------------------
-- 5. OWNER / EMPLOYER SELF-LISTING
--    Any logged-in user can submit a PG or job. It stays hidden until an
--    admin approves it. Employers see and manage applicants to their jobs.
-- ---------------------------------------------------------------------
alter table public.hostels add column if not exists submitted_by uuid references public.profiles(id) on delete set null;
alter table public.hostels add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('approved','pending','rejected'));
alter table public.jobs add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('approved','pending','rejected'));
alter table public.jobs add column if not exists contact_email text;
alter table public.jobs add column if not exists contact_phone text;

create or replace function public.protect_listing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;  -- service role / admin
  -- Owner edit or new submission → goes (back) to moderation
  new.is_published := false;
  new.approval_status := 'pending';
  if tg_table_name = 'hostels' then
    new.is_verified := false;
    new.submitted_by := coalesce(old.submitted_by, auth.uid());
  else
    new.created_by := coalesce(old.created_by, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists hostels_protect_listing on public.hostels;
create trigger hostels_protect_listing before insert or update on public.hostels
  for each row execute function public.protect_listing();
drop trigger if exists jobs_protect_listing on public.jobs;
create trigger jobs_protect_listing before insert or update on public.jobs
  for each row execute function public.protect_listing();

drop policy if exists "hostels public read" on public.hostels;
drop policy if exists "hostels owner insert" on public.hostels;
drop policy if exists "hostels owner update" on public.hostels;
drop policy if exists "hostels owner delete" on public.hostels;
create policy "hostels public read"  on public.hostels for select using (is_published or public.is_admin() or submitted_by = auth.uid());
create policy "hostels owner insert" on public.hostels for insert with check (submitted_by = auth.uid() and public.is_active_user());
create policy "hostels owner update" on public.hostels for update using (submitted_by = auth.uid()) with check (submitted_by = auth.uid());
create policy "hostels owner delete" on public.hostels for delete using (submitted_by = auth.uid());

drop policy if exists "jobs public read" on public.jobs;
drop policy if exists "jobs owner insert" on public.jobs;
drop policy if exists "jobs owner update" on public.jobs;
drop policy if exists "jobs owner delete" on public.jobs;
create policy "jobs public read"  on public.jobs for select using (is_published or public.is_admin() or created_by = auth.uid());
create policy "jobs owner insert" on public.jobs for insert with check (created_by = auth.uid() and public.is_active_user());
create policy "jobs owner update" on public.jobs for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "jobs owner delete" on public.jobs for delete using (created_by = auth.uid());

-- Employer can see / update applications to jobs they posted
create or replace function public.owns_job(j uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jobs where id = j and created_by = auth.uid());
$$;

drop policy if exists "apps employer read" on public.job_applications;
drop policy if exists "apps employer update" on public.job_applications;
create policy "apps employer read"   on public.job_applications for select using (public.owns_job(job_id));
create policy "apps employer update" on public.job_applications for update using (public.owns_job(job_id)) with check (public.owns_job(job_id));

create or replace function public.protect_application_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if public.owns_job(old.job_id) and old.user_id <> auth.uid() then
    -- employer may only change status + note
    new.user_id := old.user_id; new.job_id := old.job_id;
    new.full_name := old.full_name; new.phone := old.phone; new.email := old.email;
    new.cover_letter := old.cover_letter; new.resume_path := old.resume_path;
    return new;
  end if;
  new.status := old.status;
  new.admin_note := old.admin_note;
  new.user_id := old.user_id;
  new.job_id := old.job_id;
  return new;
end $$;

-- Employer can download resumes of applicants to their jobs
drop policy if exists "resume employer read" on storage.objects;
create policy "resume employer read" on storage.objects for select to authenticated using (
  bucket_id = 'resumes' and exists (
    select 1 from public.job_applications a
    where a.resume_path = storage.objects.name and public.owns_job(a.job_id)
  )
);

-- Owners can upload photos for their own listing into media/user/<uid>/...
drop policy if exists "media user upload" on storage.objects;
create policy "media user upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'user' and (storage.foldername(name))[2] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 6. Q&A
-- ---------------------------------------------------------------------
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  college_id  uuid references public.colleges(id) on delete set null,
  title       text not null check (char_length(title) between 10 and 200),
  body        text,
  status      text not null default 'approved' check (status in ('approved','pending','blocked')),
  created_at  timestamptz default now()
);
create table if not exists public.answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) >= 5),
  is_official boolean default false,     -- set by admin for expert answers
  status      text not null default 'approved' check (status in ('approved','pending','blocked')),
  created_at  timestamptz default now()
);
create index if not exists questions_college_idx on public.questions (college_id, created_at desc);
create index if not exists answers_q_idx on public.answers (question_id);
alter table public.questions enable row level security;
alter table public.answers enable row level security;

do $$
declare t text;
begin
  foreach t in array array['questions','answers'] loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('drop policy if exists "%s own insert" on public.%I', t, t);
    execute format('drop policy if exists "%s own delete" on public.%I', t, t);
    execute format('drop policy if exists "%s admin all" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select using (status = ''approved'' or user_id = auth.uid() or public.is_admin())', t, t);
    execute format('create policy "%s own insert" on public.%I for insert with check (user_id = auth.uid() and public.is_active_user() and status = ''approved'')', t, t);
    execute format('create policy "%s own delete" on public.%I for delete using (user_id = auth.uid())', t, t);
    execute format('create policy "%s admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

create or replace function public.protect_answer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then new.is_official := false; end if;
  return new;
end $$;
drop trigger if exists answers_protect on public.answers;
create trigger answers_protect before insert or update on public.answers for each row execute function public.protect_answer();

create or replace view public.questions_public with (security_invoker = false) as
select q.id, q.college_id, q.title, q.body, q.created_at,
       coalesce(split_part(p.full_name,' ',1),'Student') as asker_name,
       c.name as college_name, c.slug as college_slug,
       (select count(*) from public.answers a where a.question_id = q.id and a.status = 'approved')::int as answer_count
from public.questions q
left join public.profiles p on p.id = q.user_id
left join public.colleges c on c.id = q.college_id
where q.status = 'approved';

create or replace view public.answers_public with (security_invoker = false) as
select a.id, a.question_id, a.body, a.is_official, a.created_at,
       coalesce(split_part(p.full_name,' ',1),'Student') as author_name,
       p.role in ('admin','super_admin') as is_team
from public.answers a left join public.profiles p on p.id = a.user_id
where a.status = 'approved';

-- ---------------------------------------------------------------------
-- 7. EXAMS + ARTICLES (news / guides) + NEWSLETTER
-- ---------------------------------------------------------------------
create table if not exists public.exams (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  short_name      text not null,           -- JEE Main
  full_name       text,
  stream          text,                    -- Engineering, Medical ...
  level           text default 'UG' check (level in ('UG','PG','Diploma','PhD','Abroad','Other')),
  country         text default 'India',
  conducting_body text,
  mode            text,                    -- Online CBT
  frequency       text,                    -- Twice a year
  exam_date       text,                    -- free text, e.g. "Jan & Apr 2027 (tentative)"
  registration    text,
  website         text,
  eligibility     text,
  pattern         text,
  syllabus        text,
  description     text,
  is_published    boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  body         text,                       -- Markdown
  category     text not null default 'news' check (category in ('news','exam','admission','guide','abroad','jobs','hostel')),
  cover_url    text,
  tags         text[] default '{}',
  college_id   uuid references public.colleges(id) on delete set null,
  exam_id      uuid references public.exams(id) on delete set null,
  author_id    uuid references public.profiles(id) on delete set null,
  author_name  text,
  is_published boolean default true,
  published_at timestamptz default now(),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists articles_cat_idx on public.articles (category, published_at desc);

create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  interests  text[] default '{}',
  source     text,
  unsubscribed boolean default false,
  created_at timestamptz default now()
);

alter table public.exams enable row level security;
alter table public.articles enable row level security;
alter table public.newsletter_subscribers enable row level security;
do $$
declare t text;
begin
  foreach t in array array['exams','articles'] loop
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('drop policy if exists "%s admin all" on public.%I', t, t);
    execute format('create policy "%s public read" on public.%I for select using (is_published or public.is_admin())', t, t);
    execute format('create policy "%s admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;
drop policy if exists "newsletter admin" on public.newsletter_subscribers;
create policy "newsletter admin" on public.newsletter_subscribers for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 8. PLACEMENTS + CUTOFFS + PREDICTOR
-- ---------------------------------------------------------------------
create table if not exists public.college_placements (
  id               uuid primary key default gen_random_uuid(),
  college_id       uuid not null references public.colleges(id) on delete cascade,
  year             int not null,
  course           text default 'All',
  avg_package      numeric,
  median_package   numeric,
  highest_package  numeric,
  currency         text default 'INR',
  package_unit     text default 'year',     -- year (LPA) or month
  placement_rate   numeric,                 -- %
  students_placed  int,
  companies_visited int,
  top_recruiters   text[] default '{}',
  source           text,                    -- e.g. "NIRF 2026 report"
  created_at       timestamptz default now(),
  unique (college_id, year, course)
);

create table if not exists public.cutoffs (
  id           uuid primary key default gen_random_uuid(),
  college_id   uuid not null references public.colleges(id) on delete cascade,
  exam_slug    text not null references public.exams(slug) on update cascade on delete cascade,
  year         int not null,
  course       text not null,
  category     text not null default 'General',  -- General, OBC-NCL, SC, ST, EWS, ...
  quota        text default 'All India',
  round        text default 'Final',
  opening_rank int,
  closing_rank int not null,
  source       text,
  created_at   timestamptz default now()
);
create index if not exists cutoffs_lookup_idx on public.cutoffs (exam_slug, category, closing_rank);

alter table public.college_placements enable row level security;
alter table public.cutoffs enable row level security;
do $$
declare t text;
begin
  foreach t in array array['college_placements','cutoffs'] loop
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('drop policy if exists "%s admin all" on public.%I', t, t);
    execute format('create policy "%s public read" on public.%I for select using (true)', t, t);
    execute format('create policy "%s admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- Predict colleges from rank using the latest year's closing rank.
--   High   : rank within 85% of last closing rank
--   Medium : rank up to the last closing rank
--   Low    : rank up to 15% beyond the last closing rank (possible in later rounds)
create or replace function public.predict_colleges(p_exam text, p_rank int, p_category text default 'General',
                                                   p_quota text default null, p_country text default null)
returns table (college_id uuid, slug text, name text, city text, country text, cover_url text,
               course text, category text, quota text, year int, opening_rank int, closing_rank int, chance text)
language sql stable as $$
  with latest as (
    select distinct on (c.college_id, c.course, c.category, c.quota) c.*
    from public.cutoffs c
    where c.exam_slug = p_exam and c.category = p_category
      and (p_quota is null or c.quota = p_quota)
    order by c.college_id, c.course, c.category, c.quota, c.year desc,
             case c.round when 'Final' then 0 else 1 end
  )
  select co.id, co.slug, co.name, co.city, co.country, co.cover_url,
         l.course, l.category, l.quota, l.year, l.opening_rank, l.closing_rank,
         case when p_rank <= l.closing_rank * 0.85 then 'High'
              when p_rank <= l.closing_rank then 'Medium'
              else 'Low' end
  from latest l
  join public.colleges co on co.id = l.college_id and co.is_published
  where p_rank <= l.closing_rank * 1.15
    and (p_country is null or co.country = p_country)
  order by case when p_rank <= l.closing_rank * 0.85 then 0 when p_rank <= l.closing_rank then 1 else 2 end,
           l.closing_rank asc
  limit 200;
$$;
grant execute on function public.predict_colleges to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. COMMON APPLICATION — one form, many partner colleges
-- ---------------------------------------------------------------------
alter table public.colleges add column if not exists accepts_applications boolean not null default false;
alter table public.colleges add column if not exists application_note text;  -- e.g. "No application fee"

create table if not exists public.college_applications (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null,              -- one submission = one batch, many colleges
  user_id         uuid not null references public.profiles(id) on delete cascade,
  college_id      uuid not null references public.colleges(id) on delete cascade,
  course          text not null,
  full_name       text not null,
  email           text not null,
  phone           text not null,
  dob             date,
  gender          text,
  city            text,
  state           text,
  country         text,
  qualification   text,                       -- 12th / Graduation ...
  board_or_university text,
  percentage      numeric,
  passing_year    int,
  entrance_exam   text,
  entrance_score  text,
  statement       text,
  status          text not null default 'submitted'
                  check (status in ('submitted','under_review','forwarded','accepted','rejected','withdrawn')),
  admin_note      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (user_id, college_id, course)
);
create index if not exists capps_user_idx on public.college_applications (user_id);
create index if not exists capps_status_idx on public.college_applications (status, created_at desc);
alter table public.college_applications enable row level security;
drop policy if exists "capps own read" on public.college_applications;
drop policy if exists "capps own insert" on public.college_applications;
drop policy if exists "capps own withdraw" on public.college_applications;
drop policy if exists "capps admin all" on public.college_applications;
create policy "capps own read" on public.college_applications for select using (user_id = auth.uid());
create policy "capps own insert" on public.college_applications for insert with check (
  user_id = auth.uid() and public.is_active_user() and status = 'submitted'
  and exists (select 1 from public.colleges c where c.id = college_id and c.accepts_applications and c.is_published)
);
create policy "capps own withdraw" on public.college_applications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "capps admin all" on public.college_applications for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.protect_college_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;
  -- students can only withdraw
  if new.status <> old.status and new.status <> 'withdrawn' then new.status := old.status; end if;
  new.admin_note := old.admin_note; new.user_id := old.user_id; new.college_id := old.college_id;
  return new;
end $$;
drop trigger if exists capps_protect on public.college_applications;
create trigger capps_protect before update on public.college_applications
  for each row execute function public.protect_college_application();

-- ---------------------------------------------------------------------
-- updated_at triggers for new tables
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['leads','hostel_reviews','exams','articles','college_applications'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

grant select on public.hostel_reviews_public, public.hostel_ratings, public.questions_public,
                public.answers_public, public.reviews_public to anon, authenticated;

-- Homepage counters now also count questions & exams
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
    'exams',     (select count(*) from exams where is_published)
  );
$$;
