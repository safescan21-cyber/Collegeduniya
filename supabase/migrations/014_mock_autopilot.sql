-- =====================================================================
-- Collegeolo.com — migration 014: mock-test autopilot. Run AFTER 013.
-- The AI drafts patterns, keeps question banks full, approves questions that pass its own double-check,
-- repairs or rejects doubtful ones, handles student reports and publishes tests. Admins only spot-check.
-- =====================================================================

create table if not exists public.mock_settings (
  id                    int primary key default 1 check (id = 1),
  autopilot             boolean not null default false,   -- master switch: AI runs every exam
  auto_publish          boolean not null default true,    -- publish a test once its bank is ready
  target_per_topic      int not null default 10 check (target_per_topic between 1 and 200),
  daily_budget          int not null default 300 check (daily_budget between 0 and 20000),   -- max AI questions per day
  min_ready_ratio       numeric not null default 1 check (min_ready_ratio between 0.2 and 5), -- bank size vs one paper before publishing
  updated_at            timestamptz default now()
);
insert into public.mock_settings (id) values (1) on conflict (id) do nothing;
alter table public.mock_settings enable row level security;
drop policy if exists "ms admin" on public.mock_settings;
create policy "ms admin" on public.mock_settings for all using (public.is_admin()) with check (public.is_admin());

alter table public.mock_blueprints add column if not exists autopilot boolean not null default true;          -- per-exam opt-out
alter table public.mock_blueprints add column if not exists ai_drafted boolean not null default false;
alter table public.mock_blueprints add column if not exists pattern_checked boolean not null default false;  -- admin confirmed against official notice
alter table public.mock_blueprints add column if not exists last_autopilot_at timestamptz;

alter table public.mock_questions add column if not exists auto_approved boolean not null default false;
alter table public.mock_questions add column if not exists checked_by_admin boolean not null default false;
alter table public.mock_questions add column if not exists ai_review text;   -- what the AI decided and why (repairs, report handling)
create index if not exists mock_questions_spot_idx on public.mock_questions (auto_approved, checked_by_admin, status);

create table if not exists public.mock_autopilot_log (
  id          uuid primary key default gen_random_uuid(),
  exam_slug   text,
  action      text not null,     -- pattern_drafted, generated, repaired, rejected, report_fixed, report_dismissed, published, budget_reached, error
  detail      text,
  created_at  timestamptz default now()
);
create index if not exists mock_autopilot_log_idx on public.mock_autopilot_log (created_at desc);
alter table public.mock_autopilot_log enable row level security;
drop policy if exists "mal admin" on public.mock_autopilot_log;
create policy "mal admin" on public.mock_autopilot_log for all using (public.is_admin()) with check (public.is_admin());

-- two independent student reports pull a question out of tests until the AI (or an admin) re-checks it
create or replace function public.report_mock_question(p_question uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'Please log in'; end if;
  if not exists (select 1 from mock_attempts where user_id = me and p_question = any(question_ids) and status = 'submitted') then
    raise exception 'You can report questions from your submitted tests only';
  end if;
  insert into mock_question_reports (question_id, user_id, reason) values (p_question, me, left(trim(p_reason), 500))
  on conflict (question_id, user_id) do nothing;
  if found then
    update mock_questions set reports = reports + 1 where id = p_question returning reports into n;
    if n >= 2 then
      update mock_questions set status = 'draft', ai_review = coalesce(ai_review || ' | ', '') || 'Hidden after 2 student reports'
      where id = p_question and status = 'approved';
    end if;
  end if;
end $$;
revoke execute on function public.report_mock_question(uuid, text) from public, anon;
grant execute on function public.report_mock_question(uuid, text) to authenticated;

-- per-exam bank status for the admin dashboard
create or replace function public.mock_bank_status()
returns table (exam_slug text, short_name text, has_pattern boolean, is_published boolean, autopilot boolean, pattern_checked boolean,
               needed int, topics int, approved bigint, drafts bigint, auto_approved bigint, unchecked_auto bigint, open_reports bigint, attempts bigint, last_autopilot_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.slug, e.short_name, b.exam_slug is not null, coalesce(b.is_published, false), coalesce(b.autopilot, true), coalesce(b.pattern_checked, false),
         coalesce((select sum((s->>'questions')::int) from jsonb_array_elements(b.sections) s), 0)::int,
         coalesce((select sum(greatest(1, jsonb_array_length(coalesce(s->'topics', '[]'::jsonb)))) from jsonb_array_elements(b.sections) s), 0)::int,
         (select count(*) from mock_questions q where q.exam_slug = e.slug and q.status = 'approved'),
         (select count(*) from mock_questions q where q.exam_slug = e.slug and q.status = 'draft'),
         (select count(*) from mock_questions q where q.exam_slug = e.slug and q.status = 'approved' and q.auto_approved),
         (select count(*) from mock_questions q where q.exam_slug = e.slug and q.status = 'approved' and q.auto_approved and not q.checked_by_admin),
         (select count(*) from mock_question_reports r join mock_questions q on q.id = r.question_id where q.exam_slug = e.slug and r.status = 'open'),
         (select count(*) from mock_attempts a where a.exam_slug = e.slug and a.status = 'submitted'),
         b.last_autopilot_at
  from exams e left join mock_blueprints b on b.exam_slug = e.slug
  where e.is_published and (auth.uid() is null or public.is_admin())
  order by e.country = 'India' desc, e.short_name;
$$;
revoke execute on function public.mock_bank_status() from public, anon;
grant execute on function public.mock_bank_status() to authenticated;
