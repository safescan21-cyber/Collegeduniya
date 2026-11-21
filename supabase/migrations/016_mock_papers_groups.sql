-- =====================================================================
-- Collegeolo.com — migration 016: numbered test papers (full / sectional / topic), ranks & leaderboards,
-- time per question, AI explanations & hints, question of the day, study groups, guest tests,
-- and government / banking / defence / teaching exams. Run AFTER 015.
-- =====================================================================

-- ---------------------------------------------------------------- more exams (facts only: name, body, official site)
insert into public.exams (slug, short_name, full_name, stream, level, country, conducting_body, mode, website) values
 ('upsc-cse-prelims','UPSC CSE Prelims','Civil Services (Preliminary) Examination — General Studies','Civil services','Other','India','Union Public Service Commission (UPSC)','Pen and paper','https://upsc.gov.in'),
 ('upsc-csat','UPSC CSAT','Civil Services (Preliminary) Examination — Paper II (CSAT)','Civil services','Other','India','Union Public Service Commission (UPSC)','Pen and paper','https://upsc.gov.in'),
 ('nda','NDA','National Defence Academy & Naval Academy Examination','Defence','Other','India','Union Public Service Commission (UPSC)','Pen and paper','https://upsc.gov.in'),
 ('cds','CDS','Combined Defence Services Examination','Defence','Other','India','Union Public Service Commission (UPSC)','Pen and paper','https://upsc.gov.in'),
 ('ssc-cgl','SSC CGL','Combined Graduate Level Examination','Government jobs','Other','India','Staff Selection Commission (SSC)','Computer-based','https://ssc.gov.in'),
 ('ssc-chsl','SSC CHSL','Combined Higher Secondary Level Examination','Government jobs','Other','India','Staff Selection Commission (SSC)','Computer-based','https://ssc.gov.in'),
 ('ssc-mts','SSC MTS','Multi-Tasking (Non-Technical) Staff Examination','Government jobs','Other','India','Staff Selection Commission (SSC)','Computer-based','https://ssc.gov.in'),
 ('ssc-gd','SSC GD','Constable (General Duty) Examination','Government jobs','Other','India','Staff Selection Commission (SSC)','Computer-based','https://ssc.gov.in'),
 ('rrb-ntpc','RRB NTPC','Railway Recruitment Boards — Non-Technical Popular Categories','Government jobs','Other','India','Railway Recruitment Boards (RRBs)','Computer-based',null),
 ('rrb-group-d','RRB Group D','Railway Recruitment Boards — Level 1 (Group D)','Government jobs','Other','India','Railway Recruitment Boards (RRBs)','Computer-based',null),
 ('ibps-po','IBPS PO','Probationary Officers / Management Trainees (CRP PO/MT)','Banking','Other','India','Institute of Banking Personnel Selection (IBPS)','Computer-based','https://www.ibps.in'),
 ('ibps-clerk','IBPS Clerk','Clerical Cadre (CRP Clerks)','Banking','Other','India','Institute of Banking Personnel Selection (IBPS)','Computer-based','https://www.ibps.in'),
 ('sbi-po','SBI PO','State Bank of India — Probationary Officers','Banking','Other','India','State Bank of India','Computer-based','https://sbi.co.in/web/careers'),
 ('sbi-clerk','SBI Clerk','State Bank of India — Junior Associates (Clerk)','Banking','Other','India','State Bank of India','Computer-based','https://sbi.co.in/web/careers'),
 ('ctet','CTET','Central Teacher Eligibility Test','Teaching','Other','India','Central Board of Secondary Education (CBSE)','Computer-based','https://ctet.nic.in')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- fixed, numbered papers
