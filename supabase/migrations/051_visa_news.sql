-- 051 · Student visa news, collected automatically (services/visaNews.js)
--   Sources: the governments' own news feeds (UK Visas and Immigration, USCIS, Canada IRCC, Irish Immigration Service)
--   and news headlines from the free GDELT index, kept only when they are about student visas for that country.
--   Only headline, source and link are stored; every item opens the original page.
--   An official item about rules / fees / work rights flags that country's visa guide "needs review" for the admin.

create table if not exists public.visa_news (
  id            uuid primary key default gen_random_uuid(),
  country_code  char(2) not null,
  title         text not null check (char_length(title) between 10 and 400),
  url           text not null check (url ~ '^https?://'),
  source        text,
  official      boolean not null default false,
  topic         text not null default 'news' check (topic in ('rules', 'fees', 'work', 'processing', 'family', 'news')),
  published_at  timestamptz not null default now(),
  fetched_at    timestamptz not null default now(),
  provider      text not null default 'gdelt',
  score         int not null default 0,
  title_key     text not null,
  is_hidden     boolean not null default false,
  unique (country_code, url)
);
create unique index if not exists visa_news_title_uq on public.visa_news (country_code, title_key);
create index if not exists visa_news_country_idx on public.visa_news (country_code, published_at desc) where not is_hidden;
create index if not exists visa_news_recent_idx on public.visa_news (published_at desc) where not is_hidden;
alter table public.visa_news enable row level security;
do $$ begin
  create policy "visa news public read" on public.visa_news for select using (not is_hidden or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "visa news admin" on public.visa_news for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
revoke insert, update, delete on public.visa_news from anon;

-- guides: flag for review when the government announces a change; editing the guide clears the flag
alter table public.visa_guides add column if not exists needs_review_since timestamptz;
alter table public.visa_guides add column if not exists review_reason text;

create or replace function public.visa_news_flag_guide()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.official and new.topic in ('rules', 'fees', 'work', 'family') and new.published_at > now() - interval '30 days' then
    update visa_guides set needs_review_since = coalesce(needs_review_since, now()), review_reason = left(new.title, 300)
     where country_code = new.country_code and (needs_review_since is null or review_reason is distinct from left(new.title, 300));
  end if;
  return new;
end $$;
create or replace trigger visa_news_flag after insert on public.visa_news for each row execute function public.visa_news_flag_guide();
revoke execute on function public.visa_news_flag_guide() from public, anon, authenticated;

create or replace function public.visa_guide_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.title, new.summary, new.body, new.processing_time, new.fee_note, new.work_rights, new.official_url)
     is distinct from (old.title, old.summary, old.body, old.processing_time, old.fee_note, old.work_rights, old.official_url) then
    new.updated_at := now(); new.needs_review_since := null; new.review_reason := null;   -- guide edited = reviewed
  end if;
  return new;
end $$;
create or replace trigger visa_guides_touch before update on public.visa_guides for each row execute function public.visa_guide_touch();
