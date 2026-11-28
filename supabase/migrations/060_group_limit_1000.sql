-- 060 · Groups can have up to 1,000 members (was 256). Same functions as 036 / 059, only the cap changes.
create or replace function public.join_group(p_group uuid default null, p_code text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare g chat_groups;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Please log in'; end if;
  if p_code is not null then select * into g from chat_groups where invite_code = trim(p_code) and status = 'active';
  else select * into g from chat_groups where id = p_group and status = 'active' and is_public; end if;
  if g.id is null then raise exception 'This invite link is not valid any more'; end if;
  if exists (select 1 from chat_group_members where group_id = g.id and user_id = auth.uid()) then return g.id; end if;
  if g.member_count >= 1000 then raise exception 'This group is full (1,000 members)'; end if;
  if (select count(*) from chat_group_members where user_id = auth.uid()) >= 50 then raise exception 'You can be in up to 50 groups'; end if;
  insert into chat_group_members (group_id, user_id) values (g.id, auth.uid());
  perform public.group_count_sync(g.id);
  return g.id;
end $$;


create or replace function public.join_intake_group(p_college uuid, p_intake text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; c colleges; label text; g chat_groups;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Please log in'; end if;
  if not public.valid_intake(p_intake) then raise exception 'Choose an intake like "Fall %"', extract(year from now())::int + 1; end if;
  select * into c from colleges where id = p_college and is_published;
  if c.id is null then raise exception 'University not found'; end if;
  select id into gid from chat_groups where college_id = p_college and intake = p_intake;
  if gid is null then
    label := coalesce(nullif(trim(c.short_name), ''), trim(c.name));
    if char_length(label) > 42 then label := regexp_replace(left(label, 43), '\s+\S*$', ''); end if;
    label := left(label, 42) || ' · ' || p_intake;
    insert into chat_groups (name, about, emoji, is_public, college_id, created_by, intake)
    values (label, 'Students joining ' || left(c.name, 180) || ' in ' || p_intake || ' — visas, housing, flights, roommates. Be kind; reports go to the Collegeolo team.',
            '✈️', true, p_college, null, p_intake)
    on conflict (college_id, intake) where intake is not null do nothing
    returning id into gid;
    if gid is null then select id into gid from chat_groups where college_id = p_college and intake = p_intake; end if;
  end if;
  select * into g from chat_groups where id = gid;
  if g.status <> 'active' then raise exception 'This group is closed'; end if;
  if exists (select 1 from chat_group_members where group_id = gid and user_id = auth.uid()) then return gid; end if;
  if g.member_count >= 1000 then raise exception 'This group is full (1,000 members)'; end if;
  if (select count(*) from chat_group_members where user_id = auth.uid()) >= 50 then raise exception 'You can be in up to 50 groups'; end if;
  insert into chat_group_members (group_id, user_id) values (gid, auth.uid());
  perform public.group_count_sync(gid);
  return gid;
end $$;
