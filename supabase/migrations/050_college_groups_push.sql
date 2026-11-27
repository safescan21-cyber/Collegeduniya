-- 050 · More ways to meet people
--   1. Official college group: every student who adds a college joins "<College> students" automatically
--      (private to that college; anyone can leave; a new college moves them to the new college's group)
--   2. college_people(): students of one college for the college page ("Say hi"), same visibility rules as /people
--      college_people_count(): how many students of a college are on Collegeolo and how many are online (no names; for guests too)
--   3. push_subscriptions: phone / browser notifications for new messages and chat requests
--   4. chat-request notification no longer says "from your college" (requests now come from other colleges too)

-- ---------------------------------------------------------------- 1. official college groups
alter table public.chat_groups add column if not exists is_official boolean not null default false;
create unique index if not exists chat_groups_official_college_idx on public.chat_groups (college_id) where is_official;

create or replace function public.college_group_for(p_college uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; c colleges; label text;
begin
  if p_college is null then return null; end if;
  select id into gid from chat_groups where college_id = p_college and is_official;
  if gid is not null then return gid; end if;
  select * into c from colleges where id = p_college;
  if c.id is null then return null; end if;
  label := coalesce(nullif(trim(c.short_name), ''), trim(c.name));
  if char_length(label) > 50 then label := regexp_replace(left(label, 51), '\s+\S*$', ''); end if;   -- cut at a whole word
  label := left(label, 50) || ' students';
  if char_length(label) < 3 then label := 'College students'; end if;
  insert into chat_groups (name, about, emoji, is_public, college_id, created_by, is_official)
  values (label, 'The official group for students of ' || left(c.name, 200) || '. Be kind — reports go to the Collegeolo team.', '🎓', false, p_college, null, true)
  on conflict (college_id) where is_official do nothing
  returning id into gid;
  if gid is null then select id into gid from chat_groups where college_id = p_college and is_official; end if;
  return gid;
end $$;

create or replace function public.auto_college_group()
returns trigger language plpgsql security definer set search_path = public as $$
declare gid uuid; old_gid uuid;
begin
  if coalesce(new.account_type, 'student') <> 'student' or new.is_blocked then return new; end if;
  if tg_op = 'UPDATE' and new.college_id is not distinct from old.college_id then return new; end if;
  if tg_op = 'UPDATE' and old.college_id is not null then                        -- changed college: leave the old official group
    select id into old_gid from chat_groups where college_id = old.college_id and is_official;
    if old_gid is not null then
      delete from chat_group_members where group_id = old_gid and user_id = new.id;
      perform public.group_count_sync(old_gid);
    end if;
  end if;
  if new.college_id is null or not coalesce(new.campus_visible, true) then return new; end if;
  gid := public.college_group_for(new.college_id);
  if gid is not null and (select count(*) from chat_group_members where user_id = new.id) < 50 then
    insert into chat_group_members (group_id, user_id) values (gid, new.id) on conflict do nothing;
    perform public.group_count_sync(gid);
  end if;
  return new;
end $$;
create or replace trigger profiles_auto_college_group after insert or update of college_id on public.profiles
  for each row execute function public.auto_college_group();
revoke execute on function public.auto_college_group(), public.college_group_for(uuid) from public, anon, authenticated;

-- the official group has no member cap of 256; joining it is for students of that college only
create or replace function public.join_college_group()
returns uuid language plpgsql security definer set search_path = public as $$
declare me profiles; gid uuid;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Please log in'; end if;
  select * into me from profiles where id = auth.uid();
  if me.college_id is null then raise exception 'Add your college in your profile first'; end if;
  gid := public.college_group_for(me.college_id);
  insert into chat_group_members (group_id, user_id) values (gid, me.id) on conflict do nothing;
  perform public.group_count_sync(gid);
  return gid;
end $$;
revoke execute on function public.join_college_group() from public, anon;
grant execute on function public.join_college_group() to authenticated;

-- backfill: students who already have a college (and show themselves on campus) join their college's group
do $$
declare r record; gid uuid;
begin
  for r in select distinct college_id from profiles
           where college_id is not null and coalesce(account_type, 'student') = 'student' and not is_blocked and coalesce(campus_visible, true) loop
    gid := public.college_group_for(r.college_id);
    insert into chat_group_members (group_id, user_id)
      select gid, p.id from profiles p
      where p.college_id = r.college_id and coalesce(p.account_type, 'student') = 'student' and not p.is_blocked and coalesce(p.campus_visible, true)
        and (select count(*) from chat_group_members m where m.user_id = p.id) < 50
    on conflict do nothing;
    perform public.group_count_sync(gid);
  end loop;
end $$;

-- ---------------------------------------------------------------- 2. students of a college
create or replace function public.college_people(p_college uuid, p_lim int default 12)
returns table (id uuid, name text, username text, verified boolean, avatar_url text, course text, batch_year int, relation text,
               mode text, last_seen timestamptz, i_follow boolean, has_chat uuid)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid() and public.is_active_user())
  select o.id, public.display_name(o), o.username, o.verification = 'verified', o.avatar_url, o.course, o.batch_year,
         case when me.college_id is distinct from o.college_id then 'student' when me.batch_year is null or o.batch_year is null then 'student'
              when o.batch_year < me.batch_year then 'senior' when o.batch_year > me.batch_year then 'junior' else 'batchmate' end,
         public.people_mode(o.id),
         case when o.show_last_seen then o.last_seen_at end,
         exists (select 1 from follows f where f.follower_id = me.id and f.following_id = o.id),
         (select c.id from conversations c where least(c.user_a, c.user_b) = least(me.id, o.id) and greatest(c.user_a, c.user_b) = greatest(me.id, o.id)
            and c.status <> 'declined' order by c.last_message_at desc limit 1)
  from me join profiles o on o.college_id = p_college and o.id <> me.id
  where coalesce(o.account_type, 'student') = 'student' and coalesce(me.account_type, 'student') = 'student' and not o.is_blocked
    and not exists (select 1 from user_blocks b where (b.blocker_id = me.id and b.blocked_id = o.id) or (b.blocker_id = o.id and b.blocked_id = me.id))
    and case when me.college_id = p_college then o.campus_visible                         -- my own college: as in Messages → College
             else coalesce(o.public_profile, true) and o.chat_from = 'anyone'               -- another college: the /people rules
                  and (o.gender is distinct from 'female' or (me.gender = 'female' and me.verification = 'verified')
                       or exists (select 1 from follows f where f.follower_id = o.id and f.following_id = me.id)) end
  order by (o.show_last_seen and o.last_seen_at > now() - interval '10 minutes') desc, (o.verification = 'verified') desc, o.last_seen_at desc nulls last
  limit least(greatest(coalesce(p_lim, 12), 1), 50);
$$;

create or replace function public.college_people_count(p_college uuid)
returns table (students int, online int, group_members int)
language sql stable security definer set search_path = public as $$
  select count(*)::int,
         count(*) filter (where show_last_seen and last_seen_at > now() - interval '10 minutes')::int,
         coalesce((select member_count from chat_groups where college_id = p_college and is_official), 0)
  from profiles where college_id = p_college and coalesce(account_type, 'student') = 'student' and not is_blocked;
$$;
revoke execute on function public.college_people(uuid, int) from public, anon;
grant execute on function public.college_people(uuid, int) to authenticated;
grant execute on function public.college_people_count(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- 3. push subscriptions
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  user_agent  text check (user_agent is null or char_length(user_agent) <= 300),
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz,
  failures    int not null default 0
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push own read" on public.push_subscriptions;
create policy "push own read" on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "push own insert" on public.push_subscriptions;
create policy "push own insert" on public.push_subscriptions for insert with check (user_id = auth.uid());
drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own delete" on public.push_subscriptions for delete using (user_id = auth.uid());
revoke update on public.push_subscriptions from anon, authenticated;

-- ---------------------------------------------------------------- 4. request notification wording
create or replace function public.nq_chat_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text; same boolean;
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    select public.display_name(a), a.college_id is not distinct from b.college_id into who, same
      from profiles a, profiles b where a.id = new.requested_by and b.id = new.user_b;
    insert into notifications (user_id, kind, title, body, link, ref_id)
    values (new.user_b, 'message', 'New chat request',
            coalesce(who, 'A student') || case when same then ' from your college' else '' end || ' wants to chat with you.', '/messages?tab=requests', new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    insert into notifications (user_id, kind, title, body, link, ref_id)
    values (new.requested_by, 'message', 'Chat request accepted', 'You can start chatting now.', '/messages?c=' || new.id, new.id);
  end if;
  return new;
end $$;
