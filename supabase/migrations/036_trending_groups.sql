-- Collegeolo.com — migration 036: trending courses on the home page + group chat.
--   1 trending_courses()  — course pages most opened by different visitors in the last 7 days (falls back to most colleges)
--   2 group chat          — chat_groups, chat_group_members, group_messages; join by invite link or from "Discover"
--      Nobody can be added to a group by someone else — students only join themselves (link or public list), so the
--      chat-request safety rules for 1:1 chats can't be bypassed. Anyone can leave, report or be removed by a group admin.

-- ---------------------------------------------------------------- 1. trending courses
create index if not exists site_visits_course_idx on public.site_visits (created_at) where path like '/courses/%';

create or replace function public.trending_courses(p_lim int default 8)
returns table (slug text, name text, full_name text, level text, stream text, visitors bigint, colleges bigint)
language sql stable security definer set search_path = public as $$
  with v as (
    select split_part(path, '/', 3) as slug, count(distinct visitor_id) as visitors
    from site_visits
    where created_at > now() - interval '7 days' and path like '/courses/%'
      and (user_id is null or user_id not in (select id from profiles where role in ('admin','super_admin')))
    group by 1
  ), cnt as (select c.slug, c.colleges from course_catalog_counts() c)
  select k.slug, k.name, k.full_name, k.level, k.stream, coalesce(v.visitors, 0), coalesce(cnt.colleges, 0)
  from course_catalog k left join v on v.slug = k.slug left join cnt on cnt.slug = k.slug
  where k.is_published
  order by coalesce(v.visitors, 0) desc, coalesce(cnt.colleges, 0) desc, k.sort
  limit least(greatest(p_lim, 1), 24);
$$;

-- ---------------------------------------------------------------- 2. group chat
create table if not exists public.chat_groups (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 3 and 60),
  about           text check (about is null or char_length(about) <= 300),
  emoji           text not null default '💬' check (char_length(emoji) <= 8),
  is_public       boolean not null default false,          -- public = listed in Discover; private = invite link only
  college_id      uuid references public.colleges(id) on delete set null,
  invite_code     text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  created_by      uuid references public.profiles(id) on delete set null,
  member_count    int not null default 0,
  last_message_at timestamptz not null default now(),
  status          text not null default 'active' check (status in ('active','hidden')),
  created_at      timestamptz not null default now()
);
create index if not exists chat_groups_public_idx on public.chat_groups (is_public, status, member_count desc);

