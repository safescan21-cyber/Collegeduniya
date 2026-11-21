-- =====================================================================
-- StudyEarnstay.com — migration 018: only pages with real substance go to Google
-- Google's spam policy ("scaled content abuse") targets sites that publish many near-empty pages made from lists.
-- Every college and city page still works for visitors; a page is only *indexed* (and listed in the sitemap)
-- once it has enough of its own information. Admins can force a college page in or out.
-- Run AFTER 017. No DROP statements.
-- =====================================================================

alter table public.colleges add column if not exists seo_index   text not null default 'auto' check (seo_index in ('auto','index','noindex'));
alter table public.colleges add column if not exists seo_score   int not null default 0;
alter table public.colleges add column if not exists seo_signals text[] not null default '{}';
alter table public.cities   add column if not exists seo_ok      boolean not null default false;

create index if not exists cutoffs_college_idx            on public.cutoffs (college_id);
create index if not exists college_rankings_college_idx   on public.college_rankings (college_id);
create index if not exists college_placements_college_idx on public.college_placements (college_id);
create index if not exists colleges_city_geo_idx          on public.colleges (city_geoname_id) where city_geoname_id is not null;
create index if not exists colleges_seo_idx               on public.colleges (is_published, seo_index, seo_score);
create index if not exists cities_seo_idx                 on public.cities (seo_ok, population);

-- What a college page actually has. Wikipedia text does not count (it already exists elsewhere on the web).
--   reviews 3 · placements 2 · cutoffs 2 · courses with fees 2 · own write-up 2 · ranking 1 · fees 1 · answered Q&A 1 · PG/hostel 1 · contact 1
create or replace function public.college_quality(p_id uuid)
returns table (score int, signals text[])
language sql stable security definer set search_path = public as $$
  with c as (select * from colleges where id = p_id),
  s as (
    select array_remove(array[
      case when exists (select 1 from reviews r where r.college_id = p_id and r.status = 'approved') then 'reviews' end,
      case when exists (select 1 from college_placements x where x.college_id = p_id) then 'placements' end,
      case when exists (select 1 from cutoffs x where x.college_id = p_id) then 'cutoffs' end,
      case when (select count(*) from courses x where x.college_id = p_id and x.fees is not null) >= 2 then 'courses' end,
      case when (select coalesce(char_length(description), 0) >= 250 and description_source is distinct from 'wikipedia' from c) then 'about' end,
      case when exists (select 1 from college_rankings x where x.college_id = p_id) or (select ranking is not null from c) then 'ranking' end,
      case when (select fees_min is not null or fees_max is not null from c) then 'fees' end,
      case when exists (select 1 from questions q join answers a on a.question_id = q.id and a.status = 'approved'
                        where q.college_id = p_id and q.status = 'approved') then 'qa' end,
      case when exists (select 1 from hostels h where h.college_id = p_id and h.is_published) then 'stay' end,
      case when (select (website is not null)::int + (phone is not null)::int + (address is not null)::int >= 2 from c) then 'contact' end
    ], null) sig
  )
  select (select coalesce(sum(case x when 'reviews' then 3 when 'placements' then 2 when 'cutoffs' then 2 when 'courses' then 2
                                      when 'about' then 2 else 1 end), 0)::int from unnest(sig) x), sig
  from s;
$$;

-- page uses this for <meta name="robots">: index when admin says so, or automatically from 4 points up
create or replace function public.college_indexable(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select c.is_published and (c.seo_index = 'index' or (c.seo_index = 'auto' and (select score from public.college_quality(c.id)) >= 4))
  from colleges c where c.id = p_id;
$$;

-- daily (and after imports): store scores for the sitemap; mark cities that have something to show
create or replace function public.refresh_seo(p_college uuid default null)
returns table (colleges_indexable bigint, cities_indexable bigint)
language plpgsql security definer set search_path = public as $$
begin
  update colleges c set seo_score = q.score, seo_signals = q.signals
    from (select x.id, k.score, k.signals from colleges x cross join lateral public.college_quality(x.id) k
          where p_college is null or x.id = p_college) q
   where c.id = q.id and (c.seo_score is distinct from q.score or c.seo_signals is distinct from q.signals);
  if p_college is null then
    update cities ci set seo_ok = x.ok from (
      select g.geoname_id,
             (exists (select 1 from colleges c where c.city_geoname_id = g.geoname_id and c.is_published
                      group by c.city_geoname_id having count(*) >= 3)
              or exists (select 1 from hostels h where h.is_published and lower(h.city) = lower(g.name))
              or exists (select 1 from jobs j where j.is_published and j.status = 'open' and lower(j.city) = lower(g.name))) ok
      from cities g) x
    where ci.geoname_id = x.geoname_id and ci.seo_ok is distinct from x.ok;
  end if;
  return query select
    (select count(*) from colleges where is_published and (seo_index = 'index' or (seo_index = 'auto' and seo_score >= 4))),
    (select count(*) from cities where seo_ok);
end $$;

grant execute on function public.college_quality(uuid), public.college_indexable(uuid) to anon, authenticated;
revoke execute on function public.refresh_seo(uuid) from public, anon, authenticated;

-- sitemap: only indexable colleges, in slug order, in pages
create or replace function public.sitemap_college_count()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from colleges where is_published and (seo_index = 'index' or (seo_index = 'auto' and seo_score >= 4));
$$;
create or replace function public.sitemap_colleges(p_offset int, p_lim int)
returns table (slug text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select slug, greatest(updated_at, data_updated_at) from colleges
  where is_published and (seo_index = 'index' or (seo_index = 'auto' and seo_score >= 4))
  order by slug offset greatest(p_offset, 0) limit least(greatest(p_lim, 1), 1000);
$$;
grant execute on function public.sitemap_college_count(), public.sitemap_colleges(int, int) to anon, authenticated;

-- ---------------------------------------------------------------- contact / corrections / grievances (written by the API)
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null default 'general' check (topic in ('general','correction','grievance','privacy','partnership','press')),
  about       text check (about is null or char_length(about) <= 200),
  full_name   text not null check (char_length(full_name) between 2 and 100),
  email       text not null check (char_length(email) <= 200),
  phone       text,
  message     text not null check (char_length(message) between 10 and 5000),
  page        text,
  user_id     uuid references public.profiles(id) on delete set null,
  status      text not null default 'open' check (status in ('open','replied','resolved','spam')),
  admin_note  text,
  created_at  timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);
alter table public.contact_messages enable row level security;
drop policy if exists "contact admin" on public.contact_messages;
create policy "contact admin" on public.contact_messages for all using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.contact_messages from anon, authenticated;
