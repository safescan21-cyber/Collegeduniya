-- Collegeolo.com — migration 041: "Active now" / "Last seen" in chats and groups.
-- Shown only to people you share a chat or a group with, and only if you allow it (on by default, like most chat apps;
-- Profile → "Show when I'm active in chats"). Uses the existing site_presence heartbeat (each open tab, about once a minute).
alter table public.profiles add column if not exists show_last_seen boolean not null default true;

-- p_users: the people on screen (chat list / open chat / group members). Returns only those the caller may see.
create or replace function public.chat_presence(p_users uuid[])
returns table (user_id uuid, online boolean, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  with allowed as (
    select u.id from profiles u
    where u.id = any(p_users[1:300]) and u.id <> auth.uid() and u.show_last_seen and not u.is_blocked
      and (select show_last_seen from profiles where id = auth.uid())          -- hide yours → you don't see others' either
      and not exists (select 1 from user_blocks b where (b.blocker_id = u.id and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = u.id))
      and (exists (select 1 from conversations c where (c.user_a = auth.uid() and c.user_b = u.id) or (c.user_b = auth.uid() and c.user_a = u.id))
           or exists (select 1 from chat_group_members m1 join chat_group_members m2 on m2.group_id = m1.group_id
                      where m1.user_id = auth.uid() and m2.user_id = u.id))
  )
  select a.id, max(p.last_seen) > now() - interval '2 minutes', max(p.last_seen)
  from allowed a join site_presence p on p.user_id = a.id
  group by a.id;
$$;
revoke execute on function public.chat_presence(uuid[]) from public, anon;
grant execute on function public.chat_presence(uuid[]) to authenticated;
