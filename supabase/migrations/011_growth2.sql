-- =====================================================================
-- StudyEarnstay.com — migration 011: "Top colleges" pages, job alerts + resumes, exam library,
-- percentile→rank, rewards, referrals & campus ambassadors, salary trends. Run AFTER 010.
-- =====================================================================

-- ---------------------------------------------------------------- 1. "Top {stream} colleges in {place}" pages
create or replace function public.simple_slug(t text) returns text
language sql immutable as $$ select trim(both '-' from lower(regexp_replace(coalesce(t, ''), '[^a-zA-Z0-9]+', '-', 'g'))) $$;

-- Every stream × place with at least p_min published colleges (used for the sitemap and the /top index)
create or replace function public.stream_place_counts(p_min int default 3)
returns table (stream text, stream_slug text, place_type text, place text, place_slug text, country_code text, colleges bigint)
language sql stable security definer set search_path = public as $$
  with s as (
    select unnest(c.streams) as stream, c.state, c.country_code, c.city_geoname_id
    from colleges c where c.is_published and coalesce(array_length(c.streams, 1), 0) > 0
  )
  select stream, simple_slug(stream), 'country', country_code::text, lower(country_code), country_code::text, count(*)
    from s where country_code is not null group by stream, country_code having count(*) >= p_min
  union all
  select stream, simple_slug(stream), 'state', state, simple_slug(state), max(country_code)::text, count(*)
    from s where state is not null group by stream, state having count(*) >= p_min
  union all
  select s.stream, simple_slug(s.stream), 'city', max(ci.name), ci.slug, max(s.country_code)::text, count(*)
    from s join cities ci on ci.geoname_id = s.city_geoname_id group by s.stream, ci.slug having count(*) >= p_min;
$$;

-- Resolve URL pieces back to names: stream slug → stream, place slug → city / state / country
create or replace function public.resolve_top(p_stream text, p_place text default null)
returns table (stream text, place_type text, place text, place_key text, country_code text)
language plpgsql stable security definer set search_path = public as $$
declare st text; ci record; sta record;
begin
  select x into st from (select distinct unnest(streams) x from colleges where is_published) u where simple_slug(x) = lower(p_stream) limit 1;
  if st is null then return; end if;
  if p_place is null or p_place = '' then return query select st, 'world'::text, null::text, null::text, null::text; return; end if;
  if length(p_place) = 2 and exists (select 1 from countries where code = upper(p_place)) then
    return query select st, 'country'::text, (select name::text from countries where code = upper(p_place)), upper(p_place), upper(p_place); return;
  end if;
  select c.geoname_id::text as k, c.name, c.country_code into ci from cities c where c.slug = lower(p_place) limit 1;
  if ci.k is not null then return query select st, 'city'::text, ci.name::text, ci.k, ci.country_code::text; return; end if;
  select c.state, max(c.country_code) cc into sta from colleges c
   where c.is_published and c.state is not null and simple_slug(c.state) = lower(p_place) group by c.state limit 1;
  if sta.state is not null then return query select st, 'state'::text, sta.state::text, sta.state::text, sta.cc::text; end if;
end $$;
grant execute on function public.simple_slug, public.stream_place_counts, public.resolve_top to anon, authenticated;

-- board exams (facts only: name, board, official website) so papers / date sheets can be attached
insert into public.exams (slug, short_name, full_name, stream, level, country, conducting_body, mode, website) values
 ('cbse-class-10','CBSE Class 10','CBSE Secondary School Examination (Class 10)','School','Other','India','Central Board of Secondary Education (CBSE)','Pen and paper','https://www.cbse.gov.in'),
 ('cbse-class-12','CBSE Class 12','CBSE Senior School Certificate Examination (Class 12)','School','Other','India','Central Board of Secondary Education (CBSE)','Pen and paper','https://www.cbse.gov.in'),
 ('icse-class-10','ICSE Class 10','Indian Certificate of Secondary Education (Class 10)','School','Other','India','Council for the Indian School Certificate Examinations (CISCE)','Pen and paper','https://cisce.org'),
 ('isc-class-12','ISC Class 12','Indian School Certificate (Class 12)','School','Other','India','Council for the Indian School Certificate Examinations (CISCE)','Pen and paper','https://cisce.org')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- 2. job alerts + resumes