create table if not exists public.chat_group_members (
  group_id     uuid not null references public.chat_groups(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','admin','member')),
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists chat_group_members_user_idx on public.chat_group_members (user_id);

create table if not exists public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.chat_groups(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  reactions  jsonb not null default '{}'::jsonb,
  status     text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now()
);
create index if not exists group_messages_group_idx on public.group_messages (group_id, created_at);

create or replace function public.group_role(gid uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from chat_group_members where group_id = gid and user_id = auth.uid();
$$;

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.group_messages enable row level security;
drop policy if exists "groups read" on public.chat_groups;
create policy "groups read" on public.chat_groups for select using ((status = 'active' and (is_public or public.group_role(id) is not null)) or public.is_admin());
drop policy if exists "group members read" on public.chat_group_members;
create policy "group members read" on public.chat_group_members for select using (public.group_role(group_id) is not null or public.is_admin());
drop policy if exists "group messages read" on public.group_messages;
create policy "group messages read" on public.group_messages for select using ((status = 'published' and public.group_role(group_id) is not null) or public.is_admin());
drop policy if exists "group messages send" on public.group_messages;
create policy "group messages send" on public.group_messages for insert with check (sender_id = auth.uid() and public.group_role(group_id) is not null and public.is_active_user());
drop policy if exists "group messages delete" on public.group_messages;
create policy "group messages delete" on public.group_messages for delete using (sender_id = auth.uid() or public.group_role(group_id) in ('owner','admin') or public.is_admin());
revoke insert, update, delete on public.chat_groups, public.chat_group_members from anon, authenticated;
revoke update on public.group_messages from anon, authenticated;

create or replace function public.group_message_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if (select count(*) from group_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 15 then
      raise exception 'You are sending messages too fast. Please wait a little.';
    end if;
    if (select status from chat_groups where id = new.group_id) <> 'active' then raise exception 'This group is closed'; end if;
  end if;
  new.status := 'published'; new.reactions := '{}'::jsonb; new.created_at := now();
  update chat_groups set last_message_at = now() where id = new.group_id;
  update chat_group_members set last_read_at = now() where group_id = new.group_id and user_id = new.sender_id;
  return new;
end $$;
create or replace trigger group_messages_guard before insert on public.group_messages for each row execute function public.group_message_guard();

create or replace function public.group_count_sync(gid uuid)
returns void language sql security definer set search_path = public as $$
  update chat_groups set member_count = (select count(*) from chat_group_members where group_id = gid) where id = gid;
$$;

-- create: you become the owner. p_my_college ties it to your college (shown first to students of that college)
create or replace function public.create_group(p_name text, p_about text default null, p_emoji text default '💬', p_public boolean default false, p_my_college boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare me profiles; gid uuid;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Please log in'; end if;
  if (select count(*) from chat_groups where created_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'You can create 5 groups a day'; end if;
  if (select count(*) from chat_group_members where user_id = auth.uid()) >= 50 then raise exception 'You can be in up to 50 groups'; end if;
  select * into me from profiles where id = auth.uid();
  insert into chat_groups (name, about, emoji, is_public, college_id, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_about, '')), ''), coalesce(nullif(trim(p_emoji), ''), '💬'), coalesce(p_public, false),
          case when p_my_college then me.college_id end, auth.uid())
  returning id into gid;
  insert into chat_group_members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  perform public.group_count_sync(gid);
  return gid;
end $$;

-- join yourself: by invite code (any group) or by id (public groups only)
create or replace function public.join_group(p_group uuid default null, p_code text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare g chat_groups;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Please log in'; end if;
  if p_code is not null then select * into g from chat_groups where invite_code = trim(p_code) and status = 'active';
  else select * into g from chat_groups where id = p_group and status = 'active' and is_public; end if;
  if g.id is null then raise exception 'This invite link is not valid any more'; end if;
  if exists (select 1 from chat_group_members where group_id = g.id and user_id = auth.uid()) then return g.id; end if;
  if g.member_count >= 256 then raise exception 'This group is full (256 members)'; end if;
  if (select count(*) from chat_group_members where user_id = auth.uid()) >= 50 then raise exception 'You can be in up to 50 groups'; end if;
  insert into chat_group_members (group_id, user_id) values (g.id, auth.uid());
  perform public.group_count_sync(g.id);
  return g.id;
end $$;

-- leave; if the owner leaves, the longest-standing admin (or member) becomes owner; an empty group closes
create or replace function public.leave_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare was text; heir uuid;
begin
  delete from chat_group_members where group_id = p_group and user_id = auth.uid() returning role into was;
  if was = 'owner' then
    select user_id into heir from chat_group_members where group_id = p_group order by (role = 'admin') desc, joined_at limit 1;
    if heir is null then update chat_groups set status = 'hidden' where id = p_group;
    else update chat_group_members set role = 'owner' where group_id = p_group and user_id = heir; end if;
  end if;
  perform public.group_count_sync(p_group);
end $$;

-- owner/admin: make admin, make member, remove. Owner can't be removed; only the owner can make or remove admins.
create or replace function public.manage_group_member(p_group uuid, p_user uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare mine text := public.group_role(p_group); theirs text;
begin
  select role into theirs from chat_group_members where group_id = p_group and user_id = p_user;
  if mine not in ('owner','admin') or theirs is null or theirs = 'owner' or p_user = auth.uid() then raise exception 'Not allowed'; end if;
  if theirs = 'admin' and mine <> 'owner' then raise exception 'Only the owner can change admins'; end if;
  if p_action = 'remove' then delete from chat_group_members where group_id = p_group and user_id = p_user;
  elsif p_action in ('admin','member') then
    if mine <> 'owner' then raise exception 'Only the owner can change admins'; end if;
    update chat_group_members set role = p_action where group_id = p_group and user_id = p_user;
  else raise exception 'Unknown action'; end if;
  perform public.group_count_sync(p_group);
end $$;

-- owner/admin: edit name, about, emoji, public/private; p_new_link = true makes a new invite link (old one stops working)
create or replace function public.update_group(p_group uuid, p_name text, p_about text, p_emoji text, p_public boolean, p_new_link boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.group_role(p_group) not in ('owner','admin') then raise exception 'Only group admins can edit the group'; end if;
  update chat_groups set name = trim(p_name), about = nullif(trim(coalesce(p_about, '')), ''), emoji = coalesce(nullif(trim(p_emoji), ''), '💬'),
         is_public = coalesce(p_public, is_public),
         invite_code = case when p_new_link then substr(md5(random()::text || clock_timestamp()::text), 1, 10) else invite_code end
   where id = p_group;
end $$;

create or replace function public.my_groups()
returns table (id uuid, name text, emoji text, is_public boolean, member_count int, my_role text, last_message text, last_sender text,
               last_message_at timestamptz, unread int)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.emoji, g.is_public, g.member_count, m.role,
         lm.body, lm.sender, g.last_message_at,
         (select count(*)::int from group_messages x where x.group_id = g.id and x.status = 'published' and x.created_at > m.last_read_at and x.sender_id <> auth.uid())
  from chat_group_members m
  join chat_groups g on g.id = m.group_id and g.status = 'active'
  left join lateral (select x.body, public.display_name(u) as sender from group_messages x join profiles u on u.id = x.sender_id
                     where x.group_id = g.id and x.status = 'published' order by x.created_at desc limit 1) lm on true
  where m.user_id = auth.uid()
  order by g.last_message_at desc;
$$;

-- group details + members (members only). The invite code is shown to everyone inside so friends can be invited.
create or replace function public.group_info(p_group uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.group_role(g.id) is null and not public.is_admin() then null else jsonb_build_object(
    'id', g.id, 'name', g.name, 'about', g.about, 'emoji', g.emoji, 'is_public', g.is_public, 'member_count', g.member_count,
    'invite_code', g.invite_code, 'my_role', public.group_role(g.id), 'college_name', c.name, 'created_at', g.created_at,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'name', public.display_name(u), 'username', u.username,
                 'avatar', case when u.gender = 'female' then null else u.avatar_url end, 'verified', u.verification = 'verified', 'role', m.role)
                 order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at)
               from chat_group_members m join profiles u on u.id = m.user_id where m.group_id = g.id), '[]'::jsonb)) end
  from chat_groups g left join colleges c on c.id = g.college_id
  where g.id = p_group and g.status = 'active';
$$;

-- what an invite link shows before joining (name, emoji, size only)
create or replace function public.group_preview(p_code text)
returns table (id uuid, name text, about text, emoji text, member_count int, is_member boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.about, g.emoji, g.member_count, public.group_role(g.id) is not null
  from chat_groups g where g.invite_code = trim(p_code) and g.status = 'active';
$$;

create or replace function public.discover_groups(p_q text default null, p_lim int default 30)
returns table (id uuid, name text, about text, emoji text, member_count int, college_name text, my_college boolean, is_member boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.about, g.emoji, g.member_count, c.name,
         g.college_id is not null and g.college_id = (select college_id from profiles where id = auth.uid()),
         public.group_role(g.id) is not null
  from chat_groups g left join colleges c on c.id = g.college_id
  where g.status = 'active' and g.is_public
    and (p_q is null or g.name ilike '%' || p_q || '%' or g.about ilike '%' || p_q || '%' or c.name ilike '%' || p_q || '%')
  order by (g.college_id is not null and g.college_id = (select college_id from profiles where id = auth.uid())) desc,
           g.member_count desc, g.last_message_at desc
  limit least(greatest(p_lim, 1), 60);
$$;

create or replace function public.group_messages_list(p_group uuid, p_before timestamptz default null)
returns table (id uuid, sender_id uuid, sender_name text, sender_username text, sender_verified boolean, body text, reactions jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select x.id, x.sender_id, public.display_name(u), u.username, u.verification = 'verified', x.body, x.reactions, x.created_at
    from group_messages x join profiles u on u.id = x.sender_id
    where x.group_id = p_group and x.status = 'published' and public.group_role(p_group) is not null
      and (p_before is null or x.created_at < p_before)
    order by x.created_at desc limit 200) t
  order by created_at;
$$;

create or replace function public.mark_group_read(p_group uuid)
returns void language sql security definer set search_path = public as $$
  update chat_group_members set last_read_at = now() where group_id = p_group and user_id = auth.uid();
$$;

create or replace function public.react_group_message(p_msg uuid, p_emoji text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m group_messages; out jsonb; me text := auth.uid()::text;
begin
  select * into m from group_messages where id = p_msg and status = 'published';
  if m.id is null or public.group_role(m.group_id) is null then raise exception 'Message not found'; end if;
  if p_emoji is not null and p_emoji not in ('❤️','😂','😮','😢','👍','🔥','🎉','🙏') then raise exception 'Pick one of the reactions'; end if;
  update group_messages set reactions = case when p_emoji is null or reactions->>me = p_emoji then reactions - me
                                             else reactions || jsonb_build_object(me, p_emoji) end
   where id = p_msg returning reactions into out;
  return out;
end $$;

-- reports: groups and group messages can be reported like posts; 3 reports hide a message
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('post','comment','user','conversation','group','group_message'));
create or replace function public.content_report_autohide()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.post_counters', 'on', true);
  if (select count(distinct reporter_id) from content_reports where target_type = new.target_type and target_id = new.target_id and status = 'open') >= 3 then
    if new.target_type = 'post' then update posts set status = 'hidden', hidden_reason = 'Reported by 3 students' where id = new.target_id and status = 'published';
    elsif new.target_type = 'comment' then update post_comments set status = 'hidden' where id = new.target_id;
    elsif new.target_type = 'group_message' then update group_messages set status = 'hidden' where id = new.target_id; end if;
  end if;
  return new;
end $$;

-- live updates
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.group_messages'; exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------------------------------------------------------------- grants
grant execute on function public.trending_courses(int) to anon, authenticated;
grant execute on function public.create_group(text, text, text, boolean, boolean), public.join_group(uuid, text), public.leave_group(uuid),
  public.manage_group_member(uuid, uuid, text), public.update_group(uuid, text, text, text, boolean, boolean), public.my_groups(),
  public.group_info(uuid), public.group_preview(text), public.discover_groups(text, int), public.group_messages_list(uuid, timestamptz),
  public.mark_group_read(uuid), public.react_group_message(uuid, text) to authenticated;
revoke execute on function public.create_group(text, text, text, boolean, boolean), public.join_group(uuid, text), public.leave_group(uuid),
  public.manage_group_member(uuid, uuid, text), public.update_group(uuid, text, text, text, boolean, boolean), public.my_groups(),
  public.group_info(uuid), public.group_preview(text), public.discover_groups(text, int), public.group_messages_list(uuid, timestamptz),
  public.mark_group_read(uuid), public.react_group_message(uuid, text) from public, anon;
revoke execute on function public.group_message_guard(), public.group_count_sync(uuid) from public, anon, authenticated;
