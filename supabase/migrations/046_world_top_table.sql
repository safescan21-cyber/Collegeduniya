-- 046 · Home page: "Top universities in the world" under the NIRF table, same columns
--   world_top_table(country, lim) → latest world research rank (CWTS Leiden), the place inside its own country,
--   and the same facts as the ranking pages (logo, courses, lowest fee in its currency + rupees, placement or U.S. earnings).
--   world_top_countries() → countries with the most world-ranked universities on Collegeolo (the tabs).

create or replace function public.world_top_table(p_country text default null, p_lim int default 10)
returns table (id uuid, slug text, name text, city text, state text, country text, logo_url text,
               world_rank int, country_rank int, rank_year int, courses int,
               fee_min numeric, fee_currency text, fee_min_inr numeric,
               placement numeric, placement_kind text, placement_currency text, median_earnings numeric, top_courses jsonb)
language sql stable security definer set search_path = public as $$
  with y as (select max(year) y from college_rankings where source = 'Leiden' and rank is not null),
  lw as (select distinct on (r.college_id) r.college_id, r.rank, r.year
         from college_rankings r, y where r.source = 'Leiden' and r.rank is not null and r.year = y.y order by r.college_id, r.rank),
  ranked as (select lw.*, c.country, rank() over (partition by c.country order by lw.rank)::int as crank
             from lw join colleges c on c.id = lw.college_id and c.is_published),
  pick as (select * from ranked where nullif(trim(coalesce(p_country, '')), '') is null or country = p_country
           order by rank limit least(greatest(coalesce(p_lim, 10), 1), 50))
  select c.id, c.slug, c.name, f.city, f.state, f.country, c.logo_url,
         p.rank::int, p.crank, p.year::int, f.courses, f.fee_min, f.fee_currency, f.fee_min_inr,
         f.placement, f.placement_kind, f.placement_currency, f.median_earnings, f.top_courses
  from pick p
  join colleges c on c.id = p.college_id
  join lateral rank_card_facts(array[c.id]) f on true
  order by p.rank;
$$;

create or replace function public.world_top_countries(p_lim int default 10)
returns table (country text, n int)
language sql stable security definer set search_path = public as $$
  select c.country, count(distinct c.id)::int
  from college_rankings r join colleges c on c.id = r.college_id and c.is_published
  where r.source = 'Leiden' and r.rank is not null and c.country is not null
  group by c.country order by 2 desc, 1 limit least(greatest(coalesce(p_lim, 10), 1), 30);
$$;

grant execute on function public.world_top_table(text, int), public.world_top_countries(int) to anon, authenticated;
