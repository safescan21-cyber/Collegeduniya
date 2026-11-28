-- =====================================================================
-- Collegeolo — migration 022: rank predictor pages + real results shared by students
-- The predictor itself already exists (010: rank_bands + predict_rank for marks → rank, exam_stats for percentile → rank),
-- filled only from official/published figures. This adds:
--   • rank_reports: after the result, students share their marks/percentile and actual rank. Checked automatically,
--     then approved by an admin. Approved reports are shown as "real results" and give a second estimate
--     ("students with similar marks got ranks …") when no official band exists. Nothing is invented.
--   • rank_predictor_exams(): which exams have data, for the /rank-predictor pages and sitemap.
-- Run AFTER 021. No DROP statements.
-- =====================================================================

create table if not exists public.rank_reports (
  id          uuid primary key default gen_random_uuid(),
  exam_slug   text not null references public.exams(slug) on update cascade on delete cascade,
  year        int not null check (year between 2000 and 2100),
  session     text not null default 'All',
  category    text not null default 'General',
  marks       numeric,
  percentile  numeric check (percentile is null or percentile between 0 and 100),
  rank        int not null check (rank > 0),           -- CRL / all-India rank as printed on the scorecard
  user_id     uuid references public.profiles(id) on delete set null,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  flag        text,                                   -- set automatically when the numbers look unusual
  created_at  timestamptz not null default now(),
  check (marks is not null or percentile is not null)
);
create unique index if not exists rank_reports_one on public.rank_reports (exam_slug, year, session, user_id);
create index if not exists rank_reports_exam_idx on public.rank_reports (exam_slug, year desc, marks) where status = 'approved';
alter table public.rank_reports enable row level security;
do $$ begin create policy "rank reports read" on public.rank_reports for select using (status = 'approved' or user_id = (select auth.uid()) or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin create policy "rank reports admin" on public.rank_reports for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
revoke insert, update, delete on public.rank_reports from anon;

create or replace function public.share_rank_result(p_exam text, p_year int, p_session text, p_category text,
                                                    p_marks numeric, p_percentile numeric, p_rank int)
returns text language plpgsql security definer set search_path = public as $$
declare f text; n int; mid int; est record;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if not exists (select 1 from exams where slug = p_exam and is_published) then raise exception 'Exam not found'; end if;
  if p_rank is null or p_rank < 1 then raise exception 'Enter your rank'; end if;
  if p_marks is null and p_percentile is null then raise exception 'Enter your marks or percentile'; end if;
  if p_year < extract(year from now())::int - 3 or p_year > extract(year from now())::int then raise exception 'Choose the year of your result'; end if;
  if p_percentile is not null and (p_percentile < 0 or p_percentile > 100) then raise exception 'Percentile must be between 0 and 100'; end if;
  if p_marks is not null and abs(p_marks) > 10000 then raise exception 'Marks look wrong'; end if;
  if (select count(*) from rank_reports where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'Too many results today'; end if;
  -- sanity checks against official numbers (only flags; an admin decides)
  select total_candidates into n from exam_stats where exam_slug = p_exam and year = p_year order by (session = coalesce(nullif(p_session, ''), 'All')) desc limit 1;
  if n is not null and p_rank > n * 1.05 then f := format('rank is above the %s candidates who appeared', n); end if;
  if f is null and p_percentile is not null and n is not null and coalesce(p_category, 'General') in ('General', 'All') then
    mid := round((100 - p_percentile) * n / 100) + 1;
    if abs(p_rank - mid) > greatest(mid * 0.25, 500) then f := format('percentile suggests a rank near %s', mid); end if;
  end if;
  if f is null and p_marks is not null then
    select * into est from predict_rank(p_exam, p_marks, coalesce(p_category, 'All')) limit 1;
    if est.rank_estimate is not null and est.year = p_year and (p_rank > est.rank_high * 2 or p_rank * 2 < est.rank_low) then
      f := format('official band says %s–%s', est.rank_low, est.rank_high);
    end if;
  end if;
  insert into rank_reports (exam_slug, year, session, category, marks, percentile, rank, user_id, flag)
  values (p_exam, p_year, coalesce(nullif(p_session, ''), 'All'), coalesce(nullif(p_category, ''), 'General'), p_marks, p_percentile, p_rank, auth.uid(), f)
  on conflict (exam_slug, year, session, user_id)
  do update set category = excluded.category, marks = excluded.marks, percentile = excluded.percentile, rank = excluded.rank,
                status = 'pending', flag = excluded.flag, created_at = now();
  return coalesce(f, 'ok');
end $$;
revoke execute on function public.share_rank_result(text, int, text, text, numeric, numeric, int) from public, anon;
grant execute on function public.share_rank_result(text, int, text, text, numeric, numeric, int) to authenticated;

-- "students with similar marks got …": approved reports within ±p_window marks, latest year with at least 3 of them
create or replace function public.rank_from_reports(p_exam text, p_marks numeric, p_window numeric default 5, p_category text default 'General')
returns table (year int, reports int, rank_low int, rank_median int, rank_high int, marks_low numeric, marks_high numeric)
language sql stable security definer set search_path = public as $$
  with r as (
    select * from rank_reports where exam_slug = p_exam and status = 'approved' and marks is not null
      and category = coalesce(p_category, 'General') and marks between p_marks - p_window and p_marks + p_window
  ), y as (select r.year from r group by r.year having count(*) >= 3 order by r.year desc limit 1)
  select r.year, count(*)::int, min(r.rank), (percentile_cont(0.5) within group (order by r.rank))::int, max(r.rank), min(r.marks), max(r.marks)
  from r join y on y.year = r.year group by r.year
$$;
grant execute on function public.rank_from_reports(text, numeric, numeric, text) to anon, authenticated;

create or replace function public.rank_predictor_exams()
returns table (slug text, short_name text, full_name text, stream text, bands int, stats int, reports int, latest_year int)
language sql stable security definer set search_path = public as $$
  select e.slug, e.short_name, e.full_name, e.stream,
    (select count(*)::int from rank_bands b where b.exam_slug = e.slug),
    (select count(*)::int from exam_stats s where s.exam_slug = e.slug),
    (select count(*)::int from rank_reports r where r.exam_slug = e.slug and r.status = 'approved'),
    greatest((select max(year) from rank_bands b where b.exam_slug = e.slug), (select max(year) from exam_stats s where s.exam_slug = e.slug),
             (select max(year) from rank_reports r where r.exam_slug = e.slug and r.status = 'approved'))
  from exams e where e.is_published and e.level <> 'Abroad'
  order by e.short_name
$$;
grant execute on function public.rank_predictor_exams() to anon, authenticated;
