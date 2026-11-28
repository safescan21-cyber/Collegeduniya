-- Collegeolo.com — migration 034: Shots (short videos / photos), follow students, emoji reactions in chat.
--   1 posts.kind 'shot' — one video or photo with a short caption, shown in the full-screen Shots viewer
--   2 follows           — students follow students; "Following" feed; follower counts; notification on new follower
--   3 feed()            — adds p_following (only people I follow) and author_followed
--   4 messages.reactions — one emoji per person per message, set only through react_message()

-- ---------------------------------------------------------------- 1. shots
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check check (kind in ('post','blog','result','shot'));

create or replace function public.shot_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'shot' then
    if jsonb_typeof(new.media) <> 'array' or jsonb_array_length(new.media) <> 1 then raise exception 'A shot is one video or one photo'; end if;
    if new.body is not null and char_length(new.body) > 500 then raise exception 'Shot captions can be up to 500 characters'; end if;
    new.title := null;
  end if;
  return new;
end $$;
create or replace trigger posts_shot_guard before insert on public.posts for each row execute function public.shot_guard();
create index if not exists posts_shots_idx on public.posts (created_at desc) where kind = 'shot' and status = 'published';

-- ---------------------------------------------------------------- 2. follows
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id, created_at desc);
alter table public.follows enable row level security;
drop policy if exists "follows own read" on public.follows;
create policy "follows own read" on public.follows for select using (follower_id = auth.uid() or following_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.follows from anon, authenticated;

-- follow (true) / unfollow (false); returns the new state and follower count
create or replace function public.toggle_follow(p_user uuid, p_on boolean)
returns table (following boolean, followers int)
language plpgsql security definer set search_path = public as $$
declare me profiles; added int;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Please log in'; end if;
  if p_user = auth.uid() then raise exception 'You can''t follow yourself'; end if;
  if not exists (select 1 from profiles where id = p_user and not is_blocked) then raise exception 'Student not found'; end if;
  if p_on then
    if exists (select 1 from user_blocks where (blocker_id = p_user and blocked_id = auth.uid()) or (blocker_id = auth.uid() and blocked_id = p_user)) then
      raise exception 'You can''t follow this student';
    end if;
    if (select count(*) from follows where follower_id = auth.uid() and created_at > now() - interval '1 day') >= 200 then
      raise exception 'You can follow up to 200 students a day';
    end if;
    insert into follows (follower_id, following_id) values (auth.uid(), p_user) on conflict do nothing;
    get diagnostics added = row_count;
    if added > 0 and not exists (select 1 from notifications where user_id = p_user and kind = 'follow' and ref_id = auth.uid() and created_at > now() - interval '7 days') then
      select * into me from profiles where id = auth.uid();
      insert into notifications (user_id, kind, title, body, link, ref_id)
      values (p_user, 'follow', 'New follower', public.display_name(me) || ' started following you', coalesce('/u/' || me.username, '/community'), auth.uid());
    end if;
  else
    delete from follows where follower_id = auth.uid() and following_id = p_user;
  end if;
  return query select exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p_user),
                      (select count(*)::int from follows f where f.following_id = p_user);
end $$;

create or replace function public.follow_stats(p_user uuid)
returns table (followers int, following int, i_follow boolean, follows_me boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from follows where following_id = p_user),
         (select count(*)::int from follows where follower_id = p_user),
         exists (select 1 from follows where follower_id = auth.uid() and following_id = p_user),
         exists (select 1 from follows where follower_id = p_user and following_id = auth.uid()),
         coalesce(p_user = auth.uid(), false);
$$;

-- followers / following list — logged-in students only; girls' photos stay hidden as everywhere else
create or replace function public.follow_list(p_user uuid, p_which text default 'followers', p_offset int default 0)
returns table (id uuid, name text, username text, avatar text, verified boolean, college_name text, i_follow boolean)
language sql stable security definer set search_path = public as $$
  select u.id, public.display_name(u), u.username, case when u.gender = 'female' then null else u.avatar_url end,
         u.verification = 'verified', c.name,
         exists (select 1 from follows x where x.follower_id = auth.uid() and x.following_id = u.id)
  from follows f
  join profiles u on u.id = case when p_which = 'following' then f.following_id else f.follower_id end and not u.is_blocked
  left join colleges c on c.id = u.college_id
  where auth.uid() is not null
    and (case when p_which = 'following' then f.follower_id else f.following_id end) = p_user
  order by f.created_at desc
  offset greatest(p_offset, 0) limit 50;
