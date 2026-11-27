-- Collegeolo.com — migration 038: exam dates collected automatically from each exam's official website.
-- The API reads the official site (and the schedule/notice pages and PDFs it links to), AI pulls out the dates, and every
-- date is kept only if the exact sentence it came from is found on that official page. Verified dates go live at once;
-- admins see them under "Needs review" and approve or reject. A rejected date is never added again.

alter table public.exams add column if not exists dates_checked_at timestamptz;

alter table public.exam_dates add column if not exists origin text not null default 'manual' check (origin in ('manual','auto'));
alter table public.exam_dates add column if not exists review_status text not null default 'approved' check (review_status in ('pending','approved','rejected'));
alter table public.exam_dates add column if not exists quote text;            -- the sentence on the official page the date was read from
alter table public.exam_dates add column if not exists found_at timestamptz;
update public.exam_dates set title = '' where title is null;
alter table public.exam_dates alter column title set default '';
alter table public.exam_dates alter column title set not null;
create unique index if not exists exam_dates_unique_idx on public.exam_dates (exam_slug, event, date_start, title);
create index if not exists exam_dates_review_idx on public.exam_dates (review_status) where review_status = 'pending';

-- a rejected date stays hidden even if something tries to publish it again
create or replace function public.exam_dates_guard()
returns trigger language plpgsql as $$
begin
  new.title := coalesce(trim(new.title), '');
  if new.review_status = 'rejected' then new.is_published := false; end if;
  return new;
end $$;
create or replace trigger exam_dates_guard before insert or update on public.exam_dates for each row execute function public.exam_dates_guard();
revoke execute on function public.exam_dates_guard() from public, anon, authenticated;