create table if not exists public.mock_papers (
  id            uuid primary key default gen_random_uuid(),
  exam_slug     text not null references public.exams(slug) on update cascade on delete cascade,
  kind          text not null check (kind in ('full','sectional','topic')),
  number        int not null,
  title         text not null,
  section       text,
  topic         text,
  duration_min  int not null check (duration_min between 3 and 360),
  sections      jsonb not null,            -- marking for the sections this paper covers
  question_ids  uuid[] not null,
  is_published  boolean not null default true,
  created_by    text not null default 'autopilot',
  created_at    timestamptz default now()
);
create unique index if not exists mock_papers_num_idx on public.mock_papers (exam_slug, kind, coalesce(section, ''), coalesce(topic, ''), number);
create index if not exists mock_papers_exam_idx on public.mock_papers (exam_slug, kind, number);
alter table public.mock_papers enable row level security;
drop policy if exists "papers read" on public.mock_papers;
drop policy if exists "papers admin" on public.mock_papers;
create policy "papers read" on public.mock_papers for select using (is_published or public.is_admin());
create policy "papers admin" on public.mock_papers for all using (public.is_admin()) with check (public.is_admin());
-- question ids are not secret (answers are), but keep them out of the public list anyway
revoke select on public.mock_papers from anon, authenticated;
grant select (id, exam_slug, kind, number, title, section, topic, duration_min, sections, is_published, created_at) on public.mock_papers to anon, authenticated;

alter table public.mock_attempts add column if not exists paper_id uuid references public.mock_papers(id) on delete set null;
alter table public.mock_attempts add column if not exists time_spent jsonb not null default '{}'::jsonb;   -- {"<question id>": seconds}
alter table public.mock_attempts add column if not exists hints_used int not null default 0;
alter table public.mock_attempts add column if not exists practice boolean not null default false;      -- sectional / topic: hints allowed
alter table public.mock_attempts add column if not exists group_id uuid;
create index if not exists mock_attempts_paper_idx on public.mock_attempts (paper_id, status, score desc);

alter table public.mock_questions add column if not exists ai_explanation jsonb;   -- {concept, working, mistake} — generated once, reused
alter table public.mock_questions add column if not exists ai_hint text;

-- Build papers from approved questions that no paper of the same kind uses yet
create or replace function public.create_mock_papers(p_exam text, p_max_full int default 10, p_max_sectional int default 5, p_max_topic int default 3, p_topic_size int default 10)
returns int language plpgsql security definer set search_path = public as $$
declare b mock_blueprints; sec jsonb; total int; made int := 0; ids uuid[]; picked uuid[]; n int; num int; ok boolean; t text; secs jsonb; dur int; k int;
begin
  select * into b from mock_blueprints where exam_slug = p_exam;
  if b.exam_slug is null then return 0; end if;
  total := greatest(1, (select sum((s->>'questions')::int) from jsonb_array_elements(b.sections) s));

  -- full papers
  for k in 1..p_max_full loop
    ids := '{}'; ok := true;
    for sec in select * from jsonb_array_elements(b.sections) loop
      n := greatest((sec->>'questions')::int, 1);
      select array_agg(id order by rn, r) into picked from (
        select id, random() r, row_number() over (partition by coalesce(topic, '') order by random()) rn
        from mock_questions q where q.exam_slug = p_exam and q.section = sec->>'name' and q.status = 'approved'
          and not exists (select 1 from mock_papers mp where mp.exam_slug = p_exam and mp.kind = 'full' and q.id = any(mp.question_ids))
      ) x where rn <= n;
      if coalesce(cardinality(picked), 0) < n then ok := false; exit; end if;
      ids := ids || picked[1:n];
    end loop;
    exit when not ok;
    select coalesce(max(number), 0) + 1 into num from mock_papers where exam_slug = p_exam and kind = 'full';
    insert into mock_papers (exam_slug, kind, number, title, duration_min, sections, question_ids)
    values (p_exam, 'full', num, format('%s Mock Test %s', (select short_name from exams where slug = p_exam), num), b.duration_min, b.sections, ids);
    made := made + 1;
  end loop;

  -- sectional papers
  for sec in select * from jsonb_array_elements(b.sections) loop
    n := greatest((sec->>'questions')::int, 1);
    dur := greatest(5, round(b.duration_min::numeric * n / total)::int);
    for k in 1..p_max_sectional loop
      select array_agg(id order by rn, r) into picked from (
        select id, random() r, row_number() over (partition by coalesce(topic, '') order by random()) rn
        from mock_questions q where q.exam_slug = p_exam and q.section = sec->>'name' and q.status = 'approved'
          and not exists (select 1 from mock_papers mp where mp.exam_slug = p_exam and mp.kind = 'sectional' and mp.section = sec->>'name' and q.id = any(mp.question_ids))
      ) x where rn <= n;
      exit when coalesce(cardinality(picked), 0) < n;
      select coalesce(max(number), 0) + 1 into num from mock_papers where exam_slug = p_exam and kind = 'sectional' and section = sec->>'name';
      insert into mock_papers (exam_slug, kind, number, title, section, duration_min, sections, question_ids)
      values (p_exam, 'sectional', num, format('%s Sectional Test %s', sec->>'name', num), sec->>'name', dur, jsonb_build_array(sec), picked[1:n]);
      made := made + 1;
    end loop;
  end loop;

  -- topic tests (p_topic_size questions each)
  for sec in select * from jsonb_array_elements(b.sections) loop
    for t in select jsonb_array_elements_text(coalesce(sec->'topics', '[]'::jsonb)) loop
      for k in 1..p_max_topic loop
        select array_agg(id order by random()) into picked from (
          select id from mock_questions q where q.exam_slug = p_exam and q.section = sec->>'name' and q.topic = t and q.status = 'approved'
            and not exists (select 1 from mock_papers mp where mp.exam_slug = p_exam and mp.kind = 'topic' and mp.topic = t and mp.section = sec->>'name' and q.id = any(mp.question_ids))
          order by random() limit p_topic_size) x;
        exit when coalesce(cardinality(picked), 0) < p_topic_size;
        select coalesce(max(number), 0) + 1 into num from mock_papers where exam_slug = p_exam and kind = 'topic' and section = sec->>'name' and topic = t;
        secs := jsonb_build_array(jsonb_set(sec, '{questions}', to_jsonb(p_topic_size)));
        insert into mock_papers (exam_slug, kind, number, title, section, topic, duration_min, sections, question_ids)
        values (p_exam, 'topic', num, format('%s — Topic Test %s', t, num), sec->>'name', t,
                greatest(5, round(b.duration_min::numeric * p_topic_size / total)::int), secs, picked);
        made := made + 1;
      end loop;
    end loop;
  end loop;
  return made;
