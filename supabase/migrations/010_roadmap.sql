-- =====================================================================
-- StudyEarnstay.com — migration 010: roadmap features
--   1 rankings + cutoff details   2 marks→rank   3 verified PG + visits
--   4 senior connect, roommates, private messages   5 recommender
--   6 scholarships + visa guides   8 sponsored listings, payments, lead partners
-- Run AFTER 009. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------- 1. data
alter table public.cutoffs add column if not exists home_state text;            -- state for "Home State" quota rows
alter table public.cutoffs add column if not exists gender text default 'Gender-Neutral';
create index if not exists cutoffs_state_idx on public.cutoffs (exam_slug, quota, home_state);

create table if not exists public.college_rankings (
  id         uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  source     text not null default 'NIRF',        -- NIRF, QS, THE …
  year       int not null,
  category   text not null default 'Overall',     -- Overall, Engineering, Management …
  rank       int,
  rank_band  text,                                  -- e.g. "101-150" when no exact rank
  score      numeric,
  source_url text,
  created_at timestamptz default now(),
  unique (college_id, source, year, category)
);
create index if not exists rankings_lookup_idx on public.college_rankings (source, year, category, rank);
alter table public.college_rankings enable row level security;
drop policy if exists "rankings public read" on public.college_rankings;
drop policy if exists "rankings admin all" on public.college_rankings;
create policy "rankings public read" on public.college_rankings for select using (
  exists (select 1 from public.colleges c where c.id = college_id and c.is_published and not ('ranking' = any(c.hidden_fields))) or public.is_admin());
create policy "rankings admin all" on public.college_rankings for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- 2. marks → rank (from official / published analyses only)
create table if not exists public.rank_bands (
  id         uuid primary key default gen_random_uuid(),
  exam_slug  text not null references public.exams(slug) on update cascade on delete cascade,
  year       int not null,
  category   text not null default 'All',
  marks_from numeric not null,
  marks_to   numeric not null,
  rank_from  int not null,
  rank_to    int not null,
  source     text,
  created_at timestamptz default now(),
  check (marks_to >= marks_from)
);
create index if not exists rank_bands_idx on public.rank_bands (exam_slug, category, year desc, marks_from);
alter table public.rank_bands enable row level security;
drop policy if exists "rank bands public read" on public.rank_bands;
drop policy if exists "rank bands admin all" on public.rank_bands;
create policy "rank bands public read" on public.rank_bands for select using (true);
create policy "rank bands admin all" on public.rank_bands for all using (public.is_admin()) with check (public.is_admin());

-- Estimated rank range for marks, from the latest year that has data; linear inside the band
create or replace function public.predict_rank(p_exam text, p_marks numeric, p_category text default 'All')
returns table (year int, rank_low int, rank_high int, rank_estimate int, source text)
language sql stable set search_path = public as $$
  with y as (
    select max(year) as yr from rank_bands where exam_slug = p_exam and category in (p_category, 'All')
  ), b as (
    select r.* from rank_bands r, y
    where r.exam_slug = p_exam and r.year = y.yr and r.category in (p_category, 'All')
      and p_marks between r.marks_from and r.marks_to
    order by (r.category = p_category) desc limit 1
  )
  select b.year, least(b.rank_from, b.rank_to), greatest(b.rank_from, b.rank_to),
         round(b.rank_to + (b.rank_from - b.rank_to) * (p_marks - b.marks_from) / nullif(b.marks_to - b.marks_from, 0))::int,
         b.source
  from b;
$$;
grant execute on function public.predict_rank to anon, authenticated;

-- predictor with home-state quota (Home State rows only count for students from that state)
do $$ begin
  if exists (select 1 from pg_proc where proname = 'predict_colleges' and pronamespace = 'public'::regnamespace and pronargs = 5) then
    alter function public.predict_colleges(text, int, text, text, text) rename to predict_colleges_v1;
    revoke execute on function public.predict_colleges_v1(text, int, text, text, text) from anon, authenticated;
  end if;
