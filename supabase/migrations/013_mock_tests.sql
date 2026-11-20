-- =====================================================================
-- StudyEarnstay.com — migration 013: mock tests for every exam. Run AFTER 012.
--   mock_blueprints  — the test pattern per exam (sections, topics, question count, marking, duration)
--   mock_questions   — question bank (AI-generated → AI self-check → admin review), answers never sent to browsers
--   mock_attempts    — a candidate's test; scored in the database, then AI feedback + email from the API
-- =====================================================================

-- ---------------------------------------------------------------- pattern
create table if not exists public.mock_blueprints (
  exam_slug      text primary key references public.exams(slug) on update cascade on delete cascade,
  title          text not null,
  duration_min   int not null check (duration_min between 5 and 360),
  -- [{"name":"Physics","topics":["Kinematics","Optics"],"questions":25,"correct":4,"wrong":-1}]
  sections       jsonb not null check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) between 1 and 12),
  instructions   text,
  pattern_source text,                 -- official notice / information bulletin the pattern was checked against
  is_published   boolean not null default false,
  auto_publish_verified boolean not null default false,   -- publish AI questions that pass the self-check without manual review
  updated_at     timestamptz default now()
);
alter table public.mock_blueprints enable row level security;
drop policy if exists "bp read" on public.mock_blueprints;
drop policy if exists "bp admin" on public.mock_blueprints;
create policy "bp read" on public.mock_blueprints for select using (is_published or public.is_admin());
create policy "bp admin" on public.mock_blueprints for all using (public.is_admin()) with check (public.is_admin());
create or replace trigger mock_blueprints_touch before update on public.mock_blueprints for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- question bank
create table if not exists public.mock_questions (
  id           uuid primary key default gen_random_uuid(),
  exam_slug    text not null references public.exams(slug) on update cascade on delete cascade,
  section      text not null,
  topic        text,
  difficulty   text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  stem         text not null check (char_length(stem) between 10 and 4000),
  options      jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  answer       int not null check (answer >= 0),
  explanation  text,
  status       text not null default 'draft' check (status in ('draft','approved','rejected')),
  ai_check     text not null default 'unchecked' check (ai_check in ('agree','disagree','unchecked')),
  source       text not null default 'ai' check (source in ('ai','manual')),
  model        text,
  reports      int not null default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint mock_questions_answer_in_range check (answer < jsonb_array_length(options))
);
create index if not exists mock_questions_pick_idx on public.mock_questions (exam_slug, section, status);
create index if not exists mock_questions_review_idx on public.mock_questions (status, ai_check, created_at desc);
alter table public.mock_questions enable row level security;
drop policy if exists "mq admin" on public.mock_questions;
create policy "mq admin" on public.mock_questions for all using (public.is_admin()) with check (public.is_admin());
create or replace trigger mock_questions_touch before update on public.mock_questions for each row execute function public.touch_updated_at();

create table if not exists public.mock_question_reports (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.mock_questions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  reason      text not null check (char_length(reason) between 3 and 500),
  status      text not null default 'open' check (status in ('open','fixed','dismissed')),
  created_at  timestamptz default now(),
  unique (question_id, user_id)
);
create index if not exists mock_question_reports_q_idx on public.mock_question_reports (question_id);
create index if not exists mock_question_reports_user_idx on public.mock_question_reports (user_id);
alter table public.mock_question_reports enable row level security;
drop policy if exists "mqr admin" on public.mock_question_reports;
create policy "mqr admin" on public.mock_question_reports for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- attempts
create table if not exists public.mock_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  exam_slug     text not null references public.exams(slug) on update cascade on delete cascade,
  title         text not null,
  duration_min  int not null,
  sections      jsonb not null,          -- pattern snapshot (marks) at start
  question_ids  uuid[] not null,
  answers       jsonb not null default '{}'::jsonb,   -- {"<question id>": option index}
  status        text not null default 'in_progress' check (status in ('in_progress','submitted')),
  started_at    timestamptz not null default now(),
  deadline      timestamptz not null,
  submitted_at  timestamptz,
  score         numeric, max_score numeric,
  correct       int, wrong int, unanswered int,
  section_stats jsonb, topic_stats jsonb,
  percentile    numeric,
  feedback      jsonb,                   -- {summary, strengths[], weaknesses[], plan[], ai}
  emailed_at    timestamptz
);
create index if not exists mock_attempts_user_idx on public.mock_attempts (user_id, started_at desc);
create index if not exists mock_attempts_rank_idx on public.mock_attempts (exam_slug, status, score);
alter table public.mock_attempts enable row level security;
drop policy if exists "ma own read" on public.mock_attempts;
drop policy if exists "ma admin" on public.mock_attempts;
create policy "ma own read" on public.mock_attempts for select using (user_id = auth.uid());
create policy "ma admin" on public.mock_attempts for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- public counts for the catalogue
create or replace function public.mock_catalog()
returns table (exam_slug text, short_name text, full_name text, stream text, level text, country text, title text,
               duration_min int, questions int, sections int, ready_questions bigint, attempts bigint)