create table if not exists public.job_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  city         text,
  country      text,
  job_type     text,                -- Part-time, Internship, Full-time, Freelance, Weekend (null = any)
  keywords     text,
  remote_ok    boolean not null default true,
  channel      text not null default 'email' check (channel in ('email','whatsapp')),
  whatsapp     text,
  frequency    text not null default 'daily' check (frequency in ('daily','weekly')),
  is_active    boolean not null default true,
  last_sent_at timestamptz,
  created_at   timestamptz default now()
);
create index if not exists job_alerts_due_idx on public.job_alerts (is_active, last_sent_at);
create index if not exists job_alerts_user_idx on public.job_alerts (user_id);
alter table public.job_alerts enable row level security;
drop policy if exists "alerts own" on public.job_alerts;
create policy "alerts own" on public.job_alerts for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());

create table if not exists public.student_resumes (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  full_name  text, headline text, email text, phone text, city text,
  summary    text,
  education  jsonb not null default '[]'::jsonb,   -- [{degree, institute, year, score}]
  experience jsonb not null default '[]'::jsonb,   -- [{role, org, from, to, details}]
  projects   jsonb not null default '[]'::jsonb,   -- [{title, link, details}]
  skills     text[] not null default '{}',
  languages  text[] not null default '{}',
  links      jsonb not null default '{}'::jsonb,   -- {linkedin, github, portfolio}
  updated_at timestamptz default now()
);
alter table public.student_resumes enable row level security;
drop policy if exists "resume own" on public.student_resumes;
create policy "resume own" on public.student_resumes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace trigger student_resumes_touch before update on public.student_resumes for each row execute function public.touch_updated_at();

-- applications can carry a snapshot of the built resume (employer sees it even if the student edits later)
alter table public.job_applications add column if not exists resume_snapshot jsonb;

-- ---------------------------------------------------------------- 3. exam library (papers, answer keys, date sheets)
create table if not exists public.exam_resources (
  id           uuid primary key default gen_random_uuid(),
  exam_slug    text not null references public.exams(slug) on update cascade on delete cascade,
  kind         text not null check (kind in ('question_paper','answer_key','solution','syllabus','date_sheet','notice','analysis','sample_paper')),
  title        text not null,
  year         int,
  session      text,               -- "January, Shift 1", "Term 2"…
  file_url     text,               -- uploaded copy (media bucket) — official public documents only
  source_url   text not null,      -- official page it came from
  is_published boolean not null default true,
  downloads    int not null default 0,
  created_at   timestamptz default now()
);
create index if not exists exam_resources_idx on public.exam_resources (exam_slug, kind, year desc);
alter table public.exam_resources enable row level security;
drop policy if exists "exam res public read" on public.exam_resources;
drop policy if exists "exam res admin" on public.exam_resources;
create policy "exam res public read" on public.exam_resources for select using (is_published or public.is_admin());
create policy "exam res admin" on public.exam_resources for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.count_download(rid uuid) returns void
language sql security definer set search_path = public as $$
  update exam_resources set downloads = downloads + 1 where id = rid and is_published;
$$;
grant execute on function public.count_download to anon, authenticated;