end $$;
create or replace function public.predict_colleges(p_exam text, p_rank int, p_category text default 'General',
                                                   p_quota text default null, p_country text default null, p_state text default null)
returns table (college_id uuid, slug text, name text, city text, state text, country text, cover_url text,
               course text, category text, quota text, home_state text, year int, opening_rank int, closing_rank int, chance text)
language sql stable security definer set search_path = public as $$
  with latest as (
    select distinct on (c.college_id, c.course, c.category, c.quota, c.gender) c.*
    from public.cutoffs c
    where c.exam_slug = p_exam and c.category = p_category
      and (p_quota is null or c.quota = p_quota)
      and (c.quota is distinct from 'Home State' or (p_state is not null and lower(coalesce(c.home_state, '')) = lower(p_state)))
      and (c.quota is distinct from 'Other State' or p_state is null or lower(coalesce(c.home_state, '')) <> lower(p_state))
    order by c.college_id, c.course, c.category, c.quota, c.gender, c.year desc,
             case c.round when 'Final' then 0 else 1 end
  )
  select co.id, co.slug, co.name, co.city, co.state, co.country,
         case when 'photos' = any(co.hidden_fields) then null else co.cover_url end,
         l.course, l.category, l.quota, l.home_state, l.year, l.opening_rank, l.closing_rank,
         case when p_rank <= l.closing_rank * 0.85 then 'High'
              when p_rank <= l.closing_rank then 'Medium'
              else 'Low' end
  from latest l
  join public.colleges co on co.id = l.college_id and co.is_published and not ('cutoffs' = any(co.hidden_sections))
  where p_rank <= l.closing_rank * 1.15
    and (p_country is null or co.country = p_country)
  order by case when p_rank <= l.closing_rank * 0.85 then 0 when p_rank <= l.closing_rank then 1 else 2 end,
           l.closing_rank asc
  limit 300;
