-- =====================================================================
-- Collegeolo.com — migration 021: exam news alerts by email
-- Students follow an exam; the server collects headlines about it from the free GDELT news index
-- (worldwide, open for any use with attribution — services/examNews.js), keeps only items that are really about that
-- exam (exam name + an exam word such as result / admit card / registration / answer key in the headline),
-- shows them on the exam page and emails followers one daily digest. Only headline, source and link are stored;
-- every item links to the original publisher. One-click unsubscribe in each email.
-- Run AFTER 020. No DROP statements.
-- =====================================================================

alter table public.exams add column if not exists news_terms text[] not null default '{}';  -- extra names: "JEE Mains", "JEE Main 2027"
alter table public.exams add column if not exists news_enabled boolean not null default true;
alter table public.exams add column if not exists news_fetched_at timestamptz;

create table if not exists public.exam_news (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.exams(id) on delete cascade,
  title          text not null check (char_length(title) between 10 and 400),
  url            text not null check (url ~ '^https?://'),
  source         text,                 -- publisher domain, e.g. timesofindia.indiatimes.com
  source_country text,
  language       text,
  published_at   timestamptz not null default now(),
  fetched_at     timestamptz not null default now(),
  provider       text not null default 'gdelt',
  score          int not null default 0,
  official       boolean not null default false,   -- from the exam body's own website
  title_key      text not null,                     -- normalised headline, to drop the same story from many sites
  is_hidden      boolean not null default false,
  unique (exam_id, url)
);
create unique index if not exists exam_news_title_uq on public.exam_news (exam_id, title_key);
create index if not exists exam_news_exam_idx on public.exam_news (exam_id, published_at desc) where not is_hidden;
create index if not exists exam_news_fetched_idx on public.exam_news (fetched_at) where not is_hidden;
alter table public.exam_news enable row level security;
do $$ begin
  create policy "exam news public read" on public.exam_news for select using (not is_hidden or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "exam news admin" on public.exam_news for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
revoke insert, update, delete on public.exam_news from anon;

create table if not exists public.exam_follows (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  exam_id      uuid not null references public.exams(id) on delete cascade,
  email        boolean not null default true,
  last_sent_at timestamptz,
  unsub_token  uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  primary key (user_id, exam_id)
);
create index if not exists exam_follows_exam_idx on public.exam_follows (exam_id);
create unique index if not exists exam_follows_token_uq on public.exam_follows (unsub_token);
alter table public.exam_follows enable row level security;
do $$ begin
  create policy "follows own" on public.exam_follows for all
    using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
revoke all on public.exam_follows from anon;

-- students may only change the email switch; the server sets last_sent_at
create or replace function public.exam_follow_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- service role
  if tg_op = 'INSERT' then
    new.last_sent_at := now(); new.unsub_token := gen_random_uuid(); new.created_at := now();
    if (select count(*) from exam_follows where user_id = new.user_id) >= 20 then raise exception 'You can follow up to 20 exams'; end if;
  else
    new.user_id := old.user_id; new.exam_id := old.exam_id; new.last_sent_at := old.last_sent_at;
    new.unsub_token := old.unsub_token; new.created_at := old.created_at;
  end if;
  return new;
end $$;
create or replace trigger exam_follows_guard before insert or update on public.exam_follows
  for each row execute function public.exam_follow_guard();

-- follower counts for the exam page (no user ids exposed)
create or replace function public.exam_follower_count(p_exam uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from exam_follows where exam_id = p_exam
$$;
grant execute on function public.exam_follower_count(uuid) to anon, authenticated;

-- one-click unsubscribe from an email link (no login needed)
create or replace function public.exam_news_unsubscribe(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare n text;
begin
  update exam_follows f set email = false from exams e
   where f.unsub_token = p_token and e.id = f.exam_id returning e.short_name into n;
  return n;
end $$;
grant execute on function public.exam_news_unsubscribe(uuid) to anon, authenticated;
