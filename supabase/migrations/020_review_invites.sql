-- =====================================================================
-- Collegeolo.com — migration 020: automatic invitations to write a REAL review
-- Reviews are never generated or bought (Consumer Protection Act 2019 / BIS IS 19000:2022 on online reviews).
-- Instead, students who say they study at a college (profile "My college", or a student/alumnus member of the
-- college) are invited once, a week after they set it, and reminded once 30 days later — in the app, and on
-- WhatsApp or email through the notifications outbox (migration 012). Nobody is asked twice for the same college.
-- Run AFTER 019. No DROP statements.
-- =====================================================================

alter table public.profiles add column if not exists college_set_at timestamptz;

create or replace function public.profile_college_set_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.college_id is not null and (tg_op = 'INSERT' or new.college_id is distinct from old.college_id) then
    new.college_set_at := now();
  end if;
  return new;
end $$;
create or replace trigger profiles_college_set_at before insert or update of college_id on public.profiles
  for each row execute function public.profile_college_set_at();

create table if not exists public.review_invites (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  college_id  uuid not null references public.colleges(id) on delete cascade,
  invited_at  timestamptz not null default now(),
  reminded_at timestamptz,
  reviewed_at timestamptz,
  primary key (user_id, college_id)
);
create index if not exists review_invites_remind_idx on public.review_invites (invited_at) where reminded_at is null and reviewed_at is null;
alter table public.review_invites enable row level security;
do $$ begin
  create policy "invites own read" on public.review_invites for select using (user_id = (select auth.uid()) or public.is_admin());
exception when duplicate_object then null; end $$;
revoke insert, update, delete on public.review_invites from anon, authenticated;

-- mark the invite done when the student writes the review
create or replace function public.review_invite_done()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update review_invites set reviewed_at = now() where user_id = new.user_id and college_id = new.college_id and reviewed_at is null;
  return new;
end $$;
revoke execute on function public.review_invite_done() from public, anon, authenticated;
create or replace trigger reviews_invite_done after insert on public.reviews for each row execute function public.review_invite_done();

create or replace function public.queue_review_invites(p_limit int default 500)
returns table (invited int, reminded int)
language plpgsql security definer set search_path = public as $$
declare n_inv int := 0; n_rem int := 0;
begin
  with cand as (
    select distinct on (x.uid, x.cid) x.uid, x.cid from (
      select p.id uid, p.college_id cid, coalesce(p.college_set_at, p.created_at) since
      from profiles p where p.college_id is not null
      union all
      select m.user_id, m.college_id, m.created_at from college_members m where m.relation in ('student','alumnus')
    ) x
    join profiles p on p.id = x.uid and not p.is_blocked and coalesce(p.account_type, 'student') = 'student'
    join colleges c on c.id = x.cid and c.is_published and not ('reviews' = any(c.hidden_sections))
    where x.since < now() - interval '7 days'
      and not exists (select 1 from reviews r where r.user_id = x.uid and r.college_id = x.cid)
      and not exists (select 1 from review_invites i where i.user_id = x.uid and i.college_id = x.cid)
    limit greatest(least(p_limit, 5000), 1)
  ), ins as (
    insert into review_invites (user_id, college_id) select uid, cid from cand on conflict do nothing returning user_id, college_id
  ), note as (
    insert into notifications (user_id, kind, title, body, link, ref_id)
    select i.user_id, 'review_invite', 'How is life at ' || c.name || '?',
           'Students choosing a college want to hear from people who study there. An honest review — good or bad — takes about 3 minutes.',
           '/colleges/' || c.slug || '#reviews', i.college_id
    from ins i join colleges c on c.id = i.college_id
    returning 1
  )
  select count(*) into n_inv from note;

  with due as (
    update review_invites ri set reminded_at = now()
    where ri.reminded_at is null and ri.reviewed_at is null and ri.invited_at < now() - interval '30 days'
      and not exists (select 1 from reviews r where r.user_id = ri.user_id and r.college_id = ri.college_id)
      and ri.ctid in (select ctid from review_invites where reminded_at is null and reviewed_at is null
                      and invited_at < now() - interval '30 days' limit greatest(least(p_limit, 5000), 1))
    returning ri.user_id, ri.college_id
  ), note as (
    insert into notifications (user_id, kind, title, body, link, ref_id)
    select d.user_id, 'review_invite', 'Still at ' || c.name || '? Help a junior decide',
           'One honest review helps hundreds of students choose. This is the last time we will ask.', '/colleges/' || c.slug || '#reviews', d.college_id
    from due d join colleges c on c.id = d.college_id
    returning 1
  )
  select count(*) into n_rem from note;
  return query select n_inv, n_rem;
end $$;
revoke execute on function public.queue_review_invites(int) from public, anon, authenticated;