end $$;
revoke execute on function public.create_mock_papers(text, int, int, int, int) from public, anon, authenticated;

-- papers of an exam with attempt counts + my latest attempt
create or replace function public.exam_papers(p_exam text)
returns table (id uuid, kind text, number int, title text, section text, topic text, duration_min int, questions int,
               attempts bigint, my_attempt uuid, my_status text, my_score numeric, max_score numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.kind, p.number, p.title, p.section, p.topic, p.duration_min, cardinality(p.question_ids),
         (select count(*) from mock_attempts a where a.paper_id = p.id and a.status = 'submitted'),
         m.id, m.status, m.score, m.max_score
  from mock_papers p
  left join lateral (select a.id, a.status, a.score, a.max_score from mock_attempts a
                     where a.paper_id = p.id and a.user_id = auth.uid() order by a.started_at desc limit 1) m on true
  where p.exam_slug = p_exam and p.is_published
    and exists (select 1 from mock_blueprints b where b.exam_slug = p.exam_slug and b.is_published)
  order by case p.kind when 'full' then 0 when 'sectional' then 1 else 2 end, p.section nulls first, p.topic nulls first, p.number;
$$;
grant execute on function public.exam_papers(text) to anon, authenticated;

-- ---------------------------------------------------------------- study groups
create table if not exists public.study_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 3 and 80),
  code       text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);
create table if not exists public.study_group_members (
  group_id   uuid not null references public.study_groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  joined_at  timestamptz default now(),
  primary key (group_id, user_id)
);
create index if not exists study_group_members_user_idx on public.study_group_members (user_id);
create table if not exists public.study_group_papers (
  group_id    uuid not null references public.study_groups(id) on delete cascade,
  paper_id    uuid not null references public.mock_papers(id) on delete cascade,
  due_at      timestamptz,
  assigned_at timestamptz default now(),
  primary key (group_id, paper_id)
);
create index if not exists study_group_papers_paper_idx on public.study_group_papers (paper_id);
create index if not exists study_groups_owner_idx on public.study_groups (owner_id);

create or replace function public.in_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_group_members where group_id = g and user_id = auth.uid());
$$;
create or replace function public.owns_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_groups where id = g and owner_id = auth.uid());
$$;

alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.study_group_papers enable row level security;
drop policy if exists "sg read" on public.study_groups;
drop policy if exists "sg create" on public.study_groups;
drop policy if exists "sg owner" on public.study_groups;
drop policy if exists "sg owner delete" on public.study_groups;
drop policy if exists "sgm read" on public.study_group_members;
drop policy if exists "sgm leave" on public.study_group_members;
drop policy if exists "sgp read" on public.study_group_papers;
drop policy if exists "sgp owner" on public.study_group_papers;
create policy "sg read" on public.study_groups for select using (public.in_group(id) or owner_id = auth.uid() or public.is_admin());
create policy "sg create" on public.study_groups for insert with check (owner_id = auth.uid() and public.is_active_user());
create policy "sg owner" on public.study_groups for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "sg owner delete" on public.study_groups for delete using (owner_id = auth.uid() or public.is_admin());
create policy "sgm read" on public.study_group_members for select using (public.in_group(group_id) or public.is_admin());
create policy "sgm leave" on public.study_group_members for delete using (user_id = auth.uid() or public.owns_group(group_id));
create policy "sgp read" on public.study_group_papers for select using (public.in_group(group_id) or public.is_admin());
create policy "sgp owner" on public.study_group_papers for all using (public.owns_group(group_id)) with check (public.owns_group(group_id));

-- owner becomes a member automatically
create or replace function public.sg_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into study_group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner') on conflict do nothing;
  return new;
end $$;
create or replace trigger study_groups_owner after insert on public.study_groups for each row execute function public.sg_owner_member();

