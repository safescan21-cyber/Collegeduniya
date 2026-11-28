-- 053 · News about each college (services/collegeNews.js)
--   Headlines that name the college (its name, short name, "IIT Bombay"-style short forms, or extra names an admin adds
--   in news_terms) from the free GDELT news index. Shown on the college page ("In the news") and on /news.
--   Colleges covered: NIRF-ranked, world-ranked (top 300) and the colleges students view most — oldest-checked first.
--   Only headline, source and link are stored; each item opens the original publisher.

alter table public.colleges add column if not exists news_terms text[] not null default '{}';
alter table public.colleges add column if not exists news_checked_at timestamptz;

create table if not exists public.college_news (
  id            uuid primary key default gen_random_uuid(),
  college_id    uuid not null references public.colleges(id) on delete cascade,
  title         text not null check (char_length(title) between 10 and 400),
  url           text not null check (url ~ '^https?://'),
  source        text,
  published_at  timestamptz not null default now(),
  fetched_at    timestamptz not null default now(),
  title_key     text not null,
  is_hidden     boolean not null default false,
  unique (college_id, url)
);
create unique index if not exists college_news_title_uq on public.college_news (college_id, title_key);
create index if not exists college_news_college_idx on public.college_news (college_id, published_at desc) where not is_hidden;
create index if not exists college_news_recent_idx on public.college_news (published_at desc) where not is_hidden;
alter table public.college_news enable row level security;
do $$ begin
  create policy "college news public read" on public.college_news for select using (not is_hidden or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "college news admin" on public.college_news for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
revoke insert, update, delete on public.college_news from anon;

-- next colleges to search: NIRF-ranked, then world top 300, then most viewed (last 30 days); not checked in the last 2 days
create or replace function public.college_news_targets(p_lim int default 40)
returns table (id uuid, name text, short_name text, city text, country text, news_terms text[], tier int)
language sql stable security definer set search_path = public as $$
  with nirf as (select college_id, min(rank) r from college_rankings where source = 'NIRF' and rank is not null and college_id is not null group by college_id),
  world as (select college_id, min(rank) r from college_rankings where source = 'Leiden' and rank is not null and rank <= 300 and college_id is not null group by college_id),
  viewed as (select split_part(path, '/', 3) slug, count(distinct visitor_id) v from site_visits
             where created_at > now() - interval '30 days' and path like '/colleges/%' and path not like '/colleges/%/%' group by 1 order by 2 desc limit 300)
  select c.id, c.name, c.short_name, c.city, c.country, c.news_terms,
         case when n.r is not null then 1 when w.r is not null then 2 else 3 end
  from colleges c
  left join nirf n on n.college_id = c.id left join world w on w.college_id = c.id left join viewed v on v.slug = c.slug
  where c.is_published and (n.r is not null or w.r is not null or v.v is not null)
    and (c.news_checked_at is null or c.news_checked_at < now() - interval '2 days')
  order by c.news_checked_at nulls first, case when n.r is not null then 1 when w.r is not null then 2 else 3 end, coalesce(n.r, w.r, 100000 - v.v)
  limit least(greatest(coalesce(p_lim, 40), 1), 200);
$$;
revoke execute on function public.college_news_targets(int) from public, anon, authenticated;
