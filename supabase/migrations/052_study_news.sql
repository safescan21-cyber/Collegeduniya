-- 052 · Study news, collected automatically (services/studyNews.js) — admissions, scholarships, universities & colleges,
-- education policy, study abroad, future skills. Headlines from the free GDELT news index, filtered to real education news.
-- Only headline, source and link are stored; each item opens the original publisher. Shown on /news with visa news.

create table if not exists public.study_news (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in ('admissions', 'scholarships', 'colleges', 'policy', 'abroad', 'skills')),
  region        text not null default 'IN' check (region in ('IN', 'world')),
  title         text not null check (char_length(title) between 10 and 400),
  url           text not null unique check (url ~ '^https?://'),
  source        text,
  published_at  timestamptz not null default now(),
  fetched_at    timestamptz not null default now(),
  title_key     text not null unique,                 -- the same story from many sites is kept once
  is_hidden     boolean not null default false
);
create index if not exists study_news_recent_idx on public.study_news (published_at desc) where not is_hidden;
create index if not exists study_news_cat_idx on public.study_news (category, published_at desc) where not is_hidden;
alter table public.study_news enable row level security;
do $$ begin
  create policy "study news public read" on public.study_news for select using (not is_hidden or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "study news admin" on public.study_news for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
revoke insert, update, delete on public.study_news from anon;