language sql stable security definer set search_path = public as $$
  select b.exam_slug, e.short_name, e.full_name, e.stream, e.level, e.country, b.title, b.duration_min,
         (select coalesce(sum((s->>'questions')::int), 0)::int from jsonb_array_elements(b.sections) s),
         jsonb_array_length(b.sections),
         (select count(*) from mock_questions q where q.exam_slug = b.exam_slug and q.status = 'approved'),
         (select count(*) from mock_attempts a where a.exam_slug = b.exam_slug and a.status = 'submitted')
  from mock_blueprints b join exams e on e.slug = b.exam_slug
  where b.is_published and e.is_published
  order by e.country = 'India' desc, e.short_name;
$$;
grant execute on function public.mock_catalog to anon, authenticated;

-- ---------------------------------------------------------------- start a test
create or replace function public.start_mock(p_exam text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); b mock_blueprints; sec jsonb; ids uuid[] := '{}'; picked uuid[]; aid uuid; need int;
begin
  if me is null or not public.is_active_user() then raise exception 'Please log in to take a mock test'; end if;
  select * into b from mock_blueprints where exam_slug = p_exam and is_published;
  if b.exam_slug is null then raise exception 'This mock test is not available'; end if;
  -- resume an unfinished attempt
  select id into aid from mock_attempts where user_id = me and exam_slug = p_exam and status = 'in_progress' and deadline > now() order by started_at desc limit 1;
  if aid is not null then return aid; end if;
  if (select count(*) from mock_attempts where user_id = me and started_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily limit reached (10 tests a day). Try again tomorrow.';
  end if;
  for sec in select * from jsonb_array_elements(b.sections) loop
    need := greatest(coalesce((sec->>'questions')::int, 0), 0);
    -- spread across topics: rank questions inside each topic randomly, then take round-robin
    select array_agg(id order by rn, r) into picked from (
      select id, random() r, row_number() over (partition by coalesce(topic, '') order by random()) rn
      from mock_questions where exam_slug = p_exam and section = sec->>'name' and status = 'approved'
    ) t where rn <= need;
    ids := ids || coalesce(picked[1:need], '{}');
  end loop;
  if cardinality(ids) = 0 then raise exception 'Questions for this test are still being prepared. Please check back soon.'; end if;
  insert into mock_attempts (user_id, exam_slug, title, duration_min, sections, question_ids, deadline)
  values (me, p_exam, b.title, b.duration_min, b.sections, ids, now() + make_interval(mins => b.duration_min))
  returning id into aid;
  return aid;
end $$;

-- questions of my attempt, WITHOUT answers
create or replace function public.attempt_questions(p_attempt uuid)
returns table (idx int, id uuid, section text, topic text, stem text, options jsonb)
language sql stable security definer set search_path = public as $$
  select o.idx::int, q.id, q.section, q.topic, q.stem, q.options
  from mock_attempts a
  cross join lateral unnest(a.question_ids) with ordinality as o(qid, idx)
  join mock_questions q on q.id = o.qid
  where a.id = p_attempt and a.user_id = auth.uid()
  order by o.idx;
$$;

create or replace function public.save_mock_answers(p_attempt uuid, p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare a mock_attempts;
begin
  select * into a from mock_attempts where id = p_attempt and user_id = auth.uid() for update;
  if a.id is null then raise exception 'Not found'; end if;
  if a.status <> 'in_progress' or now() > a.deadline + interval '2 minutes' then return; end if;
  update mock_attempts set answers = coalesce((
    select jsonb_object_agg(k, v) from jsonb_each(coalesce(p_answers, '{}'::jsonb)) as e(k, v)
    where k::uuid = any(a.question_ids) and jsonb_typeof(v) = 'number'
  ), '{}'::jsonb) where id = a.id;
end $$;

-- score in the database (answers never leave it before submission)
create or replace function public.submit_mock(p_attempt uuid, p_answers jsonb default null)
returns mock_attempts language plpgsql security definer set search_path = public as $$
declare a mock_attempts; me uuid := auth.uid();
begin
  select * into a from mock_attempts where id = p_attempt and (user_id = me or me is null) for update;
  if a.id is null then raise exception 'Not found'; end if;
  if a.status = 'submitted' then return a; end if;
  if p_answers is not null and now() <= a.deadline + interval '2 minutes' then
    a.answers := coalesce((select jsonb_object_agg(k, v) from jsonb_each(p_answers) as e(k, v)
                           where k::uuid = any(a.question_ids) and jsonb_typeof(v) = 'number'), '{}'::jsonb);
  end if;

  with marks as (
    select s->>'name' as section, coalesce((s->>'correct')::numeric, 1) as plus, coalesce((s->>'wrong')::numeric, 0) as minus
    from jsonb_array_elements(a.sections) s
  ), g as (
    select q.section, coalesce(q.topic, 'General') as topic,
           (a.answers->>q.id::text)::int as chosen, q.answer,
           coalesce(m.plus, 1) as plus, coalesce(m.minus, 0) as minus
    from unnest(a.question_ids) qid join mock_questions q on q.id = qid
    left join marks m on m.section = q.section
  ), r as (
    select *, case when chosen is null then 'skip' when chosen = answer then 'right' else 'wrong' end as res from g
  )
  select
    coalesce(sum(case res when 'right' then plus when 'wrong' then minus else 0 end), 0),
    coalesce(sum(plus), 0),
    count(*) filter (where res = 'right'), count(*) filter (where res = 'wrong'), count(*) filter (where res = 'skip'),
    (select jsonb_agg(jsonb_build_object('section', section, 'score', sc, 'max', mx, 'correct', c, 'wrong', w, 'skipped', sk, 'total', n) order by section)
       from (select section, sum(case res when 'right' then plus when 'wrong' then minus else 0 end) sc, sum(plus) mx,
                    count(*) filter (where res='right') c, count(*) filter (where res='wrong') w, count(*) filter (where res='skip') sk, count(*) n
             from r group by section) x),
    (select jsonb_agg(jsonb_build_object('section', section, 'topic', topic, 'correct', c, 'wrong', w, 'skipped', sk, 'total', n,
                                         'accuracy', case when c + w > 0 then round(100.0 * c / (c + w)) end) order by section, topic)
       from (select section, topic, count(*) filter (where res='right') c, count(*) filter (where res='wrong') w,
                    count(*) filter (where res='skip') sk, count(*) n from r group by section, topic) y)
  into a.score, a.max_score, a.correct, a.wrong, a.unanswered, a.section_stats, a.topic_stats
  from r;

  a.status := 'submitted';
  a.submitted_at := least(now(), a.deadline + interval '2 minutes');
  -- percentile among everyone's submitted attempts of this exam (including this one)
  select round(100.0 * count(*) filter (where x.score <= a.score) / greatest(count(*), 1) , 1)
    into a.percentile
  from (select score from mock_attempts where exam_slug = a.exam_slug and status = 'submitted' and id <> a.id
        union all select a.score) x;

  update mock_attempts set answers = a.answers, status = a.status, submitted_at = a.submitted_at, score = a.score, max_score = a.max_score,
    correct = a.correct, wrong = a.wrong, unanswered = a.unanswered, section_stats = a.section_stats, topic_stats = a.topic_stats,
    percentile = a.percentile
  where id = a.id;
  return a;
end $$;

-- after submission: every question with the right answer, my answer and the explanation
create or replace function public.attempt_review(p_attempt uuid)
returns table (idx int, id uuid, section text, topic text, stem text, options jsonb, answer int, chosen int, explanation text)
language sql stable security definer set search_path = public as $$
  select o.idx::int, q.id, q.section, q.topic, q.stem, q.options, q.answer, (a.answers->>q.id::text)::int, q.explanation
  from mock_attempts a
  cross join lateral unnest(a.question_ids) with ordinality as o(qid, idx)
  join mock_questions q on q.id = o.qid
  where a.id = p_attempt and (a.user_id = auth.uid() or public.is_admin()) and a.status = 'submitted'
  order by o.idx;
$$;

-- "this question is wrong" from the review screen (only for questions the student was given)
create or replace function public.report_mock_question(p_question uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Please log in'; end if;
  if not exists (select 1 from mock_attempts where user_id = me and p_question = any(question_ids) and status = 'submitted') then
    raise exception 'You can report questions from your submitted tests only';
  end if;
  insert into mock_question_reports (question_id, user_id, reason) values (p_question, me, left(trim(p_reason), 500))
  on conflict (question_id, user_id) do nothing;
  if found then update mock_questions set reports = reports + 1 where id = p_question; end if;
end $$;

-- expire tests left open: submit whatever was saved (run by the API every few minutes)
create or replace function public.expire_mock_attempts()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from mock_attempts where status = 'in_progress' and deadline < now() - interval '5 minutes' limit 200 loop
    perform public.submit_mock(r.id, null); n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.start_mock(text), public.attempt_questions(uuid), public.save_mock_answers(uuid, jsonb),
  public.submit_mock(uuid, jsonb), public.attempt_review(uuid), public.report_mock_question(uuid, text) from public, anon;
grant execute on function public.start_mock(text), public.attempt_questions(uuid), public.save_mock_answers(uuid, jsonb),
  public.submit_mock(uuid, jsonb), public.attempt_review(uuid), public.report_mock_question(uuid, text) to authenticated;
revoke execute on function public.expire_mock_attempts() from public, anon, authenticated;
