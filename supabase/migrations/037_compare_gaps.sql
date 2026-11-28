-- Collegeolo.com — migration 037: features the big college sites have that we were missing.
--   1 college_report_card() — A+…D grades per category from students' own review ratings, compared with every other
--                             college that has at least 3 reviews (the idea Niche popularised; our data, our formula)
--   2 saved_items for colleges becomes a college list: reach / match / safety, application status, deadline, note
--   3 exam_dates            — structured important dates (registration, admit card, exam, result) entered by admins
--                             from the official notice; exam_calendar() for the calendar page
--   4 queue_date_reminders() — notification 3 days and 1 day before a followed exam's date or your own application deadline

-- ---------------------------------------------------------------- 1. report card
create or replace function public.college_report_card(p_college uuid)
returns table (category text, grade text, score numeric, percentile numeric, reviews int)
language sql stable security definer set search_path = public as $$
  with per as (
    select college_id, count(*)::int as n,
           avg(rating)::numeric as overall, avg(rating_faculty)::numeric as faculty,
           avg(rating_campus)::numeric as campus, avg(rating_placement)::numeric as placement
    from reviews where status = 'approved' group by college_id having count(*) >= 3
  ), cats as (
    select college_id, n, 'Overall' as category, overall as s from per
    union all select college_id, n, 'Faculty', faculty from per where faculty is not null
    union all select college_id, n, 'Campus', campus from per where campus is not null
    union all select college_id, n, 'Placements', placement from per where placement is not null
  ), ranked as (
    select *, percent_rank() over (partition by category order by s) as pr, count(*) over (partition by category) as pool from cats
  )
  select category,
         case when pool < 5 then (case when s >= 4.5 then 'A+' when s >= 4.2 then 'A' when s >= 3.9 then 'A-' when s >= 3.6 then 'B+'
                                       when s >= 3.3 then 'B' when s >= 3.0 then 'B-' when s >= 2.6 then 'C+' when s >= 2.2 then 'C' else 'D' end)   -- too few colleges to compare: fixed scale
              when pr >= 0.95 then 'A+' when pr >= 0.85 then 'A' when pr >= 0.70 then 'A-' when pr >= 0.55 then 'B+'
              when pr >= 0.40 then 'B' when pr >= 0.25 then 'B-' when pr >= 0.15 then 'C+' when pr >= 0.07 then 'C' else 'D' end,
         round(s, 2), round((pr * 100)::numeric, 0), n
  from ranked where college_id = p_college
  order by case category when 'Overall' then 0 when 'Faculty' then 1 when 'Campus' then 2 else 3 end;
$$;

-- ---------------------------------------------------------------- 2. college list (application tracker)
alter table public.saved_items add column if not exists list_type text check (list_type is null or list_type in ('reach','match','safety'));
alter table public.saved_items add column if not exists app_status text not null default 'researching'
  check (app_status in ('researching','applying','applied','accepted','waitlisted','rejected','joined'));
alter table public.saved_items add column if not exists deadline date;
alter table public.saved_items add column if not exists note text check (note is null or char_length(note) <= 500);
alter table public.saved_items add column if not exists updated_at timestamptz default now();
create index if not exists saved_items_deadline_idx on public.saved_items (deadline) where deadline is not null;

-- ---------------------------------------------------------------- 3. exam dates
create table if not exists public.exam_dates (
  id          uuid primary key default gen_random_uuid(),
  exam_slug   text not null,
  event       text not null check (event in ('registration_start','registration_end','correction_window','admit_card','exam','answer_key','result','counselling')),
  title       text,                                   -- optional, e.g. "Session 1", "Phase 2"
  date_start  date not null,
  date_end    date,
  tentative   boolean not null default false,
  source_url  text not null,                          -- the official notice the date comes from
  is_published boolean not null default true,
  created_at  timestamptz default now(),
  check (date_end is null or date_end >= date_start)
);
create index if not exists exam_dates_when_idx on public.exam_dates (date_start) where is_published;
create index if not exists exam_dates_exam_idx on public.exam_dates (exam_slug, date_start);
alter table public.exam_dates enable row level security;
drop policy if exists "exam dates read" on public.exam_dates;
create policy "exam dates read" on public.exam_dates for select using (is_published or public.is_admin());
drop policy if exists "exam dates admin" on public.exam_dates;
create policy "exam dates admin" on public.exam_dates for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.exam_calendar(p_from date default current_date, p_days int default 120, p_exam text default null)
returns table (id uuid, exam_slug text, exam_name text, stream text, level text, event text, title text, date_start date, date_end date,
               tentative boolean, source_url text, following boolean)
language sql stable security definer set search_path = public as $$
  select d.id, d.exam_slug, e.short_name, e.stream, e.level, d.event, d.title, d.date_start, d.date_end, d.tentative, d.source_url,
         exists (select 1 from exam_follows f where f.exam_id = e.id and f.user_id = auth.uid())
  from exam_dates d join exams e on e.slug = d.exam_slug and e.is_published
  where d.is_published
    and coalesce(d.date_end, d.date_start) >= p_from
    and d.date_start <= p_from + least(greatest(p_days, 1), 400)
    and (p_exam is null or d.exam_slug = p_exam)
  order by d.date_start, e.short_name
  limit 500;
$$;

-- ---------------------------------------------------------------- 4. reminders (run hourly by the API; safe to run again)
create or replace function public.queue_date_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; k int;
begin
  -- followed exams: 3 days and 1 day before each date
  insert into notifications (user_id, kind, title, body, link, ref_id)
  select f.user_id, 'exam_date',
         e.short_name || ' — ' || replace(initcap(replace(d.event, '_', ' ')), 'Registration End', 'Last date to register')
           || case when d.date_start = current_date + 1 then ' tomorrow' else ' in 3 days' end,
         to_char(d.date_start, 'DD Mon YYYY') || coalesce(' · ' || d.title, '') || case when d.tentative then ' (tentative)' else '' end || ' — check the official notice.',
         '/exams/' || e.slug, d.id
  from exam_dates d
  join exams e on e.slug = d.exam_slug
  join exam_follows f on f.exam_id = e.id
  where d.is_published and d.date_start in (current_date + 1, current_date + 3)
    and not exists (select 1 from notifications x where x.user_id = f.user_id and x.kind = 'exam_date' and x.ref_id = d.id and x.created_at > now() - interval '30 hours');
  get diagnostics k = row_count; n := n + k;
  -- your own college-list deadlines
  insert into notifications (user_id, kind, title, body, link, ref_id)
  select s.user_id, 'deadline',
         'Application deadline ' || case when s.deadline = current_date + 1 then 'tomorrow' else 'in 3 days' end || ': ' || c.name,
         'You set ' || to_char(s.deadline, 'DD Mon YYYY') || ' as the deadline in your college list.', '/dashboard?tab=list', s.id
  from saved_items s join colleges c on c.id = s.item_id
  where s.item_type = 'college' and s.deadline in (current_date + 1, current_date + 3) and s.app_status in ('researching','applying')
    and not exists (select 1 from notifications x where x.user_id = s.user_id and x.kind = 'deadline' and x.ref_id = s.id and x.created_at > now() - interval '30 hours');
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

grant execute on function public.college_report_card(uuid), public.exam_calendar(date, int, text) to anon, authenticated;
revoke execute on function public.queue_date_reminders() from public, anon, authenticated;
