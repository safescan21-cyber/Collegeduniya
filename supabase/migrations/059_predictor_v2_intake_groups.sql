-- 059 · Competitor gaps
--   1. predict_colleges_v2: gender-aware (female-only seats shown only to girls), round-aware (latest round by default,
--      or a chosen round), and returns last year's closing rank too so students see the trend.
--   2. Intake groups: a public group per foreign university and intake ("TU Munich · Winter 2027") for students
--      going to the same place at the same time.

-- ---------------------------------------------------------------- 1. predictor v2
create index if not exists cutoffs_v2_idx on public.cutoffs (exam_slug, category, year desc);

create or replace function public.round_order(r text)
returns int language sql immutable as $$
  select case when r is null or r ~* '^final' then 1000
              when r ~ '\d+' then (substring(r from '\d+'))::int
              else 0 end
$$;

create or replace function public.predict_colleges_v2(p_exam text, p_rank int, p_category text default 'General',
  p_quota text default null, p_state text default null, p_gender text default null, p_round text default null, p_country text default null)
returns table (college_id uuid, slug text, name text, city text, state text, country text, cover_url text,
               course text, category text, quota text, home_state text, gender text, round text, year int,
               opening_rank int, closing_rank int, prev_closing int, chance text)
language sql stable security definer set search_path = public as $$
  with base as (
    select c.* from public.cutoffs c
    where c.exam_slug = p_exam and c.category = p_category
      and (p_quota is null or c.quota = p_quota)
      and (c.quota is distinct from 'Home State' or (p_state is not null and lower(coalesce(c.home_state, '')) = lower(p_state)))
      and (c.quota is distinct from 'Other State' or p_state is null or lower(coalesce(c.home_state, '')) <> lower(p_state))
      -- female-only (supernumerary) seats are for girls; everyone competes for gender-neutral seats
      and (coalesce(c.gender, 'Gender-Neutral') !~* 'female' or lower(coalesce(p_gender, '')) = 'female')
      and (p_round is null or c.round = p_round)
  ),
  latest as (
    select distinct on (b.college_id, b.course, b.quota, b.gender) b.*
    from base b
    order by b.college_id, b.course, b.quota, b.gender, b.year desc, public.round_order(b.round) desc
  )
  select co.id, co.slug, co.name, co.city, co.state, co.country,
         case when 'photos' = any(co.hidden_fields) then null else co.cover_url end,
         l.course, l.category, l.quota, l.home_state, coalesce(l.gender, 'Gender-Neutral'), l.round, l.year, l.opening_rank, l.closing_rank,
         (select p.closing_rank from base p
           where p.college_id = l.college_id and p.course = l.course and p.quota is not distinct from l.quota
             and p.gender is not distinct from l.gender and p.year = l.year - 1
           order by public.round_order(p.round) desc limit 1),
         case when p_rank <= l.closing_rank * 0.85 then 'High'
              when p_rank <= l.closing_rank then 'Medium'
              else 'Low' end
  from latest l
  join public.colleges co on co.id = l.college_id and co.is_published and not ('cutoffs' = any(co.hidden_sections))
  where p_rank <= l.closing_rank * 1.15
    and (p_country is null or co.country = p_country)
  order by case when p_rank <= l.closing_rank * 0.85 then 0 when p_rank <= l.closing_rank then 1 else 2 end,
           l.closing_rank asc
  limit 400;
$$;
grant execute on function public.predict_colleges_v2(text, int, text, text, text, text, text, text) to anon, authenticated;

-- rounds and genders available for an exam (for the predictor's dropdowns)
create or replace function public.cutoff_options(p_exam text)
returns table (latest_year int, rounds text[], genders text[], sources text[])
language sql stable security definer set search_path = public as $$
  with y as (select max(year) as yr from cutoffs where exam_slug = p_exam)
  select y.yr,
         (select array_agg(r order by public.round_order(r)) from (select distinct round as r from cutoffs where exam_slug = p_exam and year = y.yr and round is not null) a),
         (select array_agg(distinct coalesce(gender, 'Gender-Neutral')) from cutoffs where exam_slug = p_exam and year = y.yr),
         (select array_agg(distinct source) from cutoffs where exam_slug = p_exam and year = y.yr and source is not null)
  from y
$$;
grant execute on function public.cutoff_options(text) to anon, authenticated;

-- ---------------------------------------------------------------- 2. intake groups
alter table public.chat_groups add column if not exists intake text;
create unique index if not exists chat_groups_intake_idx on public.chat_groups (college_id, intake) where intake is not null;

create or replace function public.valid_intake(p text)
returns boolean language sql stable as $$
  select p ~ '^(Spring|Summer|Fall|Winter) 20\d\d$'
     and substring(p from '\d{4}')::int between extract(year from now())::int and extract(year from now())::int + 3
$$;

-- groups for one university (any visitor can see them; no member names)
create or replace function public.intake_groups(p_college uuid)
returns table (id uuid, intake text, name text, member_count int, last_message_at timestamptz, joined boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.intake, g.name, g.member_count, g.last_message_at,
         exists (select 1 from chat_group_members m where m.group_id = g.id and m.user_id = auth.uid())
  from chat_groups g
  where g.college_id = p_college and g.intake is not null and g.status = 'active'
    and substring(g.intake from '\d{4}')::int >= extract(year from now())::int
  order by substring(g.intake from '\d{4}')::int, case split_part(g.intake, ' ', 1) when 'Spring' then 1 when 'Summer' then 2 when 'Fall' then 3 else 4 end
$$;
grant execute on function public.intake_groups(uuid) to anon, authenticated;

-- join (creating it if it's the first student) the group for a university + intake
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
  if g.member_count >= 256 then raise exception 'This group is full (256 members)'; end if;
  if (select count(*) from chat_group_members where user_id = auth.uid()) >= 50 then raise exception 'You can be in up to 50 groups'; end if;
  insert into chat_group_members (group_id, user_id) values (gid, auth.uid());
  perform public.group_count_sync(gid);
  return gid;
end $$;
revoke execute on function public.join_intake_group(uuid, text) from public, anon;
grant execute on function public.join_intake_group(uuid, text) to authenticated;
