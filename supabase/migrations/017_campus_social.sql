-- =====================================================================
-- Collegeolo.com — migration 017: campus community
--   • student profile: gender (private), college, course, passing-out year, call / last-seen / suggestion switches
--   • AI selfie verification (verified tick)
--   • same-college chat: anyone → girls starts as a REQUEST unless the sender is a verified girl; accept / decline
--   • voice / video calls (WebRTC, signalling over Supabase Realtime private channels)
--   • community feed: posts (photos, videos, place, emoji), blogs, mock-result posts; like / dislike / comment / reply / share
--   • reports + admin moderation; chats auto-deleted after 6 months (posts stay)
-- Run AFTER 016. No DROP statements (safe for the Supabase MCP).
-- =====================================================================

-- ---------------------------------------------------------------- 1. profile fields
alter table public.profiles add column if not exists gender text check (gender is null or gender in ('female','male','other','prefer_not'));
alter table public.profiles add column if not exists college_id uuid references public.colleges(id) on delete set null;
alter table public.profiles add column if not exists course text check (course is null or char_length(course) <= 120);
alter table public.profiles add column if not exists batch_year int check (batch_year is null or batch_year between 1980 and 2100);   -- year of passing out
alter table public.profiles add column if not exists verification text not null default 'none'
  check (verification in ('none','pending','verified','rejected','review'));
alter table public.profiles add column if not exists verified_at timestamptz;
alter table public.profiles add column if not exists allow_calls boolean not null default true;
alter table public.profiles add column if not exists show_last_seen boolean not null default true;
alter table public.profiles add column if not exists campus_visible boolean not null default true;   -- appear in "people from your college"
create index if not exists profiles_college_idx on public.profiles (college_id) where college_id is not null;

-- users cannot verify themselves; changing gender or photo removes the tick (must verify again)
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_blocked := old.is_blocked;
    new.email := old.email;
    new.referral_code := old.referral_code;
    if coalesce(current_setting('app.claiming_referral', true), '') <> 'on' then new.referred_by := old.referred_by; end if;
    new.verification := old.verification;
    new.verified_at := old.verified_at;
    if old.verification in ('verified','review','pending')
       and (new.gender is distinct from old.gender or new.avatar_url is distinct from old.avatar_url) then
      new.verification := 'none'; new.verified_at := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- short public name: @username, else first name (never the surname)
create or replace function public.display_name(p profiles)
returns text language sql stable set search_path = public as $$
  select coalesce(nullif(p.username, ''), nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), ''), 'Student');
$$;

-- ---------------------------------------------------------------- 2. verification records (selfies live in a private bucket; deleted after the decision)
create table if not exists public.identity_verifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'started' check (status in ('started','pending','verified','rejected','review','expired')),
  challenge    text not null,
  selfie_paths text[] not null default '{}',
  ai           jsonb,
  reason       text,
  decided_by   text,                 -- ai | admin
  created_at   timestamptz default now(),
  decided_at   timestamptz
);
create index if not exists identity_verifications_user_idx on public.identity_verifications (user_id, created_at desc);
create index if not exists identity_verifications_status_idx on public.identity_verifications (status, created_at);
alter table public.identity_verifications enable row level security;
drop policy if exists "idv own read" on public.identity_verifications;
create policy "idv own read" on public.identity_verifications for select using (user_id = auth.uid() or public.is_admin());
-- writes only through the API (service role)
revoke insert, update, delete on public.identity_verifications from anon, authenticated;

-- ---------------------------------------------------------------- 3. chat requests (girls protected)
alter table public.conversations add column if not exists status text not null default 'active' check (status in ('active','pending','declined'));
alter table public.conversations add column if not exists requested_by uuid references public.profiles(id) on delete set null;
alter table public.conversations add column if not exists request_note text check (request_note is null or char_length(request_note) <= 300);
alter table public.conversations add column if not exists responded_at timestamptz;
create index if not exists conversations_user_a_idx on public.conversations (user_a, last_message_at desc);
create index if not exists conversations_user_b_idx on public.conversations (user_b, last_message_at desc);

-- verified girl?
create or replace function public.is_verified_female(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and gender = 'female' and verification = 'verified');
$$;

-- Every new conversation (college Q&A, roommate or campus chat): user_a starts it. If user_b is a girl and user_a is
-- not a verified girl, it starts as a pending request that she must accept.
create or replace function public.conversation_request_rule()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = new.user_b and gender = 'female') and not public.is_verified_female(new.user_a) then
    new.status := 'pending';
  else
    new.status := 'active';
  end if;
  new.requested_by := new.user_a;
  new.responded_at := null;
  return new;
