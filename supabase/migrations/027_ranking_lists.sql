-- =====================================================================
-- Collegeolo — migration 027: full official ranking lists (NIRF India Rankings 2022–2025 …)
-- Every listed institution is kept, matched to a college when we can (college_id), so the public
-- /rankings page can show the whole list; matched rows also go into college_rankings (college pages).
-- Run AFTER 026. No DROP statements.
-- =====================================================================
create table if not exists public.ranking_lists (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'NIRF',
  year        int not null,
  category    text not null,
  rank        int,
  rank_band   text,
  name        text not null,
  city        text,
  state       text,
  college_id  uuid references public.colleges(id) on delete set null,
  source_url  text,
  created_at  timestamptz default now(),
  unique (source, year, category, name, city)
);
create index if not exists ranking_lists_view_idx on public.ranking_lists (source, year, category, rank);
create index if not exists ranking_lists_college_idx on public.ranking_lists (college_id);
alter table public.ranking_lists enable row level security;
drop policy if exists "ranking lists public read" on public.ranking_lists;
create policy "ranking lists public read" on public.ranking_lists for select using (true);
drop policy if exists "ranking lists admin write" on public.ranking_lists;
create policy "ranking lists admin write" on public.ranking_lists for all using (public.is_admin()) with check (public.is_admin());
grant select on public.ranking_lists to anon, authenticated;

-- which years / categories exist (for the page's filters)
create or replace function public.ranking_list_index(p_source text default 'NIRF')
returns table (year int, category text, n bigint)
language sql stable security definer set search_path = public as $$
  select year, category, count(*) from ranking_lists where source = coalesce(p_source, 'NIRF') group by year, category order by year desc, category;
$$;
grant execute on function public.ranking_list_index(text) to anon, authenticated;
