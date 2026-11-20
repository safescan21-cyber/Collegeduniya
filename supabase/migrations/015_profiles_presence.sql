-- =====================================================================
-- StudyEarnstay.com — migration 015: public student profiles, education, login history,
-- "who's online" for admins and silent online alerts on the site. Run AFTER 014.
-- =====================================================================

-- ---------------------------------------------------------------- public profile
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists headline text check (headline is null or char_length(headline) <= 120);
alter table public.profiles add column if not exists bio text check (bio is null or char_length(bio) <= 1000);
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists public_profile boolean not null default true;      -- education visible to anyone
alter table public.profiles add column if not exists show_mock_scores boolean not null default false;   -- best mock scores on the public page
alter table public.profiles add column if not exists show_online boolean not null default false;        -- first name + city in "is online" alerts
alter table public.profiles add column if not exists last_seen_at timestamptz;
create unique index if not exists profiles_username_idx on public.profiles (lower(username)) where username is not null;
do $$ begin
  alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_.]{3,30}$');
exception when duplicate_object then null; end $$;

-- students may set their own username / bio / privacy switches (role, email, etc. stay protected by protect_profile_columns)

-- ---------------------------------------------------------------- education
create table if not exists public.student_education (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  level         text not null check (level in ('Class 10','Class 12','Diploma','UG','PG','PhD','Certificate','Other')),
  institute     text not null check (char_length(institute) between 2 and 200),
  college_id    uuid references public.colleges(id) on delete set null,
  board         text,                 -- CBSE / ICSE / State board / University
  course        text,                 -- "B.Tech Computer Science", "PCM"
  start_year    int check (start_year between 1950 and 2100),
  end_year      int check (end_year between 1950 and 2100),
  is_current    boolean not null default false,
  score         text check (score is null or char_length(score) <= 40),   -- "8.6 CGPA", "92%"
  city          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists student_education_user_idx on public.student_education (user_id);
create index if not exists student_education_college_idx on public.student_education (college_id);
alter table public.student_education enable row level security;
drop policy if exists "edu own" on public.student_education;
drop policy if exists "edu public read" on public.student_education;
create policy "edu own" on public.student_education for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());
create policy "edu public read" on public.student_education for select using (
  exists (select 1 from public.profiles p where p.id = user_id and p.public_profile and not p.is_blocked) or public.is_admin());
create or replace trigger student_education_touch before update on public.student_education for each row execute function public.touch_updated_at();

-- what anyone may see of a public profile (never email or phone)
create or replace function public.public_profile(p_username text)
returns table (id uuid, username text, full_name text, headline text, bio text, avatar_url text, city text, country text,
               member_since timestamptz, education jsonb, mock jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.full_name, p.headline, p.bio, p.avatar_url, p.city, p.country, p.created_at,
    coalesce((select jsonb_agg(to_jsonb(e) - 'user_id' order by e.is_current desc, e.end_year desc nulls first, e.start_year desc nulls last)
              from student_education e where e.user_id = p.id), '[]'::jsonb),
    case when p.show_mock_scores then coalesce((
      select jsonb_agg(x order by x->>'title') from (
        select jsonb_build_object('title', max(a.title), 'exam_slug', a.exam_slug, 'tests', count(*), 'best', max(a.score), 'max', max(a.max_score), 'best_percentile', max(a.percentile)) x
        from mock_attempts a where a.user_id = p.id and a.status = 'submitted' group by a.exam_slug) t), '[]'::jsonb) else null end
  from profiles p
  where lower(p.username) = lower(p_username) and p.public_profile and not p.is_blocked;
$$;
grant execute on function public.public_profile(text) to anon, authenticated;

-- ---------------------------------------------------------------- login history (written by the API)
create table if not exists public.login_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  method     text,              -- email / phone
  device     text,              -- "Chrome on Android"
  city       text,
  region     text,
  country    text,
  created_at timestamptz default now()
);
create index if not exists login_events_user_idx on public.login_events (user_id, created_at desc);
alter table public.login_events enable row level security;
drop policy if exists "login own read" on public.login_events;
drop policy if exists "login admin" on public.login_events;
create policy "login own read" on public.login_events for select using (user_id = auth.uid());
create policy "login admin" on public.login_events for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- presence (heartbeats from open tabs, written by the API)
create table if not exists public.site_presence (
  session_id  text primary key check (char_length(session_id) between 8 and 64),
  user_id     uuid references public.profiles(id) on delete cascade,
  path        text,
  city        text,
  region      text,
  country     text,
  device      text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists site_presence_seen_idx on public.site_presence (last_seen desc);
create index if not exists site_presence_user_idx on public.site_presence (user_id);
alter table public.site_presence enable row level security;
drop policy if exists "presence admin" on public.site_presence;
create policy "presence admin" on public.site_presence for select using (public.is_admin());

-- "X came online" feed for the silent alerts: only first names of people who opted in, otherwise anonymous
create table if not exists public.online_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  display     text,            -- "Riya" (opted in) or null = "A student"
  city        text,
  created_at  timestamptz default now()
);
create index if not exists online_events_time_idx on public.online_events (created_at desc);
create index if not exists online_events_user_idx on public.online_events (user_id);
alter table public.online_events enable row level security;
drop policy if exists "online events admin" on public.online_events;
create policy "online events admin" on public.online_events for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.recent_online(p_since timestamptz default null)
returns table (id uuid, display text, city text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, e.display, e.city, e.created_at
  from online_events e
  where e.created_at > greatest(coalesce(p_since, now() - interval '2 minutes'), now() - interval '10 minutes')
  order by e.created_at desc limit 10;
$$;
grant execute on function public.recent_online(timestamptz) to anon, authenticated;

create or replace function public.online_count()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from site_presence where last_seen > now() - interval '2 minutes';
$$;
grant execute on function public.online_count() to anon, authenticated;