$$;

-- ---------------------------------------------------------------- 3. feed with "Following"
drop function if exists public.feed(text, uuid, uuid, text, int, int, uuid);
create or replace function public.feed(p_kind text default null, p_college uuid default null, p_user uuid default null,
                                       p_sort text default 'new', p_offset int default 0, p_lim int default 20, p_post uuid default null,
                                       p_following boolean default false)
returns table (id uuid, kind text, title text, body text, media jsonb, place text, lat double precision, lng double precision,
               result jsonb, likes int, dislikes int, comments int, shares int, created_at timestamptz, edited_at timestamptz,
               author_id uuid, author_name text, author_username text, author_avatar text, author_verified boolean,
               college_id uuid, college_name text, college_slug text, my_reaction int, is_mine boolean, author_followed boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.kind, p.title, p.body, p.media, p.place, p.lat, p.lng, p.result, p.likes, p.dislikes, p.comments, p.shares,
         p.created_at, p.edited_at, u.id, public.display_name(u), u.username,
         case when u.gender = 'female' then null else u.avatar_url end,                 -- girls: name + college only
         u.verification = 'verified', c.id, c.name, c.slug,
         coalesce((select r.value::int from post_reactions r where r.post_id = p.id and r.user_id = auth.uid()), 0),
         p.user_id = auth.uid(),
         exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p.user_id)
  from posts p
  join profiles u on u.id = p.user_id and not u.is_blocked
  left join colleges c on c.id = p.college_id
  where p.status = 'published'
    and (p_post is null or p.id = p_post)
    and (p_kind is null or p.kind = p_kind)
    and (p_college is null or p.college_id = p_college)
    and (p_user is null or p.user_id = p_user)
    and (not coalesce(p_following, false)
         or p.user_id = auth.uid()
         or exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p.user_id))
  order by case when p_sort = 'score' then coalesce((p.result->>'percent')::numeric, -1) end desc nulls last,
           case when p_sort = 'top' then p.likes - p.dislikes + p.comments * 2 + p.shares * 3 end desc nulls last,
           case when p_sort = 'trending' then (p.likes - p.dislikes + p.comments * 2 + p.shares * 3 + 1)
                / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.5) end desc nulls last,
           p.created_at desc
  offset greatest(p_offset, 0) limit least(greatest(p_lim, 1), 50);
$$;

-- ---------------------------------------------------------------- 4. emoji reactions in chat
alter table public.messages add column if not exists reactions jsonb not null default '{}'::jsonb;   -- { "<user id>": "❤️" }

create or replace function public.message_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if not public.is_admin() then   -- recipient can only set read_at; reactions only through react_message()
      new.body := old.body; new.sender_id := old.sender_id; new.conversation_id := old.conversation_id; new.created_at := old.created_at;
      if coalesce(current_setting('app.msg_react', true), '') <> 'on' then new.reactions := old.reactions; new.read_at := coalesce(new.read_at, old.read_at);
      else new.read_at := old.read_at; end if;
    end if;
    return new;
  end if;
  -- simple flood control: 60 messages / hour / sender
  if (select count(*) from messages where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'You are sending messages too fast. Please wait a little.';
  end if;
  new.reactions := '{}'::jsonb;
  update conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;

create or replace function public.react_message(p_msg uuid, p_emoji text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m messages; out jsonb; me text := auth.uid()::text;
begin
  select * into m from messages where id = p_msg;
  if m.id is null or auth.uid() is null or not public.is_participant(m.conversation_id) then raise exception 'Message not found'; end if;
  if p_emoji is not null and p_emoji not in ('❤️','😂','😮','😢','👍','🔥','🎉','🙏') then raise exception 'Pick one of the reactions'; end if;
  perform set_config('app.msg_react', 'on', true);
  update messages set reactions = case when p_emoji is null or reactions->>me = p_emoji then reactions - me
                                       else reactions || jsonb_build_object(me, p_emoji) end
   where id = p_msg returning reactions into out;
  return out;
end $$;

-- ---------------------------------------------------------------- 5. grants
grant execute on function public.toggle_follow(uuid, boolean), public.react_message(uuid, text) to authenticated;
revoke execute on function public.toggle_follow(uuid, boolean), public.react_message(uuid, text) from public, anon;
grant execute on function public.feed(text, uuid, uuid, text, int, int, uuid, boolean), public.follow_stats(uuid), public.follow_list(uuid, text, int) to anon, authenticated;
revoke execute on function public.shot_guard() from public, anon, authenticated;
