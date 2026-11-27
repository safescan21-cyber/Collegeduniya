-- Collegeolo.com — migration 042: course fees read from each college's OFFICIAL website (server/src/services/officialFees.js).
-- Every finding keeps the exact sentence from the official page it came from; it is shown on the site at once as a course
-- (source 'official_site') and listed for admins under Admin → Official fees → Needs review. Rejected = removed for good.

alter table public.colleges add column if not exists fees_checked_at timestamptz;
create index if not exists colleges_fees_check_idx on public.colleges (fees_checked_at nulls first) where is_published and website is not null;

create table if not exists public.fee_findings (
  id            uuid primary key default gen_random_uuid(),
  college_id    uuid not null references public.colleges(id) on delete cascade,
  course        text not null check (char_length(course) between 2 and 200),
  course_key    text not null,                                   -- normalised name, for "same course" checks
  level         text not null check (level in ('UG','PG','Diploma','PhD','Certificate')),
  fee           numeric not null check (fee > 0),
  currency      text not null check (currency ~ '^[A-Z]{3}$'),
  period        text not null check (period in ('year','semester','total','month')),
  fee_per_year  numeric,                                         -- worked out from period (+ duration for 'total')
  duration      text,
  quote         text not null,                                   -- the sentence / table row on the official page
  source_url    text not null,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  course_id     uuid references public.courses(id) on delete set null,
  found_at      timestamptz not null default now(),
  unique (college_id, course_key, level)
);
create index if not exists fee_findings_review_idx on public.fee_findings (review_status, found_at desc);
alter table public.fee_findings enable row level security;
drop policy if exists "fee findings admin" on public.fee_findings;
create policy "fee findings admin" on public.fee_findings for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.fee_findings from anon;

-- keep the college's "fees from … to …" in step with its official-site courses (only when the fees weren't entered
-- another way, e.g. by an admin or a government dataset)
create or replace function public.refresh_official_fee_range(p_college uuid)
returns void language plpgsql security definer set search_path = public as $$
declare lo numeric; hi numeric; cur text;
begin
  select min(fee_per_year), max(fee_per_year), mode() within group (order by currency) into lo, hi, cur
  from fee_findings where college_id = p_college and review_status <> 'rejected' and fee_per_year is not null;
  update colleges set fees_min = lo, fees_max = hi, currency = coalesce(cur, currency),
         facts = coalesce(facts, '{}'::jsonb) || jsonb_build_object('fees_source', 'official_site')
   where id = p_college and (fees_min is null or facts->>'fees_source' = 'official_site') and lo is not null;
end $$;
revoke execute on function public.refresh_official_fee_range(uuid) from public, anon, authenticated;
