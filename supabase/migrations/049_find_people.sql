-- 049 · Find people and chat — across colleges, safely
--   Before: chat only with students of your own college, found only inside Messages → College.
--   Now:   /people lists students to chat with (suggested, online, my college, same course, near me, following, creators),
--          a Message button on every profile, and chats with other colleges as REQUESTS the other student accepts.
--   Safety (unchanged rules + new ones):
--     • own college: same as before (campus_mode) — girls get requests unless the sender is a verified girl
--     • other colleges: always a request, except two students who follow each other → direct chat
--     • girls are not listed to, and can't be messaged by, students of other colleges — unless she follows them
--       (or the viewer is a verified girl)
--     • profiles.chat_from = 'college' → not listed outside my college and no requests from other colleges
--     • blocks, blocked accounts, private profiles (public_profile = false) and limits (20 new chats / 10 requests a day) apply

alter table public.profiles add column if not exists chat_from text not null default 'anyone' check (chat_from in ('anyone', 'college'));

-- What happens if I message this person?  direct | request | closed | login | self | not_student | blocked | unavailable
create or replace function public.people_mode(p_other uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare me profiles; o profiles; mutual boolean; she_follows boolean; safe_girl boolean;
begin
  if auth.uid() is null or not public.is_active_user() then return 'login'; end if;
  if p_other = auth.uid() then return 'self'; end if;
  select * into me from profiles where id = auth.uid();
  select * into o from profiles where id = p_other;
  if o.id is null or o.is_blocked then return 'unavailable'; end if;
  if coalesce(me.account_type, 'student') <> 'student' or coalesce(o.account_type, 'student') <> 'student' then return 'not_student'; end if;
  if exists (select 1 from user_blocks where (blocker_id = me.id and blocked_id = o.id) or (blocker_id = o.id and blocked_id = me.id)) then return 'blocked'; end if;
  if me.college_id is not null and o.college_id = me.college_id then return public.campus_mode(p_other); end if;   -- same college: old rules
  if o.chat_from = 'college' or not coalesce(o.public_profile, true) then return 'closed'; end if;
  she_follows := exists (select 1 from follows where follower_id = o.id and following_id = me.id);
  mutual := she_follows and exists (select 1 from follows where follower_id = me.id and following_id = o.id);
  safe_girl := me.gender = 'female' and me.verification = 'verified';
  if o.gender = 'female' and not safe_girl and not she_follows then return 'closed'; end if;
  if mutual and (o.gender is distinct from 'female' or safe_girl) then return 'direct'; end if;
  return 'request';
end $$;

-- Start (or reopen) a chat with anyone I may message. Returns the conversation id.
create or replace function public.start_people_chat(p_other uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mode text := public.people_mode(p_other); c conversations; cid uuid; ctx uuid;
begin
  if mode = 'login' then raise exception 'Please log in with a student account'; end if;
  if mode = 'self' then raise exception 'That is you'; end if;
  if mode = 'not_student' then raise exception 'Chat is only between students'; end if;
  if mode in ('blocked', 'unavailable') then raise exception 'You cannot message this person'; end if;
  if mode = 'closed' then raise exception 'This student only chats with their own college or with people they follow'; end if;
  select * into c from conversations
   where least(user_a, user_b) = least(me, p_other) and greatest(user_a, user_b) = greatest(me, p_other)
   order by (status = 'active') desc, last_message_at desc limit 1;
  if c.id is not null then
    if c.status = 'pending' and c.requested_by <> me then
      update conversations set status = 'active', responded_at = now() where id = c.id;          -- they asked me: replying accepts
    elsif c.status = 'declined' and c.requested_by = me then
      if c.responded_at > now() - interval '30 days' then raise exception 'This student declined your request. You can ask again after 30 days.'; end if;
      update conversations set status = case when mode = 'direct' then 'active' else 'pending' end,
             request_note = left(nullif(trim(p_note), ''), 300), responded_at = null, last_message_at = now() where id = c.id;
    elsif c.status = 'declined' then
      update conversations set status = 'active', responded_at = now() where id = c.id;
    end if;
    return c.id;
  end if;
  if (select count(*) from conversations where user_a = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily limit of new chats reached';
  end if;
  if mode = 'request' and (select count(*) from conversations where user_a = me and status = 'pending' and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You can send 10 chat requests a day';
  end if;
  select coalesce((select college_id from profiles where id = p_other), (select college_id from profiles where id = me)) into ctx;
  insert into conversations (user_a, user_b, context_type, context_id, request_note)
  values (me, p_other, 'college', ctx, left(nullif(trim(p_note), ''), 300)) returning id into cid;
  if mode = 'request' then update conversations set status = 'pending' where id = cid; end if;   -- other colleges: they accept first
  return cid;
end $$;

-- People to chat with.  p_tab: suggested | online | college | course | nearby | following | creators
create or replace function public.people_search(p_tab text default 'suggested', p_q text default null, p_offset int default 0, p_lim int default 30)
returns table (id uuid, name text, username text, verified boolean, avatar_url text, college_name text, college_slug text, same_college boolean,
               course text, batch_year int, relation text, mode text, last_seen timestamptz, i_follow boolean, follows_me boolean,
               followers int, shots int, has_chat uuid)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid() and public.is_active_user()),
  mc as (select c.* from colleges c, me where c.id = me.college_id),
  q as (select nullif(lower(regexp_replace(trim(coalesce(p_q, '')), '[%_\\@]', '', 'g')), '') t),
  cand as (
    select o.*, (me.college_id is not null and o.college_id = me.college_id) same,
           exists (select 1 from follows f where f.follower_id = me.id and f.following_id = o.id) ifol,
           exists (select 1 from follows f where f.follower_id = o.id and f.following_id = me.id) fme
    from me join profiles o on o.id <> me.id
    where coalesce(o.account_type, 'student') = 'student' and coalesce(me.account_type, 'student') = 'student' and not o.is_blocked
      and not exists (select 1 from user_blocks b where (b.blocker_id = me.id and b.blocked_id = o.id) or (b.blocker_id = o.id and b.blocked_id = me.id))),
  vis as (   -- who I may see: my college (if they show themselves on campus), or others under the rules above
    select c.* from cand c, me
    where (c.same and c.campus_visible)
       or (not c.same and coalesce(c.public_profile, true) and c.chat_from = 'anyone'
           and (c.gender is distinct from 'female' or (me.gender = 'female' and me.verification = 'verified') or c.fme))),
  rows as (
    select v.*, oc.name cname, oc.slug cslug, oc.city ccity, oc.state cstate,
           (select count(*)::int from follows f where f.following_id = v.id) nfol,
           (select count(*)::int from posts p where p.user_id = v.id and p.kind = 'shot' and p.status = 'published') nshot
    from vis v left join colleges oc on oc.id = v.college_id, q
    where q.t is null
       or lower(coalesce(v.username, '')) like '%' || q.t || '%'
       or lower(coalesce(v.course, '')) like '%' || q.t || '%'
       or lower(coalesce(oc.name, '')) like '%' || q.t || '%'
       or (coalesce(v.gender, '') <> 'female' and lower(coalesce(v.full_name, '')) like q.t || '%'))
  select r.id, (select public.display_name(p) from profiles p where p.id = r.id), r.username, r.verification = 'verified', r.avatar_url, r.cname, r.cslug, r.same,
         r.course, r.batch_year,
         case when not r.same then 'student' when me.batch_year is null or r.batch_year is null then 'student'
              when r.batch_year < me.batch_year then 'senior' when r.batch_year > me.batch_year then 'junior' else 'batchmate' end,
         public.people_mode(r.id),
         case when r.show_last_seen then r.last_seen_at end,
         r.ifol, r.fme, r.nfol, r.nshot,
         (select c.id from conversations c where least(c.user_a, c.user_b) = least(me.id, r.id) and greatest(c.user_a, c.user_b) = greatest(me.id, r.id)
            and c.status <> 'declined' order by c.last_message_at desc limit 1)
  from rows r, me
  left join mc on true
  where case coalesce(p_tab, 'suggested')
          when 'online' then r.show_last_seen and r.last_seen_at > now() - interval '10 minutes'
          when 'college' then r.same
          when 'course' then me.course is not null and r.course is not null
                             and (lower(r.course) = lower(me.course) or lower(r.course) like '%' || lower(me.course) || '%' or lower(me.course) like '%' || lower(r.course) || '%')
          when 'nearby' then mc.id is not null and (lower(r.ccity) = lower(mc.city) or r.cstate = mc.state)
          when 'following' then r.ifol or r.fme
          when 'creators' then r.nshot > 0
          else true end
  order by
    case when p_tab = 'creators' then r.nfol * 3 + r.nshot else 0 end desc,
    case when p_tab = 'nearby' then (lower(r.ccity) = lower(mc.city))::int else 0 end desc,
    ( r.same::int * 4 + r.fme::int * 4
      + (me.course is not null and lower(coalesce(r.course, '')) = lower(me.course))::int * 3
      + (mc.id is not null and r.cstate = mc.state)::int * 2
      + (r.show_last_seen and r.last_seen_at > now() - interval '10 minutes')::int * 3
      + (r.verification = 'verified')::int + least(r.nshot, 3) ) desc,
    r.last_seen_at desc nulls last
  offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_lim, 30), 1), 60);
$$;

revoke execute on function public.people_mode(uuid), public.start_people_chat(uuid, text), public.people_search(text, text, int, int) from public, anon;
grant execute on function public.people_mode(uuid), public.start_people_chat(uuid, text), public.people_search(text, text, int, int) to authenticated;