$$;
grant execute on function public.predict_colleges(text, int, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------- 3. verified PG + visits
alter table public.hostels add column if not exists verified_at     timestamptz;
alter table public.hostels add column if not exists verified_note   text;            -- "Visited by our team on …"
alter table public.hostels add column if not exists video_url       text;            -- YouTube / Vimeo / mp4
alter table public.hostels add column if not exists tour_url        text;            -- 360° tour link
alter table public.hostels add column if not exists safety          text[] not null default '{}';  -- cctv, biometric, warden, guard, fire_safety, women_only_floor, first_aid
alter table public.hostels add column if not exists deposit_amount  numeric;
alter table public.hostels add column if not exists notice_days     int;
alter table public.hostels add column if not exists lock_in_months  int;
alter table public.hostels add column if not exists house_rules     text;
alter table public.hostels add column if not exists visit_slots     text[] not null default '{}';  -- e.g. {"Weekdays 5-8 pm","Sunday 10 am-1 pm"}

create or replace function public.protect_listing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.is_published := false;
  new.approval_status := 'pending';
  if tg_table_name = 'hostels' then
    new.is_verified := false;
    new.verified_at := null;
    new.verified_note := null;
    new.submitted_by := coalesce(old.submitted_by, auth.uid());
  else
    new.created_by := coalesce(old.created_by, auth.uid());
  end if;
  return new;
end $$;

create table if not exists public.hostel_visits (
  id          uuid primary key default gen_random_uuid(),
  hostel_id   uuid not null references public.hostels(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  visit_date  date not null,
  slot        text,
  mode        text not null default 'in_person' check (mode in ('in_person','video_call')),
  name        text not null,
  phone       text not null,
  note        text,
  status      text not null default 'requested' check (status in ('requested','confirmed','done','cancelled','no_show')),
  owner_note  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists hostel_visits_hostel_idx on public.hostel_visits (hostel_id, visit_date);
create index if not exists hostel_visits_user_idx on public.hostel_visits (user_id);
alter table public.hostel_visits enable row level security;
drop policy if exists "visits own" on public.hostel_visits;
drop policy if exists "visits own insert" on public.hostel_visits;
drop policy if exists "visits own update" on public.hostel_visits;
drop policy if exists "visits owner" on public.hostel_visits;
drop policy if exists "visits owner update" on public.hostel_visits;
drop policy if exists "visits admin" on public.hostel_visits;
create policy "visits own" on public.hostel_visits for select using (user_id = auth.uid());
create policy "visits own insert" on public.hostel_visits for insert with check (
  user_id = auth.uid() and public.is_active_user() and status = 'requested' and visit_date >= current_date
  and exists (select 1 from public.hostels h where h.id = hostel_id and h.is_published));
create policy "visits own update" on public.hostel_visits for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "visits owner" on public.hostel_visits for select using (public.owns_hostel(hostel_id));
create policy "visits owner update" on public.hostel_visits for update using (public.owns_hostel(hostel_id)) with check (public.owns_hostel(hostel_id));
create policy "visits admin" on public.hostel_visits for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.hostel_visit_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;
  if public.owns_hostel(old.hostel_id) and old.user_id <> auth.uid() then
    -- owner: status + note only
    new.user_id := old.user_id; new.hostel_id := old.hostel_id; new.visit_date := old.visit_date; new.slot := old.slot;
    new.mode := old.mode; new.name := old.name; new.phone := old.phone; new.note := old.note;
    if new.status not in ('confirmed','done','cancelled','no_show','requested') then new.status := old.status; end if;
    return new;
  end if;
  -- student: may only cancel
  if new.status <> old.status and new.status <> 'cancelled' then new.status := old.status; end if;
  new.owner_note := old.owner_note; new.user_id := old.user_id; new.hostel_id := old.hostel_id;
  return new;
end $$;
drop trigger if exists hostel_visits_guard on public.hostel_visits;
create trigger hostel_visits_guard before update on public.hostel_visits for each row execute function public.hostel_visit_guard();
drop trigger if exists hostel_visits_touch on public.hostel_visits;
create trigger hostel_visits_touch before update on public.hostel_visits for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- 4. senior connect, roommates, messages
create table if not exists public.college_members (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  college_id        uuid not null references public.colleges(id) on delete cascade,
  relation          text not null default 'student' check (relation in ('student','alumnus','aspirant')),
  course            text,
  batch_year        int,
  bio               text check (bio is null or char_length(bio) <= 400),
  open_to_questions boolean not null default true,
  is_verified       boolean not null default false,       -- set by admin (e.g. from a verified review / college email)
  created_at        timestamptz default now(),
  unique (user_id, college_id)
);
create index if not exists college_members_college_idx on public.college_members (college_id, relation);
alter table public.college_members enable row level security;
drop policy if exists "members own" on public.college_members;
drop policy if exists "members admin" on public.college_members;
create policy "members own" on public.college_members for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());
create policy "members admin" on public.college_members for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.protect_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.is_verified := case when tg_op = 'UPDATE' then old.is_verified else false end;
    new.user_id := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists college_members_protect on public.college_members;
create trigger college_members_protect before insert or update on public.college_members for each row execute function public.protect_member();

create or replace view public.college_members_public with (security_invoker = false) as
select m.id, m.college_id, m.user_id, m.relation, m.course, m.batch_year, m.bio, m.open_to_questions, m.is_verified, m.created_at,
       coalesce(split_part(p.full_name, ' ', 1), 'Student') as first_name
from public.college_members m
join public.profiles p on p.id = m.user_id and not p.is_blocked
join public.colleges c on c.id = m.college_id and c.is_published;
grant select on public.college_members_public to anon, authenticated;

create table if not exists public.roommate_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  looking_for text not null default 'roommate' check (looking_for in ('roommate','room','both')),
  city        text not null,
  country     text,
  college_id  uuid references public.colleges(id) on delete set null,
  budget_min  numeric,
  budget_max  numeric,
  currency    text default 'INR',
  move_in     date,
  gender      text not null default 'Any' check (gender in ('Female','Male','Any')),
  about       text not null check (char_length(about) between 20 and 1000),
  is_active   boolean not null default true,
  expires_at  timestamptz not null default now() + interval '60 days',
  created_at  timestamptz default now()
);
create index if not exists roommate_city_idx on public.roommate_posts (city, is_active, created_at desc);
alter table public.roommate_posts enable row level security;
drop policy if exists "roommates own" on public.roommate_posts;
drop policy if exists "roommates admin" on public.roommate_posts;
create policy "roommates own" on public.roommate_posts for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());
create policy "roommates admin" on public.roommate_posts for all using (public.is_admin()) with check (public.is_admin());