create or replace function public.join_study_group(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Please log in'; end if;
  select id into g from study_groups where code = upper(trim(p_code));
  if g is null then raise exception 'No group with that code'; end if;
  if (select count(*) from study_group_members where group_id = g) >= 500 then raise exception 'This group is full'; end if;
  insert into study_group_members (group_id, user_id) values (g, auth.uid()) on conflict do nothing;
  return g;
end $$;

-- members' display names (first name + initial) for group pages
create or replace function public.group_members(p_group uuid)
returns table (user_id uuid, name text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, coalesce(nullif(trim(split_part(p.full_name, ' ', 1) || ' ' || left(split_part(p.full_name, ' ', 2), 1)), ''), 'Student'), m.role, m.joined_at
  from study_group_members m join profiles p on p.id = m.user_id
  where m.group_id = p_group and public.in_group(p_group)
  order by m.role desc, m.joined_at;
$$;

-- ---------------------------------------------------------------- start a paper
create or replace function public.start_paper(p_paper uuid, p_group uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p mock_papers; aid uuid; ids uuid[];
begin
  if me is null or exists (select 1 from profiles where id = me and is_blocked) then raise exception 'Please log in to take a mock test'; end if;
  select * into p from mock_papers where id = p_paper and is_published;
  if p.id is null or not exists (select 1 from mock_blueprints where exam_slug = p.exam_slug and is_published) then raise exception 'This test is not available'; end if;
  if p_group is not null and not public.in_group(p_group) then raise exception 'You are not in this group'; end if;
  select id into aid from mock_attempts where user_id = me and paper_id = p.id and status = 'in_progress' and deadline > now() order by started_at desc limit 1;
  if aid is not null then return aid; end if;
  if (select count(*) from mock_attempts where user_id = me and started_at > now() - interval '1 day') >= 25 then
    raise exception 'Daily limit reached (25 tests a day). Try again tomorrow.';
  end if;
  -- leave out questions that were withdrawn after the paper was made
  select array_agg(x order by o) into ids from unnest(p.question_ids) with ordinality as t(x, o)
   where exists (select 1 from mock_questions q where q.id = x and q.status = 'approved');
  if coalesce(cardinality(ids), 0) = 0 then raise exception 'This test is being updated. Please try another.'; end if;
  insert into mock_attempts (user_id, exam_slug, title, duration_min, sections, question_ids, deadline, paper_id, practice, group_id)
  values (me, p.exam_slug, p.title, p.duration_min, p.sections, ids, now() + make_interval(mins => p.duration_min), p.id, p.kind <> 'full', p_group)
  returning id into aid;
  return aid;
end $$;

-- save answers + seconds spent per question
create or replace function public.save_mock_progress(p_attempt uuid, p_answers jsonb, p_time jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare a mock_attempts;
begin
  select * into a from mock_attempts where id = p_attempt and user_id = auth.uid() for update;
  if a.id is null then raise exception 'Not found'; end if;
  if a.status <> 'in_progress' or now() > a.deadline + interval '2 minutes' then return; end if;
  update mock_attempts set
    answers = coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(p_answers, '{}'::jsonb)) as e(k, v)
                        where k::uuid = any(a.question_ids) and jsonb_typeof(v) = 'number'), '{}'::jsonb),
    time_spent = case when p_time is null then time_spent else coalesce((
      select jsonb_object_agg(k, least(greatest((v #>> '{}')::numeric, 0), a.duration_min * 60)) from jsonb_each(p_time) as e(k, v)
      where k::uuid = any(a.question_ids) and jsonb_typeof(v) = 'number'), '{}'::jsonb) end
  where id = a.id;
end $$;

create or replace function public.finish_mock(p_attempt uuid, p_answers jsonb, p_time jsonb default null)
returns mock_attempts language plpgsql security definer set search_path = public as $$
begin
  perform public.save_mock_progress(p_attempt, p_answers, p_time);
  return public.submit_mock(p_attempt, null);
end $$;

-- ---------------------------------------------------------------- rank & leaderboards (first attempt of each person counts)
create or replace function public.paper_rank(p_attempt uuid)
returns table (rank bigint, total bigint, group_rank bigint, group_total bigint)
language sql stable security definer set search_path = public as $$
  with me as (select * from mock_attempts where id = p_attempt and (user_id = auth.uid() or public.is_admin()) and status = 'submitted' and paper_id is not null),
  firsts as (
    select distinct on (a.user_id) a.user_id, a.score, a.submitted_at, a.group_id
    from mock_attempts a, me where a.paper_id = me.paper_id and a.status = 'submitted'
    order by a.user_id, a.submitted_at
  ), mine as (select f.score, f.submitted_at from firsts f, me where f.user_id = me.user_id)
  select (select count(*) + 1 from firsts, mine where firsts.score > mine.score),
         (select count(*) from firsts),
         case when (select group_id from me) is null then null else
           (select count(*) + 1 from firsts f, mine where f.score > mine.score
              and exists (select 1 from study_group_members m where m.group_id = (select group_id from me) and m.user_id = f.user_id)) end,
         case when (select group_id from me) is null then null else
           (select count(*) from firsts f where exists (select 1 from study_group_members m where m.group_id = (select group_id from me) and m.user_id = f.user_id)) end
  from me;
$$;

create or replace function public.paper_leaderboard(p_paper uuid, p_group uuid default null, p_lim int default 20)
returns table (rank bigint, name text, score numeric, max_score numeric, minutes numeric, is_me boolean)
language sql stable security definer set search_path = public as $$
  with firsts as (
    select distinct on (a.user_id) a.user_id, a.score, a.max_score, a.started_at, a.submitted_at
    from mock_attempts a
    where a.paper_id = p_paper and a.status = 'submitted'
      and (p_group is null or exists (select 1 from study_group_members m where m.group_id = p_group and m.user_id = a.user_id))
    order by a.user_id, a.submitted_at
  )
  select rank() over (order by f.score desc, f.submitted_at - f.started_at),
         case when p_group is not null or pr.public_profile then
           coalesce(nullif(trim(split_part(pr.full_name, ' ', 1) || ' ' || left(split_part(pr.full_name, ' ', 2), 1)), ''), 'Student')
         else 'Aspirant' end,
         f.score, f.max_score, round(extract(epoch from (f.submitted_at - f.started_at)) / 60.0, 1), f.user_id = auth.uid()
  from firsts f join profiles pr on pr.id = f.user_id
  where (p_group is null or public.in_group(p_group))
  order by 1 limit least(greatest(p_lim, 1), 100);
$$;

-- ---------------------------------------------------------------- question of the day + site stats
create or replace function public.daily_question(p_exam text default null)
returns table (id uuid, exam_slug text, exam text, section text, topic text, stem text, options jsonb, day date)
language sql stable security definer set search_path = public as $$
  select q.id, q.exam_slug, e.short_name, q.section, q.topic, q.stem, q.options, (now() at time zone 'Asia/Kolkata')::date
  from mock_questions q join exams e on e.slug = q.exam_slug
  join mock_blueprints b on b.exam_slug = q.exam_slug and b.is_published
  where q.status = 'approved' and (p_exam is null or q.exam_slug = p_exam)
  order by md5(q.id::text || (now() at time zone 'Asia/Kolkata')::date::text)
  limit 1;
$$;
create or replace function public.check_daily(p_question uuid, p_choice int, p_exam text default null)
returns table (correct boolean, answer int, explanation text)
language sql stable security definer set search_path = public as $$
  select p_choice = q.answer, q.answer, q.explanation from mock_questions q
  where q.id = p_question and q.id = (select id from public.daily_question(p_exam));
$$;
create or replace function public.mock_stats()
returns table (tests_completed bigint, questions_answered bigint, aspirants bigint, exams bigint, papers bigint)
language sql stable security definer set search_path = public as $$
  select (select count(*) from mock_attempts where status = 'submitted'),
         (select coalesce(sum(coalesce(correct, 0) + coalesce(wrong, 0)), 0) from mock_attempts where status = 'submitted'),
         (select count(*) from profiles),
         (select count(*) from mock_blueprints where is_published),
         (select count(*) from mock_papers where is_published);
$$;

-- ---------------------------------------------------------------- AI usage caps per person per day
create table if not exists public.ai_usage (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  day      date not null default current_date,
  explains int not null default 0,
  hints    int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
drop policy if exists "ai usage own" on public.ai_usage;
create policy "ai usage own" on public.ai_usage for select using (user_id = auth.uid());

-- ---------------------------------------------------------------- guest tests: anonymous sign-ins can take tests but not post elsewhere
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not is_blocked)
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- ---------------------------------------------------------------- grants
grant execute on function public.join_study_group(text), public.group_members(uuid), public.start_paper(uuid, uuid),
  public.save_mock_progress(uuid, jsonb, jsonb), public.finish_mock(uuid, jsonb, jsonb), public.paper_rank(uuid) to authenticated;
revoke execute on function public.join_study_group(text), public.group_members(uuid), public.start_paper(uuid, uuid),
  public.save_mock_progress(uuid, jsonb, jsonb), public.finish_mock(uuid, jsonb, jsonb), public.paper_rank(uuid) from public, anon;
grant execute on function public.paper_leaderboard(uuid, uuid, int), public.daily_question(text), public.check_daily(uuid, int, text), public.mock_stats() to anon, authenticated;
revoke execute on function public.sg_owner_member(), public.in_group(uuid), public.owns_group(uuid) from public, anon;
revoke execute on function public.sg_owner_member() from authenticated;
grant execute on function public.in_group(uuid), public.owns_group(uuid) to authenticated;

-- catalogue with paper counts (mock_catalog kept for older pages)
create or replace function public.mock_catalog_v2()
returns table (exam_slug text, short_name text, full_name text, stream text, level text, country text, title text,
               duration_min int, questions int, full_tests bigint, sectional_tests bigint, topic_tests bigint, attempts bigint)
language sql stable security definer set search_path = public as $$
  select b.exam_slug, e.short_name, e.full_name, e.stream, e.level, e.country, b.title, b.duration_min,
         (select coalesce(sum((s->>'questions')::int), 0)::int from jsonb_array_elements(b.sections) s),
         (select count(*) from mock_papers p where p.exam_slug = b.exam_slug and p.is_published and p.kind = 'full'),
         (select count(*) from mock_papers p where p.exam_slug = b.exam_slug and p.is_published and p.kind = 'sectional'),
         (select count(*) from mock_papers p where p.exam_slug = b.exam_slug and p.is_published and p.kind = 'topic'),
         (select count(*) from mock_attempts a where a.exam_slug = b.exam_slug and a.status = 'submitted')
  from mock_blueprints b join exams e on e.slug = b.exam_slug
  where b.is_published and e.is_published
  order by e.country = 'India' desc, e.stream, e.short_name;
$$;
grant execute on function public.mock_catalog_v2() to anon, authenticated;
