-- 057 · Scholarships: official news + "track & remind" for students
--   1. study_news can hold official notices (National Scholarship Portal, UGC, AICTE) with their own date or "seen on"
--   2. scholarship_tracker: a student keeps the scholarships they plan to apply for, with status (planning → applied → won / not selected)
--   3. reminders 7 days and 1 day before the deadline for scholarships still "planning" (hourly job, idempotent)

alter table public.study_news add column if not exists official boolean not null default false;
alter table public.study_news add column if not exists date_known boolean not null default true;
alter table public.study_news add column if not exists provider text not null default 'gdelt';

create table if not exists public.scholarship_tracker (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  status         text not null default 'planning' check (status in ('planning', 'applied', 'won', 'not_selected')),
  note           text check (note is null or char_length(note) <= 500),
  reminded_7     boolean not null default false,
  reminded_1     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, scholarship_id)
);
alter table public.scholarship_tracker enable row level security;
do $$ begin
  create policy "tracker own" on public.scholarship_tracker for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
revoke all on public.scholarship_tracker from anon;

create or replace function public.my_scholarships()
returns table (scholarship_id uuid, slug text, name text, provider text, deadline date, amount numeric, currency text, amount_note text,
               official_url text, status text, note text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.slug, s.name, s.provider, s.deadline, s.amount, s.currency, s.amount_note, s.official_url, t.status, t.note, t.updated_at
  from scholarship_tracker t join scholarships s on s.id = t.scholarship_id
  where t.user_id = auth.uid()
  order by (t.status = 'planning') desc, s.deadline nulls last, t.updated_at desc;
$$;
revoke execute on function public.my_scholarships() from public, anon;
grant execute on function public.my_scholarships() to authenticated;

create or replace function public.queue_scholarship_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in
    select t.user_id, t.scholarship_id, s.name, s.slug, s.deadline, (s.deadline - current_date) as days
    from scholarship_tracker t join scholarships s on s.id = t.scholarship_id
    where t.status = 'planning' and s.deadline is not null and s.deadline >= current_date
      and ((s.deadline - current_date between 2 and 7 and not t.reminded_7) or (s.deadline - current_date <= 1 and not t.reminded_1))
  loop
    insert into notifications (user_id, kind, title, body, link, ref_id)
    values (r.user_id, 'deadline', case when r.days <= 1 then 'Scholarship deadline tomorrow' else 'Scholarship deadline in ' || r.days || ' days' end,
            left(r.name, 150) || ' closes on ' || to_char(r.deadline, 'DD Mon YYYY') || '. Apply on the official website and mark it as applied.',
            '/scholarships/' || r.slug, r.scholarship_id);
    update scholarship_tracker set reminded_7 = true, reminded_1 = (r.days <= 1) or reminded_1
     where user_id = r.user_id and scholarship_id = r.scholarship_id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.queue_scholarship_reminders() from public, anon, authenticated;