end $$;
create or replace trigger conversations_request_rule before insert on public.conversations
  for each row execute function public.conversation_request_rule();

-- only active conversations accept messages
create or replace function public.can_message(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations c
    where c.id = cid and auth.uid() in (c.user_a, c.user_b) and c.status = 'active'
      and not exists (select 1 from user_blocks b
                      where (b.blocker_id = c.user_a and b.blocked_id = c.user_b) or (b.blocker_id = c.user_b and b.blocked_id = c.user_a))
      and not exists (select 1 from profiles p where p.id in (c.user_a, c.user_b) and p.is_blocked))
    and public.is_active_user();
$$;

-- What happens if I try to message this person?
--   direct | request | login | self | no_college | other_college | not_student | blocked | unavailable
create or replace function public.campus_mode(p_other uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare me profiles; o profiles;
begin
  if auth.uid() is null or not public.is_active_user() then return 'login'; end if;
  if p_other = auth.uid() then return 'self'; end if;
  select * into me from profiles where id = auth.uid();
  select * into o from profiles where id = p_other;
  if o.id is null or o.is_blocked then return 'unavailable'; end if;
  if coalesce(me.account_type, 'student') <> 'student' or coalesce(o.account_type, 'student') <> 'student' then return 'not_student'; end if;
  if me.college_id is null then return 'no_college'; end if;
  if o.college_id is distinct from me.college_id then return 'other_college'; end if;
  if exists (select 1 from user_blocks where (blocker_id = me.id and blocked_id = o.id) or (blocker_id = o.id and blocked_id = me.id)) then return 'blocked'; end if;
  if o.gender = 'female' and not (me.gender = 'female' and me.verification = 'verified') then return 'request'; end if;
  return 'direct';
end $$;

-- Start a chat with a student of my college (or send a request). Returns the conversation id.
create or replace function public.start_campus_chat(p_other uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mode text := public.campus_mode(p_other); col uuid; c conversations; cid uuid;
begin
  if mode = 'login' then raise exception 'Please log in with a student account'; end if;
  if mode = 'self' then raise exception 'That is you'; end if;
  if mode = 'no_college' then raise exception 'Add your college in your profile first'; end if;
  if mode = 'other_college' then raise exception 'You can only message students of your own college'; end if;
  if mode = 'not_student' then raise exception 'Chat is only between students'; end if;
  if mode in ('blocked','unavailable') then raise exception 'You cannot message this person'; end if;
  select college_id into col from profiles where id = me;
  select * into c from conversations
   where least(user_a, user_b) = least(me, p_other) and greatest(user_a, user_b) = greatest(me, p_other)
     and context_type = 'college' and context_id = col;
  if c.id is not null then
    if c.status = 'pending' and c.requested_by <> me then          -- they asked me: replying accepts
      update conversations set status = 'active', responded_at = now() where id = c.id;
    elsif c.status = 'declined' and c.requested_by = me then
      if c.responded_at > now() - interval '30 days' then raise exception 'This student declined your request. You can ask again after 30 days.'; end if;
      update conversations set status = case when mode = 'direct' then 'active' else 'pending' end,
             request_note = left(nullif(trim(p_note), ''), 300), responded_at = null, last_message_at = now() where id = c.id;
    elsif c.status = 'declined' then
      update conversations set status = 'active', responded_at = now() where id = c.id;   -- she changed her mind
    end if;
    return c.id;
  end if;
  if (select count(*) from conversations where user_a = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily limit of new chats reached';
  end if;
  if mode = 'request' and (select count(*) from conversations where user_a = me and status = 'pending' and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You can send 10 chat requests a day';
  end if;
  insert into conversations (user_a, user_b, context_type, context_id, request_note)
  values (me, p_other, 'college', col, left(nullif(trim(p_note), ''), 300)) returning id into cid;
  return cid;
end $$;

-- accept / decline a request sent to me
create or replace function public.respond_chat_request(p_conv uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare c conversations;
begin
  select * into c from conversations where id = p_conv and auth.uid() in (user_a, user_b) for update;
  if c.id is null then raise exception 'Not found'; end if;
  if c.status <> 'pending' or c.requested_by = auth.uid() then raise exception 'Nothing to answer'; end if;
  update conversations set status = case when p_accept then 'active' else 'declined' end, responded_at = now() where id = c.id;
  return case when p_accept then 'active' else 'declined' end;
end $$;

-- inbox: chats + requests, the other person's short name, tick, last seen, calls
create or replace function public.my_inbox()
returns table (id uuid, status text, i_requested boolean, request_note text, context_type text, context_id uuid, context_label text,
               other_id uuid, other_name text, other_username text, other_verified boolean, other_last_seen timestamptz,
               other_calls boolean, last_message text, last_message_at timestamptz, unread int)
language sql stable security definer set search_path = public as $$
  select c.id, c.status, c.requested_by = auth.uid(), c.request_note, c.context_type, c.context_id,
         case c.context_type when 'college' then (select name from colleges where id = c.context_id)
                             else (select 'Roommate · ' || city from roommate_posts where id = c.context_id) end,
         o.id, public.display_name(o), o.username, o.verification = 'verified',
         case when o.show_last_seen then o.last_seen_at end,
         o.allow_calls and c.status = 'active',
         (select body from messages m where m.conversation_id = c.id order by created_at desc limit 1),
         c.last_message_at,
         (select count(*)::int from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
  from conversations c
  join profiles o on o.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  where auth.uid() in (c.user_a, c.user_b)
    and not (c.status = 'declined' and c.requested_by <> auth.uid())     -- requests I declined disappear from my inbox
  order by (c.status = 'pending' and c.requested_by <> auth.uid()) desc, c.last_message_at desc
  limit 300;
$$;

-- people from my college: senior / junior / batchmate, and whether I can message directly
create or replace function public.campus_people(p_q text default null, p_lim int default 40)
returns table (id uuid, name text, username text, verified boolean, course text, batch_year int, relation text, mode text,
               last_seen timestamptz, has_chat uuid)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select o.id, public.display_name(o), o.username, o.verification = 'verified', o.course, o.batch_year,
         case when me.batch_year is null or o.batch_year is null then 'student'
              when o.batch_year < me.batch_year then 'senior' when o.batch_year > me.batch_year then 'junior' else 'batchmate' end,
         case when o.gender = 'female' and not (me.gender = 'female' and me.verification = 'verified') then 'request' else 'direct' end,
         case when o.show_last_seen then o.last_seen_at end,
         (select c.id from conversations c where least(c.user_a, c.user_b) = least(me.id, o.id) and greatest(c.user_a, c.user_b) = greatest(me.id, o.id)
            and c.context_type = 'college' and c.context_id = me.college_id limit 1)
  from me join profiles o on o.college_id = me.college_id and o.id <> me.id
  where me.college_id is not null and public.is_active_user()
    and coalesce(me.account_type, 'student') = 'student' and coalesce(o.account_type, 'student') = 'student'
    and o.campus_visible and not o.is_blocked
    and not exists (select 1 from user_blocks b where (b.blocker_id = me.id and b.blocked_id = o.id) or (b.blocker_id = o.id and b.blocked_id = me.id))
    and (p_q is null or p_q = '' or o.username ilike '%' || p_q || '%' or (coalesce(o.gender, '') <> 'female' and o.full_name ilike p_q || '%') or o.course ilike '%' || p_q || '%')
  order by (o.verification = 'verified') desc, o.last_seen_at desc nulls last
  limit least(greatest(p_lim, 1), 100);
$$;

-- ---------------------------------------------------------------- 4. calls (WebRTC; signalling on private Realtime channel "call:<id>")
create table if not exists public.calls (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  caller_id       uuid not null references public.profiles(id) on delete cascade,
  callee_id       uuid not null references public.profiles(id) on delete cascade,
  kind            text not null default 'audio' check (kind in ('audio','video')),
  status          text not null default 'ringing' check (status in ('ringing','accepted','declined','missed','ended','failed','busy')),
  created_at      timestamptz default now(),
  answered_at     timestamptz,
  ended_at        timestamptz
);
create index if not exists calls_callee_idx on public.calls (callee_id, created_at desc);
create index if not exists calls_conv_idx on public.calls (conversation_id, created_at desc);
alter table public.calls enable row level security;
drop policy if exists "calls participants" on public.calls;
create policy "calls participants" on public.calls for select using (auth.uid() in (caller_id, callee_id) or public.is_admin());
revoke insert, update, delete on public.calls from anon, authenticated;

create or replace function public.start_call(p_conv uuid, p_kind text default 'audio')
returns uuid language plpgsql security definer set search_path = public as $$
declare c conversations; other uuid; cid uuid;
begin
  if not public.can_message(p_conv) then raise exception 'You can call only in an accepted chat'; end if;
  select * into c from conversations where id = p_conv;
  other := case when c.user_a = auth.uid() then c.user_b else c.user_a end;
  if not (select allow_calls from profiles where id = other) then raise exception 'This student has turned off calls'; end if;
  if (select count(*) from calls where caller_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many calls — try again later';
  end if;
  update calls set status = 'missed', ended_at = now() where status = 'ringing' and created_at < now() - interval '60 seconds'
    and (caller_id in (auth.uid(), other) or callee_id in (auth.uid(), other));
  if exists (select 1 from calls where status in ('ringing','accepted') and created_at > now() - interval '3 hours'
             and other in (caller_id, callee_id)) then
    raise exception 'They are on another call';
  end if;
  insert into calls (conversation_id, caller_id, callee_id, kind)
  values (p_conv, auth.uid(), other, case when p_kind = 'video' then 'video' else 'audio' end) returning id into cid;
  return cid;
end $$;

create or replace function public.update_call(p_call uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
declare k calls;
begin
  select * into k from calls where id = p_call and auth.uid() in (caller_id, callee_id) for update;
  if k.id is null then raise exception 'Not found'; end if;
  if p_status = 'accepted' and k.status = 'ringing' and auth.uid() = k.callee_id then
    update calls set status = 'accepted', answered_at = now() where id = k.id;
  elsif p_status = 'declined' and k.status = 'ringing' and auth.uid() = k.callee_id then
    update calls set status = 'declined', ended_at = now() where id = k.id;
  elsif p_status in ('ended','failed') and k.status in ('ringing','accepted') then
    update calls set status = case when k.status = 'ringing' then (case when auth.uid() = k.caller_id then 'missed' else 'declined' end) else p_status end,
                     ended_at = now() where id = k.id;
  end if;
  return (select status from calls where id = k.id);
end $$;

-- ---------------------------------------------------------------- 5. community: posts, blogs, results
create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  kind            text not null default 'post' check (kind in ('post','blog','result')),
  college_id      uuid references public.colleges(id) on delete set null,
  title           text check (title is null or char_length(title) between 3 and 160),
  body            text check (body is null or char_length(body) <= 20000),
  media           jsonb not null default '[]'::jsonb,      -- [{ "type": "image"|"video", "path": "<uid>/<file>" }] in the public "community" bucket
  place           text check (place is null or char_length(place) <= 120),
  lat             double precision,
  lng             double precision,
  mock_attempt_id uuid references public.mock_attempts(id) on delete set null,
  result          jsonb,                                   -- snapshot written by the database, not the browser
  status          text not null default 'published' check (status in ('published','hidden','removed')),
  hidden_reason   text,
  likes           int not null default 0,
  dislikes        int not null default 0,
  comments        int not null default 0,
  shares          int not null default 0,
  created_at      timestamptz default now(),
  edited_at       timestamptz
);
create index if not exists posts_feed_idx on public.posts (status, created_at desc);
create index if not exists posts_kind_idx on public.posts (kind, status, created_at desc);
create index if not exists posts_college_idx on public.posts (college_id, status, created_at desc);
create index if not exists posts_user_idx on public.posts (user_id, created_at desc);
alter table public.posts enable row level security;
drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select using (status = 'published' or user_id = auth.uid() or public.is_admin());
drop policy if exists "posts create" on public.posts;
create policy "posts create" on public.posts for insert with check (user_id = auth.uid() and public.is_active_user());
drop policy if exists "posts edit own" on public.posts;
create policy "posts edit own" on public.posts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "posts delete own" on public.posts;
create policy "posts delete own" on public.posts for delete using (user_id = auth.uid() or public.is_admin());
drop policy if exists "posts admin" on public.posts;
create policy "posts admin" on public.posts for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.post_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare me profiles; a mock_attempts; item jsonb; r_rank bigint; r_total bigint;
begin
  if auth.uid() is null then return new; end if;                                   -- API (service role); admins moderate through it
  if coalesce(current_setting('app.post_counters', true), '') = 'on' then return new; end if;   -- like / comment / share counters
  select * into me from profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    if coalesce(me.account_type, 'student') <> 'student' then raise exception 'Only students can post'; end if;
    if (select count(*) from posts where user_id = me.id and created_at > now() - interval '1 day') >= 20 then
      raise exception 'You can post 20 times a day';
    end if;
    new.user_id := me.id; new.status := 'published'; new.hidden_reason := null;
    new.likes := 0; new.dislikes := 0; new.comments := 0; new.shares := 0; new.created_at := now(); new.edited_at := null;
    if new.college_id is null then new.college_id := me.college_id; end if;
  else
    new.user_id := old.user_id; new.kind := old.kind; new.created_at := old.created_at; new.mock_attempt_id := old.mock_attempt_id;
    new.likes := old.likes; new.dislikes := old.dislikes; new.comments := old.comments; new.shares := old.shares;
    new.result := old.result; new.hidden_reason := old.hidden_reason;
    if not (new.status = 'removed' or new.status = old.status) or old.status = 'hidden' then new.status := old.status; end if;   -- owner may only delete
    new.edited_at := now();
  end if;
  -- media: max 10 files, only from the poster's own folder
  if jsonb_typeof(new.media) <> 'array' or jsonb_array_length(new.media) > 10 then raise exception 'Up to 10 photos / videos'; end if;
  for item in select * from jsonb_array_elements(new.media) loop
    if item->>'type' not in ('image','video') or coalesce(item->>'path', '') not like me.id::text || '/%' or item->>'path' like '%..%' then
      raise exception 'Invalid attachment';
    end if;
  end loop;
  if new.lat is not null then new.lat := round(new.lat::numeric, 3); new.lng := round(new.lng::numeric, 3); end if;   -- ~100 m, never exact
  if tg_op = 'INSERT' and new.kind = 'result' then
    select * into a from mock_attempts where id = new.mock_attempt_id and user_id = me.id and status = 'submitted';
    if a.id is null then raise exception 'Share one of your own finished tests'; end if;
    select r.rank, r.total into r_rank, r_total from public.paper_rank(a.id) r;
    new.result := jsonb_build_object('exam_slug', a.exam_slug, 'title', a.title, 'score', a.score, 'max', a.max_score,
      'percent', case when a.max_score > 0 then round(100 * greatest(a.score, 0) / a.max_score, 1) else 0 end,
      'correct', a.correct, 'wrong', a.wrong, 'percentile', a.percentile, 'rank', r_rank, 'total', r_total, 'paper_id', a.paper_id);
  elsif tg_op = 'INSERT' then
    new.result := null; new.mock_attempt_id := null;
  end if;
  if new.kind = 'blog' and (new.title is null or char_length(coalesce(new.body, '')) < 50) then raise exception 'A blog needs a title and at least 50 characters'; end if;
  if new.kind <> 'result' and coalesce(char_length(trim(new.body)), 0) = 0 and jsonb_array_length(new.media) = 0 then raise exception 'Write something or add a photo'; end if;
  return new;
end $$;
create or replace trigger posts_guard before insert or update on public.posts for each row execute function public.post_guard();

create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);
alter table public.post_reactions enable row level security;
drop policy if exists "reactions own read" on public.post_reactions;
create policy "reactions own read" on public.post_reactions for select using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.post_reactions from anon, authenticated;

-- like (1), dislike (-1) or clear (0); returns new counts
create or replace function public.react_post(p_post uuid, p_value int)
returns table (likes int, dislikes int, mine int)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Please log in'; end if;
  if not exists (select 1 from posts where id = p_post and status = 'published') then raise exception 'Post not found'; end if;
  perform set_config('app.post_counters', 'on', true);
  if p_value = 0 then delete from post_reactions where post_id = p_post and user_id = auth.uid();
  else insert into post_reactions (post_id, user_id, value) values (p_post, auth.uid(), sign(p_value))
       on conflict (post_id, user_id) do update set value = excluded.value, created_at = now();
  end if;
  update posts p set likes = (select count(*) from post_reactions r where r.post_id = p_post and r.value = 1),
                     dislikes = (select count(*) from post_reactions r where r.post_id = p_post and r.value = -1)
   where p.id = p_post;
  return query select p.likes, p.dislikes, coalesce((select r.value::int from post_reactions r where r.post_id = p_post and r.user_id = auth.uid()), 0)
    from posts p where p.id = p_post;
end $$;

create or replace function public.share_post(p_post uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform set_config('app.post_counters', 'on', true);
  update posts set shares = shares + 1 where id = p_post and status = 'published' returning shares into n;
  return n;
end $$;

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid references public.post_comments(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  status     text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
drop policy if exists "comments read" on public.post_comments;
create policy "comments read" on public.post_comments for select using (status = 'published' or user_id = auth.uid() or public.is_admin());
drop policy if exists "comments create" on public.post_comments;
create policy "comments create" on public.post_comments for insert with check (user_id = auth.uid() and public.is_active_user());
drop policy if exists "comments delete own" on public.post_comments;
create policy "comments delete own" on public.post_comments for delete using (user_id = auth.uid() or public.is_admin()
  or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid()));       -- post owner can remove comments on their post
drop policy if exists "comments admin" on public.post_comments;
create policy "comments admin" on public.post_comments for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.comment_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare par post_comments;
begin
  perform set_config('app.post_counters', 'on', true);
  if tg_op = 'DELETE' then
    update posts set comments = (select count(*) from post_comments where post_id = old.post_id and status = 'published' and id <> old.id) where id = old.post_id;
    return old;
  end if;
  if auth.uid() is not null and not public.is_admin() then
    if not exists (select 1 from posts where id = new.post_id and status = 'published') then raise exception 'Post not found'; end if;
    if (select count(*) from post_comments where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'Too many comments — please slow down';
    end if;
    new.status := 'published'; new.created_at := now();
    if new.parent_id is not null then
      select * into par from post_comments where id = new.parent_id;
      if par.id is null or par.post_id <> new.post_id then raise exception 'Reply to a comment on this post'; end if;
      if par.parent_id is not null then new.parent_id := par.parent_id; end if;     -- one level of replies
    end if;
  end if;
  return new;
end $$;
create or replace trigger post_comments_guard before insert or delete on public.post_comments for each row execute function public.comment_guard();

create or replace function public.comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.post_counters', 'on', true);
  update posts set comments = (select count(*) from post_comments where post_id = new.post_id and status = 'published') where id = new.post_id;
  return new;
end $$;
create or replace trigger post_comments_count after insert or update of status on public.post_comments for each row execute function public.comment_count();

-- ---------------------------------------------------------------- 6. feed (anyone can read)
create or replace function public.feed(p_kind text default null, p_college uuid default null, p_user uuid default null,
                                       p_sort text default 'new', p_offset int default 0, p_lim int default 20, p_post uuid default null)
returns table (id uuid, kind text, title text, body text, media jsonb, place text, lat double precision, lng double precision,
               result jsonb, likes int, dislikes int, comments int, shares int, created_at timestamptz, edited_at timestamptz,
               author_id uuid, author_name text, author_username text, author_avatar text, author_verified boolean,
               college_id uuid, college_name text, college_slug text, my_reaction int, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.kind, p.title, p.body, p.media, p.place, p.lat, p.lng, p.result, p.likes, p.dislikes, p.comments, p.shares,
         p.created_at, p.edited_at, u.id, public.display_name(u), u.username,
         case when u.gender = 'female' then null else u.avatar_url end,                 -- girls: name + college only
         u.verification = 'verified', c.id, c.name, c.slug,
         coalesce((select r.value::int from post_reactions r where r.post_id = p.id and r.user_id = auth.uid()), 0),
         p.user_id = auth.uid()
  from posts p
  join profiles u on u.id = p.user_id and not u.is_blocked
  left join colleges c on c.id = p.college_id
  where p.status = 'published'
    and (p_post is null or p.id = p_post)
    and (p_kind is null or p.kind = p_kind)
    and (p_college is null or p.college_id = p_college)
    and (p_user is null or p.user_id = p_user)
  order by case when p_sort = 'score' then coalesce((p.result->>'percent')::numeric, -1) end desc nulls last,
           case when p_sort = 'top' then p.likes - p.dislikes + p.comments * 2 + p.shares * 3 end desc nulls last,
           p.created_at desc
  offset greatest(p_offset, 0) limit least(greatest(p_lim, 1), 50);
$$;

create or replace function public.post_comments_list(p_post uuid)
returns table (id uuid, parent_id uuid, body text, created_at timestamptz, author_id uuid, author_name text, author_username text,
               author_verified boolean, is_mine boolean, can_delete boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.parent_id, m.body, m.created_at, u.id, public.display_name(u), u.username, u.verification = 'verified',
         m.user_id = auth.uid(),
         m.user_id = auth.uid() or public.is_admin() or exists (select 1 from posts p where p.id = m.post_id and p.user_id = auth.uid())
  from post_comments m join profiles u on u.id = m.user_id and not u.is_blocked
  where m.post_id = p_post and m.status = 'published'
    and exists (select 1 from posts p where p.id = p_post and p.status = 'published')
  order by m.created_at
  limit 500;
$$;

-- ---------------------------------------------------------------- 7. reports for posts / comments / people
create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','user','conversation')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 3 and 1000),
  status      text not null default 'open' check (status in ('open','actioned','dismissed')),
  admin_note  text,
  created_at  timestamptz default now(),
  unique (reporter_id, target_type, target_id)
);
create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);
alter table public.content_reports enable row level security;
drop policy if exists "creports own insert" on public.content_reports;
create policy "creports own insert" on public.content_reports for insert with check (reporter_id = auth.uid() and status = 'open' and public.is_active_user());
drop policy if exists "creports own read" on public.content_reports;
create policy "creports own read" on public.content_reports for select using (reporter_id = auth.uid() or public.is_admin());
drop policy if exists "creports admin" on public.content_reports;
create policy "creports admin" on public.content_reports for all using (public.is_admin()) with check (public.is_admin());

-- 3 different students report a post or comment → hidden until an admin looks
create or replace function public.content_report_autohide()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.post_counters', 'on', true);
  if (select count(distinct reporter_id) from content_reports where target_type = new.target_type and target_id = new.target_id and status = 'open') >= 3 then
    if new.target_type = 'post' then update posts set status = 'hidden', hidden_reason = 'Reported by 3 students' where id = new.target_id and status = 'published';
    elsif new.target_type = 'comment' then update post_comments set status = 'hidden' where id = new.target_id; end if;
  end if;
  return new;
end $$;
create or replace trigger content_reports_autohide after insert on public.content_reports for each row execute function public.content_report_autohide();

-- ---------------------------------------------------------------- 8. public profile v2 (girls: name + college + tick only)
create or replace function public.public_profile_v2(p_username text)
returns table (id uuid, username text, name text, full_name text, headline text, bio text, avatar_url text, city text, country text,
               member_since timestamptz, education jsonb, mock jsonb, verified boolean, college_name text, college_slug text,
               course text, batch_year int, limited boolean, posts bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, public.display_name(p),
         case when p.gender = 'female' then null else p.full_name end,
         case when p.gender = 'female' then null else p.headline end,
         case when p.gender = 'female' then null else p.bio end,
         case when p.gender = 'female' then null else p.avatar_url end,
         case when p.gender = 'female' then null else p.city end,
         case when p.gender = 'female' then null else p.country end,
         p.created_at,
         case when p.gender = 'female' then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(e) - 'user_id' order by e.is_current desc, e.end_year desc nulls first, e.start_year desc nulls last)
              from student_education e where e.user_id = p.id), '[]'::jsonb) end,
         case when p.show_mock_scores and coalesce(p.gender, '') <> 'female' then coalesce((
           select jsonb_agg(x order by x->>'title') from (
             select jsonb_build_object('title', max(a.title), 'exam_slug', a.exam_slug, 'tests', count(*), 'best', max(a.score), 'max', max(a.max_score), 'best_percentile', max(a.percentile)) x
             from mock_attempts a where a.user_id = p.id and a.status = 'submitted' group by a.exam_slug) t), '[]'::jsonb) else null end,
         p.verification = 'verified', c.name, c.slug,
         case when p.gender = 'female' then null else p.course end,
         case when p.gender = 'female' then null else p.batch_year end,
         coalesce(p.gender, '') = 'female',
         (select count(*) from posts x where x.user_id = p.id and x.status = 'published')
  from profiles p left join colleges c on c.id = p.college_id
  where lower(p.username) = lower(p_username) and (p.public_profile or p.gender = 'female') and not p.is_blocked;
$$;

-- ---------------------------------------------------------------- 9. retention: chats older than 6 months are deleted (posts stay)
create or replace function public.purge_old_chats(p_months int default 6)
returns table (messages bigint, conversations bigint, calls bigint)
language plpgsql security definer set search_path = public as $$
declare m bigint; c bigint; k bigint;
begin
  delete from messages where created_at < now() - make_interval(months => greatest(p_months, 1));
  get diagnostics m = row_count;
  delete from calls where created_at < now() - make_interval(months => greatest(p_months, 1));
  get diagnostics k = row_count;
  delete from conversations cv where cv.last_message_at < now() - make_interval(months => greatest(p_months, 1))
    and not exists (select 1 from messages x where x.conversation_id = cv.id);
  get diagnostics c = row_count;
  update calls set status = 'missed', ended_at = now() where status = 'ringing' and created_at < now() - interval '2 minutes';
  update calls set status = 'ended', ended_at = now() where status = 'accepted' and answered_at < now() - interval '6 hours';
  delete from identity_verifications where status in ('started','expired') and created_at < now() - interval '7 days';
  return query select m, c, k;
end $$;
revoke execute on function public.purge_old_chats(int) from public, anon, authenticated;

-- ---------------------------------------------------------------- 10. storage: public "community" bucket, private "verification" bucket
do $$ begin
  if to_regclass('storage.buckets') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
      execute $q$insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
        ('community', 'community', true, 52428800, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']),
        ('verification', 'verification', false, 5242880, array['image/jpeg','image/png','image/webp'])
        on conflict (id) do nothing$q$;
    else
      insert into storage.buckets (id, name, public) values ('community', 'community', true), ('verification', 'verification', false) on conflict (id) do nothing;
    end if;
  end if;
  if to_regclass('storage.objects') is not null then
    begin execute $q$create policy "community read" on storage.objects for select using (bucket_id = 'community')$q$; exception when duplicate_object then null; end;
    begin execute $q$create policy "community own upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user())$q$; exception when duplicate_object then null; end;
    begin execute $q$create policy "community own delete" on storage.objects for delete to authenticated
      using (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text)$q$; exception when duplicate_object then null; end;
    -- "verification": no policies for users at all — only the API (service role) reads and writes selfies
  end if;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- 11. Realtime: incoming-call events + private signalling channels
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.calls'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.messages'; exception when duplicate_object then null; end;
  end if;
  if to_regclass('realtime.messages') is not null then
    begin execute $q$create policy "call signalling read" on realtime.messages for select to authenticated using (
      realtime.topic() like 'call:%' and exists (select 1 from public.calls c
        where c.id::text = split_part(realtime.topic(), ':', 2) and auth.uid() in (c.caller_id, c.callee_id) and c.status in ('ringing','accepted')))$q$; exception when duplicate_object then null; end;
    begin execute $q$create policy "call signalling send" on realtime.messages for insert to authenticated with check (
      realtime.topic() like 'call:%' and exists (select 1 from public.calls c
        where c.id::text = split_part(realtime.topic(), ':', 2) and auth.uid() in (c.caller_id, c.callee_id) and c.status in ('ringing','accepted')))$q$; exception when duplicate_object then null; end;
  end if;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- 12. notifications (outbox from 012) for requests and comments
create or replace function public.nq_chat_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    insert into notifications (user_id, kind, title, body, link, ref_id)
    values (new.user_b, 'message', 'New chat request', 'A student from your college wants to chat with you.', '/messages?tab=requests', new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    insert into notifications (user_id, kind, title, body, link, ref_id)
    values (new.requested_by, 'message', 'Chat request accepted', 'You can start chatting now.', '/messages?c=' || new.id, new.id);
  end if;
  return new;
end $$;
create or replace trigger conversations_nq_request after insert or update of status on public.conversations
  for each row execute function public.nq_chat_request();

create or replace function public.nq_post_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from posts where id = new.post_id;
  if owner is not null and owner <> new.user_id and not exists (
       select 1 from notifications where user_id = owner and kind = 'comment' and ref_id = new.post_id and created_at > now() - interval '1 hour') then
    insert into notifications (user_id, kind, title, body, link, ref_id)
    values (owner, 'comment', 'New comment on your post', left(new.body, 140), '/community/post/' || new.post_id, new.post_id);
  end if;
  return new;
end $$;
create or replace trigger post_comments_nq after insert on public.post_comments for each row execute function public.nq_post_comment();

-- ---------------------------------------------------------------- 13. grants
grant execute on function public.campus_mode(uuid), public.start_campus_chat(uuid, text), public.respond_chat_request(uuid, boolean),
  public.my_inbox(), public.campus_people(text, int), public.start_call(uuid, text), public.update_call(uuid, text),
  public.react_post(uuid, int) to authenticated;
revoke execute on function public.campus_mode(uuid), public.start_campus_chat(uuid, text), public.respond_chat_request(uuid, boolean),
  public.my_inbox(), public.campus_people(text, int), public.start_call(uuid, text), public.update_call(uuid, text),
  public.react_post(uuid, int) from public, anon;
grant execute on function public.feed(text, uuid, uuid, text, int, int, uuid), public.post_comments_list(uuid), public.share_post(uuid),
  public.public_profile_v2(text), public.display_name(profiles) to anon, authenticated;
revoke execute on function public.conversation_request_rule(), public.post_guard(), public.comment_guard(), public.comment_count(),
  public.content_report_autohide(), public.nq_chat_request(), public.nq_post_comment(), public.is_verified_female(uuid) from public, anon, authenticated;