-- ---------------------------------------------------------------- 4. percentile → rank (needs official candidate counts)
create table if not exists public.exam_stats (
  id                uuid primary key default gen_random_uuid(),
  exam_slug         text not null references public.exams(slug) on update cascade on delete cascade,
  year              int not null,
  session           text not null default 'All',
  total_candidates  int not null check (total_candidates > 0),
  source            text not null,
  created_at        timestamptz default now(),
  unique (exam_slug, year, session)
);
alter table public.exam_stats enable row level security;
drop policy if exists "exam stats read" on public.exam_stats;
drop policy if exists "exam stats admin" on public.exam_stats;
create policy "exam stats read" on public.exam_stats for select using (true);
create policy "exam stats admin" on public.exam_stats for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- 5. rewards
create table if not exists public.reward_points (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  points     int not null,
  reason     text not null,          -- review_verified, college_application, quota_application, referral, redemption, admin
  ref_id     uuid,
  status     text not null default 'approved' check (status in ('pending','approved','reversed')),
  note       text,
  created_at timestamptz default now()
);
create unique index if not exists reward_points_once_idx on public.reward_points (user_id, reason, ref_id) where ref_id is not null;
create index if not exists reward_points_user_idx on public.reward_points (user_id, created_at desc);
alter table public.reward_points enable row level security;
drop policy if exists "points own read" on public.reward_points;
drop policy if exists "points admin" on public.reward_points;
create policy "points own read" on public.reward_points for select using (user_id = auth.uid());
create policy "points admin" on public.reward_points for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.reward_catalog (
  code       text primary key,
  title      text not null,            -- "₹100 Amazon voucher"
  points     int not null check (points > 0),
  stock      int,                      -- null = unlimited
  is_active  boolean not null default true,
  created_at timestamptz default now()
);
alter table public.reward_catalog enable row level security;
drop policy if exists "catalog read" on public.reward_catalog;
drop policy if exists "catalog admin" on public.reward_catalog;
create policy "catalog read" on public.reward_catalog for select using (is_active or public.is_admin());
create policy "catalog admin" on public.reward_catalog for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.reward_redemptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  reward_code  text not null references public.reward_catalog(code),
  points       int not null,
  status       text not null default 'requested' check (status in ('requested','fulfilled','rejected')),
  voucher      text,                  -- filled by admin; shown to the student
  admin_note   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists reward_redemptions_user_idx on public.reward_redemptions (user_id);
alter table public.reward_redemptions enable row level security;
drop policy if exists "redemptions own read" on public.reward_redemptions;
drop policy if exists "redemptions admin" on public.reward_redemptions;
create policy "redemptions own read" on public.reward_redemptions for select using (user_id = auth.uid());
create policy "redemptions admin" on public.reward_redemptions for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.points_balance(uid uuid default auth.uid())
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(points), 0)::int from reward_points where user_id = uid and status = 'approved'
    and (uid = auth.uid() or public.is_admin());
$$;
grant execute on function public.points_balance to authenticated;