create or replace view public.roommate_posts_public with (security_invoker = false) as
select r.id, r.user_id, r.looking_for, r.city, r.country, r.college_id, c.name as college_name, c.slug as college_slug,
       r.budget_min, r.budget_max, r.currency, r.move_in, r.gender, r.about, r.created_at,
       coalesce(split_part(p.full_name, ' ', 1), 'Student') as first_name
from public.roommate_posts r
join public.profiles p on p.id = r.user_id and not p.is_blocked
left join public.colleges c on c.id = r.college_id
where r.is_active and r.expires_at > now();
grant select on public.roommate_posts_public to anon, authenticated;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists "blocks own" on public.user_blocks;
create policy "blocks own" on public.user_blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references public.profiles(id) on delete cascade,
  user_b          uuid not null references public.profiles(id) on delete cascade,
  context_type    text not null check (context_type in ('college','roommate')),
  context_id      uuid,
  created_at      timestamptz default now(),
  last_message_at timestamptz default now(),
  check (user_a <> user_b)
);
create unique index if not exists conversations_pair_idx on public.conversations
  (least(user_a, user_b), greatest(user_a, user_b), context_type, coalesce(context_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.conversations enable row level security;
drop policy if exists "conv participants" on public.conversations;
drop policy if exists "conv admin" on public.conversations;
create policy "conv participants" on public.conversations for select using (auth.uid() in (user_a, user_b));
create policy "conv admin" on public.conversations for select using (public.is_admin());

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  read_at         timestamptz,
  created_at      timestamptz default now()
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);
alter table public.messages enable row level security;

create or replace function public.is_participant(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations where id = cid and auth.uid() in (user_a, user_b));
$$;
create or replace function public.can_message(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations c
    where c.id = cid and auth.uid() in (c.user_a, c.user_b)
      and not exists (select 1 from user_blocks b
                      where (b.blocker_id = c.user_a and b.blocked_id = c.user_b) or (b.blocker_id = c.user_b and b.blocked_id = c.user_a)))
    and public.is_active_user();
$$;
grant execute on function public.is_participant, public.can_message to authenticated;

drop policy if exists "messages read" on public.messages;
drop policy if exists "messages send" on public.messages;
drop policy if exists "messages mark read" on public.messages;
drop policy if exists "messages admin" on public.messages;
create policy "messages read" on public.messages for select using (public.is_participant(conversation_id));
create policy "messages send" on public.messages for insert with check (sender_id = auth.uid() and public.can_message(conversation_id) and read_at is null);
create policy "messages mark read" on public.messages for update using (public.is_participant(conversation_id) and sender_id <> auth.uid())
  with check (public.is_participant(conversation_id));
create policy "messages admin" on public.messages for select using (public.is_admin());

create or replace function public.message_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if not public.is_admin() then   -- recipient can only set read_at
      new.body := old.body; new.sender_id := old.sender_id; new.conversation_id := old.conversation_id; new.created_at := old.created_at;
    end if;
    return new;
  end if;
  -- simple flood control: 60 messages / hour / sender
  if (select count(*) from messages where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'You are sending messages too fast. Please wait a little.';
  end if;
  update conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before insert or update on public.messages for each row execute function public.message_guard();

-- Start (or reopen) a conversation. Only with members open to questions or active roommate posts.
create or replace function public.start_conversation(p_other uuid, p_context_type text, p_context_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; me uuid := auth.uid();
begin
  if me is null or not public.is_active_user() then raise exception 'Please log in'; end if;
  if p_other = me then raise exception 'That is you'; end if;
  if exists (select 1 from user_blocks where (blocker_id = p_other and blocked_id = me) or (blocker_id = me and blocked_id = p_other)) then
    raise exception 'You cannot message this person';
  end if;
  if p_context_type = 'college' and not exists (
       select 1 from college_members m where m.user_id = p_other and m.college_id = p_context_id and m.open_to_questions) then
    raise exception 'This person is not taking questions';
  elsif p_context_type = 'roommate' and not exists (
       select 1 from roommate_posts r where r.user_id = p_other and r.id = p_context_id and r.is_active and r.expires_at > now()) then
    raise exception 'This post is no longer active';
  elsif p_context_type not in ('college','roommate') then
    raise exception 'Unknown context';
  end if;
  select id into cid from conversations
   where least(user_a, user_b) = least(me, p_other) and greatest(user_a, user_b) = greatest(me, p_other)
     and context_type = p_context_type and context_id is not distinct from p_context_id;
  if cid is not null then return cid; end if;
  if (select count(*) from conversations where user_a = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily limit of new conversations reached';
  end if;
  insert into conversations (user_a, user_b, context_type, context_id) values (me, p_other, p_context_type, p_context_id) returning id into cid;
  return cid;
end $$;
grant execute on function public.start_conversation to authenticated;

-- My inbox with the other person's first name and unread count
create or replace function public.my_conversations()
returns table (id uuid, context_type text, context_id uuid, context_label text, other_id uuid, other_name text,
               last_message text, last_message_at timestamptz, unread int)
language sql stable security definer set search_path = public as $$
  select c.id, c.context_type, c.context_id,
         case c.context_type when 'college' then (select name from colleges where id = c.context_id)
                             else (select 'Roommate · ' || city from roommate_posts where id = c.context_id) end,
         o.id, coalesce(split_part(o.full_name, ' ', 1), 'Student'),
         (select body from messages m where m.conversation_id = c.id order by created_at desc limit 1),
         c.last_message_at,
         (select count(*)::int from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
  from conversations c
  join profiles o on o.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  where auth.uid() in (c.user_a, c.user_b)
  order by c.last_message_at desc
  limit 200;
$$;
grant execute on function public.my_conversations to authenticated;

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('message','user','roommate_post','member','hostel','job','review')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 3 and 1000),
  status      text not null default 'open' check (status in ('open','actioned','dismissed')),
  admin_note  text,
  created_at  timestamptz default now()
);
alter table public.reports enable row level security;
drop policy if exists "reports own insert" on public.reports;
drop policy if exists "reports admin" on public.reports;
create policy "reports own insert" on public.reports for insert with check (reporter_id = auth.uid() and status = 'open');
create policy "reports admin" on public.reports for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- 5. recommender
create or replace function public.recommend_colleges(
  p_country text default null, p_state text default null, p_stream text default null, p_budget numeric default null,
  p_exam text default null, p_rank int default null, p_category text default 'General',
  p_lat double precision default null, p_lng double precision default null, p_lim int default 30)
returns table (id uuid, slug text, name text, city text, state text, country text, cover_url text, logo_url text,
               fees_min numeric, fees_max numeric, currency text, avg_rating numeric, nirf_rank int,
               chance text, distance_km numeric, score numeric, reasons text[])
language sql stable security definer set search_path = public as $$
  with base as (
    select c.*,
      (select round(avg(r.rating)::numeric, 1) from reviews r where r.college_id = c.id and r.status = 'approved') as rating,
      (select min(k.rank) from college_rankings k where k.college_id = c.id and k.source = 'NIRF'
         and k.year = (select max(year) from college_rankings where source = 'NIRF')) as nirf,
      case when p_exam is not null and p_rank is not null then (
        select case when bool_or(p_rank <= x.closing_rank * 0.85) then 'High'
                    when bool_or(p_rank <= x.closing_rank) then 'Medium'
                    when bool_or(p_rank <= x.closing_rank * 1.15) then 'Low' end
        from cutoffs x where x.college_id = c.id and x.exam_slug = p_exam and x.category = p_category
          and (x.quota is distinct from 'Home State' or lower(coalesce(x.home_state,'')) = lower(coalesce(p_state,'')))
      ) end as ch,
      case when p_lat is not null and c.latitude is not null and not ('map' = any(c.hidden_fields))
           then round(distance_km(p_lat, p_lng, c.latitude, c.longitude)::numeric, 1) end as dist
    from colleges c
    where c.is_published
      and (p_country is null or c.country = p_country or c.country_code = upper(p_country))
      and (p_stream is null or exists (select 1 from unnest(c.streams) s where lower(s) like '%' || lower(p_stream) || '%')
           or lower(c.name) like '%' || lower(p_stream) || '%')
      and (p_budget is null or 'fees' = any(c.hidden_fields) or c.fees_min is null or c.fees_min <= p_budget)
  ), scored as (
    select b.*,
      (coalesce(b.rating, 3) * 8
       + case when b.nirf is not null then greatest(0, 40 - b.nirf / 5.0) else 0 end
       + case b.ch when 'High' then 35 when 'Medium' then 22 when 'Low' then 6 else 0 end
       + case when p_state is not null and lower(b.state) = lower(p_state) then 10 else 0 end
       + case when b.dist is not null then greatest(0, 15 - b.dist / 20.0) else 0 end
       + case when p_budget is not null and b.fees_max is not null and b.fees_max <= p_budget and not ('fees' = any(b.hidden_fields)) then 8 else 0 end
       + case when b.is_featured then 3 else 0 end
       - case when p_exam is not null and p_rank is not null and b.ch is null then 25 else 0 end) as sc
    from base b
  )
  select s.id, s.slug, s.name, s.city, s.state, s.country,
         case when 'photos' = any(s.hidden_fields) then null else s.cover_url end,
         case when 'logo' = any(s.hidden_fields) then null else s.logo_url end,
         case when 'fees' = any(s.hidden_fields) then null else s.fees_min end,
         case when 'fees' = any(s.hidden_fields) then null else s.fees_max end,
         s.currency, s.rating, s.nirf, s.ch, s.dist, round(s.sc::numeric, 1),
         array_remove(array[
           case when s.ch is not null then s.ch || ' chance with your rank' end,
           case when s.nirf is not null then 'NIRF rank ' || s.nirf end,
           case when s.rating is not null then 'Rated ' || s.rating || '/5 by students' end,
           case when p_state is not null and lower(s.state) = lower(p_state) then 'In your state' end,
           case when s.dist is not null and s.dist < 50 then s.dist || ' km away' end,
           case when p_budget is not null and s.fees_max is not null and s.fees_max <= p_budget and not ('fees' = any(s.hidden_fields)) then 'Within your budget' end
         ], null)
  from scored s
  order by s.sc desc, s.name
  limit least(greatest(p_lim, 1), 60);
$$;
grant execute on function public.recommend_colleges to anon, authenticated;

-- ---------------------------------------------------------------- 6. scholarships + visa guides
create table if not exists public.scholarships (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  provider      text,
  host_country  text,                       -- where you study (ISO code); null = any / your own country
  for_nationalities text[] not null default '{}',   -- empty = everyone
  levels        text[] not null default '{}',       -- UG, PG, PhD, Diploma …
  field         text,
  amount        numeric,
  currency      text,
  amount_note   text,                       -- "Full tuition + monthly stipend"
  deadline      date,
  eligibility   text,
  how_to_apply  text,
  official_url  text not null,
  is_published  boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists scholarships_country_idx on public.scholarships (host_country, deadline);
alter table public.scholarships enable row level security;
drop policy if exists "scholarships public read" on public.scholarships;
drop policy if exists "scholarships admin" on public.scholarships;
create policy "scholarships public read" on public.scholarships for select using (is_published or public.is_admin());
create policy "scholarships admin" on public.scholarships for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.visa_guides (
  country_code    char(2) primary key,
  title           text not null,
  summary         text,
  body            text,                     -- Markdown
  processing_time text,
  fee_note        text,
  work_rights     text,
  official_url    text not null,            -- always link the official immigration site
  is_published    boolean not null default true,
  updated_at      timestamptz default now()
);
alter table public.visa_guides enable row level security;
drop policy if exists "visa public read" on public.visa_guides;
drop policy if exists "visa admin" on public.visa_guides;
create policy "visa public read" on public.visa_guides for select using (is_published or public.is_admin());
create policy "visa admin" on public.visa_guides for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- 8. sponsored listings, payments, lead partners
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete set null,
  purpose             text not null default 'boost' check (purpose in ('boost')),
  item_type           text not null check (item_type in ('hostel','job')),
  item_id             uuid not null,
  days                int not null,
  amount              int not null,          -- smallest unit (paise)
  currency            text not null default 'INR',
  provider            text not null default 'razorpay',
  provider_order_id   text unique,
  provider_payment_id text,
  status              text not null default 'created' check (status in ('created','paid','failed','refunded')),
  created_at          timestamptz default now(),
  paid_at             timestamptz
);
alter table public.payments enable row level security;
drop policy if exists "payments own read" on public.payments;
drop policy if exists "payments admin" on public.payments;
create policy "payments own read" on public.payments for select using (user_id = auth.uid());
create policy "payments admin" on public.payments for select using (public.is_admin());

create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),
  item_type   text not null check (item_type in ('college','hostel','job','quota_seat')),
  item_id     uuid not null,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  payment_id  uuid references public.payments(id) on delete set null,
  note        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now(),
  check (ends_at > starts_at)
);
create index if not exists promotions_active_idx on public.promotions (item_type, ends_at);
alter table public.promotions enable row level security;
drop policy if exists "promotions public read" on public.promotions;
drop policy if exists "promotions admin" on public.promotions;
create policy "promotions public read" on public.promotions for select using (now() between starts_at and ends_at or public.is_admin());
create policy "promotions admin" on public.promotions for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.college_partners (
  college_id     uuid primary key references public.colleges(id) on delete cascade,
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  lead_price     numeric,
  currency       text default 'INR',
  auto_share     boolean not null default false,     -- send enquiries for this college automatically
  is_active      boolean not null default true,
  notes          text,
  created_at     timestamptz default now()
);
alter table public.college_partners enable row level security;
drop policy if exists "partners admin" on public.college_partners;
create policy "partners admin" on public.college_partners for all using (public.is_admin()) with check (public.is_admin());

alter table public.leads add column if not exists shared_with uuid references public.colleges(id) on delete set null;
alter table public.leads add column if not exists shared_at   timestamptz;
alter table public.leads add column if not exists consent_share boolean not null default false;  -- student agreed to share with the college

-- ---------------------------------------------------------------- housekeeping
do $$
declare t text;
begin
  foreach t in array array['scholarships','visa_guides'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
do $$
declare fn text;
begin
  foreach fn in array array['protect_listing()','hostel_visit_guard()','protect_member()','message_guard()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;