create or replace function public.request_redemption(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c reward_catalog; rid uuid;
begin
  if me is null or not public.is_active_user() then raise exception 'Please log in'; end if;
  select * into c from reward_catalog where code = p_code and is_active for update;
  if c.code is null then raise exception 'Reward not available'; end if;
  if c.stock is not null and c.stock <= 0 then raise exception 'Out of stock'; end if;
  perform pg_advisory_xact_lock(hashtext(me::text));
  if public.points_balance(me) < c.points then raise exception 'Not enough points'; end if;
  if exists (select 1 from reward_redemptions where user_id = me and status = 'requested') then raise exception 'You already have a pending redemption'; end if;
  insert into reward_redemptions (user_id, reward_code, points) values (me, c.code, c.points) returning id into rid;
  insert into reward_points (user_id, points, reason, ref_id) values (me, -c.points, 'redemption', rid);
  if c.stock is not null then update reward_catalog set stock = stock - 1 where code = c.code; end if;
  return rid;
end $$;
grant execute on function public.request_redemption to authenticated;

-- rejected redemption → refund
create or replace function public.redemption_refund()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'rejected' and old.status <> 'rejected' then
    update reward_points set status = 'reversed', note = 'Redemption rejected' where reason = 'redemption' and ref_id = new.id;
  end if;
  new.updated_at := now();
  return new;
end $$;
create or replace trigger reward_redemptions_refund before update on public.reward_redemptions for each row execute function public.redemption_refund();

-- automatic points
create or replace function public.award(uid uuid, pts int, why text, ref uuid, st text default 'approved')
returns void language sql security definer set search_path = public as $$
  insert into reward_points (user_id, points, reason, ref_id, status) values (uid, pts, why, ref, st) on conflict do nothing;
$$;

create or replace function public.points_on_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_verified and new.status = 'approved' and (tg_op = 'INSERT' or not coalesce(old.is_verified, false)) then
    perform public.award(new.user_id, 50, 'review_verified', new.id);
  end if;
  perform public.approve_referral(new.user_id);
  return new;
end $$;
create or replace function public.points_on_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.award(new.user_id, 10, tg_table_name, new.id);
  perform public.approve_referral(new.user_id);
  return new;
end $$;

-- ---------------------------------------------------------------- 6. referrals + campus ambassadors
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;
update public.profiles set referral_code = upper(substr(md5(id::text || random()::text), 1, 7)) where referral_code is null;
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

create or replace function public.set_referral_code()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.referral_code is null then new.referral_code := upper(substr(md5(new.id::text || random()::text), 1, 7)); end if;
  return new;
end $$;
create or replace trigger profiles_referral_code before insert on public.profiles for each row execute function public.set_referral_code();

-- students may not edit their own code or who referred them (claim_referral sets a transaction flag)
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_blocked := old.is_blocked;
    new.email := old.email;
    new.referral_code := old.referral_code;
    if coalesce(current_setting('app.claiming_referral', true), '') <> 'on' then new.referred_by := old.referred_by; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- referral points start "pending" and are approved when the new student does something real
create or replace function public.approve_referral(uid uuid)
returns void language sql security definer set search_path = public as $$
  update reward_points set status = 'approved'
  where reason = 'referral' and ref_id = uid and status = 'pending';
$$;

create or replace function public.claim_referral(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ref uuid; mine profiles;
begin
  if me is null then raise exception 'Please log in'; end if;
  select * into mine from profiles where id = me;
  if mine.referred_by is not null then return 'already'; end if;
  if mine.created_at < now() - interval '7 days' then return 'too_late'; end if;
  select id into ref from profiles where referral_code = upper(trim(p_code)) and not is_blocked;
  if ref is null or ref = me then return 'invalid'; end if;
  perform set_config('app.claiming_referral', 'on', true);
  update profiles set referred_by = ref where id = me;
  perform set_config('app.claiming_referral', '', true);
  perform public.award(ref, 20, 'referral', me, 'pending');
  return 'ok';
end $$;
grant execute on function public.claim_referral to authenticated;

create table if not exists public.ambassadors (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  college_id  uuid references public.colleges(id) on delete set null,
  college_name text,
  city        text,
  year_of_study int,
  why         text check (why is null or char_length(why) <= 1000),
  instagram   text,
  status      text not null default 'applied' check (status in ('applied','approved','rejected','paused')),
  admin_note  text,
  created_at  timestamptz default now()
);
create index if not exists ambassadors_college_idx on public.ambassadors (college_id);
alter table public.ambassadors enable row level security;
drop policy if exists "amb own" on public.ambassadors;
drop policy if exists "amb own insert" on public.ambassadors;
drop policy if exists "amb admin" on public.ambassadors;
create policy "amb own" on public.ambassadors for select using (user_id = auth.uid());
create policy "amb own insert" on public.ambassadors for insert with check (user_id = auth.uid() and status = 'applied' and public.is_active_user());
create policy "amb admin" on public.ambassadors for all using (public.is_admin()) with check (public.is_admin());

-- my referral stats + this month's leaderboard (first names only)
create or replace function public.my_referrals()
returns table (code text, joined int, active int, points int)
language sql stable security definer set search_path = public as $$
  select p.referral_code,
         (select count(*)::int from profiles x where x.referred_by = p.id),
         (select count(*)::int from reward_points r where r.user_id = p.id and r.reason = 'referral' and r.status = 'approved'),
         public.points_balance(p.id)
  from profiles p where p.id = auth.uid();
$$;
grant execute on function public.my_referrals to authenticated;

create or replace function public.referral_leaderboard(p_days int default 30)
returns table (first_name text, college text, referrals bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(split_part(p.full_name, ' ', 1), 'Student'), coalesce(a.college_name, c.name), count(*)
  from reward_points r
  join profiles p on p.id = r.user_id
  left join ambassadors a on a.user_id = p.id and a.status = 'approved'
  left join colleges c on c.id = a.college_id
  where r.reason = 'referral' and r.status = 'approved' and r.created_at > now() - make_interval(days => p_days)
  group by p.id, p.full_name, a.college_name, c.name
  order by count(*) desc limit 20;
$$;
grant execute on function public.referral_leaderboard to anon, authenticated;

-- triggers that award points (functions defined above)
create or replace trigger reviews_points after insert or update of is_verified, status on public.reviews for each row execute function public.points_on_review();
create or replace trigger capps_points after insert on public.college_applications for each row execute function public.points_on_application();
create or replace trigger quota_apps_points after insert on public.quota_applications for each row execute function public.points_on_application();

-- ---------------------------------------------------------------- 7. salary & placement trends
create or replace function public.placement_trends(p_stream text default null, p_country text default null)
returns table (year int, colleges bigint, median_package numeric, avg_package numeric, highest_package numeric, currency text)
language sql stable security definer set search_path = public as $$
  select pl.year, count(distinct pl.college_id),
         round((percentile_cont(0.5) within group (order by coalesce(pl.median_package, pl.avg_package)))::numeric, 0),
         round(avg(pl.avg_package)::numeric, 0), max(pl.highest_package), max(pl.currency)
  from college_placements pl
  join colleges c on c.id = pl.college_id and c.is_published and not ('placements' = any(c.hidden_sections))
  where coalesce(pl.median_package, pl.avg_package) is not null
    and (p_stream is null or exists (select 1 from unnest(c.streams) s where lower(s) = lower(p_stream)))
    and (p_country is null or c.country_code = upper(p_country) or c.country = p_country)
    and pl.currency = coalesce((select currency_code from countries where code = upper(coalesce(p_country, 'IN'))), pl.currency)
  group by pl.year order by pl.year;
$$;
create or replace function public.top_placements(p_stream text default null, p_country text default null, p_year int default null, p_lim int default 20)
returns table (slug text, name text, city text, year int, course text, median_package numeric, avg_package numeric, highest_package numeric, placement_rate numeric, currency text)
language sql stable security definer set search_path = public as $$
  select * from (
    select distinct on (c.id) c.slug, c.name, c.city, pl.year, pl.course, pl.median_package, pl.avg_package, pl.highest_package, pl.placement_rate, pl.currency
    from college_placements pl
    join colleges c on c.id = pl.college_id and c.is_published and not ('placements' = any(c.hidden_sections))
    where (p_stream is null or exists (select 1 from unnest(c.streams) s where lower(s) = lower(p_stream)))
      and (p_country is null or c.country_code = upper(p_country) or c.country = p_country)
      and (p_year is null or pl.year = p_year)
      and coalesce(pl.median_package, pl.avg_package) is not null
    order by c.id, pl.year desc, coalesce(pl.median_package, pl.avg_package) desc
  ) t
  order by coalesce(t.median_package, t.avg_package) desc nulls last
  limit least(greatest(p_lim, 1), 100);
$$;
grant execute on function public.placement_trends, public.top_placements to anon, authenticated;

-- ---------------------------------------------------------------- fix: let the server (service role, no user JWT) moderate
-- These guards used "not is_admin()", which is also true for the service-role key, so admin actions made through the
-- API (verify a review, mark an answer official, change a job-application status) were silently undone.
create or replace function public.protect_review_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
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

create or replace function public.protect_application_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if public.owns_job(old.job_id) and old.user_id <> auth.uid() then
    new.user_id := old.user_id; new.job_id := old.job_id;
    new.full_name := old.full_name; new.phone := old.phone; new.email := old.email;
    new.cover_letter := old.cover_letter; new.resume_path := old.resume_path; new.resume_snapshot := old.resume_snapshot;
    return new;
  end if;
  new.status := old.status;
  new.admin_note := old.admin_note;
  new.user_id := old.user_id;
  new.job_id := old.job_id;
  return new;
end $$;

create or replace function public.protect_answer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then new.is_official := false; end if;
  return new;
end $$;

-- ---------------------------------------------------------------- housekeeping
do $$
declare fn text;
begin
  foreach fn in array array['redemption_refund()','points_on_review()','points_on_application()','set_referral_code()','protect_profile_columns()',
                            'protect_review_columns()','protect_application_columns()','protect_answer()',
                            'award(uuid, integer, text, uuid, text)','approve_referral(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;

alter function public.simple_slug(text) set search_path = public;
-- login-only RPCs: not callable by anonymous visitors (they also check auth.uid() themselves)
revoke execute on function public.claim_referral(text), public.my_referrals(), public.points_balance(uuid), public.request_redemption(text) from public, anon;
grant execute on function public.claim_referral(text), public.my_referrals(), public.points_balance(uuid), public.request_redemption(text) to authenticated;
