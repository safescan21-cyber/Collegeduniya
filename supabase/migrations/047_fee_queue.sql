-- 047 · Official-fee collector order: NIRF-ranked colleges first (best rank first), then world-ranked universities
--   fee_queue(lim, days)  → next colleges to read (with a website, not read in the last `days` days)
--   fee_progress()         → how far it has got, for Admin → Official fees

create or replace function public.fee_queue(p_lim int default 10, p_recheck_days int default 60)
returns table (id uuid, name text, city text, country text, website text, tier int, best_rank int)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.city, c.country, c.website,
         case when n.r is not null then 1 else 2 end, coalesce(n.r, w.r)
  from colleges c
  left join lateral (select min(r.rank)::int r from college_rankings r where r.college_id = c.id and r.source = 'NIRF' and r.rank is not null) n on true
  left join lateral (select min(r.rank)::int r from college_rankings r where r.college_id = c.id and r.source = 'Leiden' and r.rank is not null) w on true
  where c.is_published and nullif(trim(coalesce(c.website, '')), '') is not null
    and (n.r is not null or w.r is not null)
    and (c.fees_checked_at is null or c.fees_checked_at < now() - make_interval(days => greatest(coalesce(p_recheck_days, 60), 1)))
  order by case when n.r is not null then 1 else 2 end,
           -- world-ranked universities that already have official fees (U.S. Scorecard, UK Discover Uni, Australia CRICOS) go last
           (n.r is null and exists (select 1 from courses k where k.college_id = c.id and k.fees > 0)),
           coalesce(n.r, w.r), c.name
  limit least(greatest(coalesce(p_lim, 10), 1), 100);
$$;

create or replace function public.fee_progress()
returns table (list text, colleges int, with_website int, read int, with_fees int)
language sql stable security definer set search_path = public as $$
  with r as (
    select c.id, c.website, c.fees_checked_at, k.nirf, k.world,
           exists (select 1 from courses x where x.college_id = c.id and x.fees > 0) fees
    from (select college_id, bool_or(source = 'NIRF') nirf, bool_or(source = 'Leiden') world
          from college_rankings where rank is not null and source in ('NIRF', 'Leiden') and college_id is not null group by college_id) k
    join colleges c on c.id = k.college_id and c.is_published)
  select 'NIRF ranked', count(*)::int, count(*) filter (where nullif(trim(coalesce(website, '')), '') is not null)::int,
         count(*) filter (where fees_checked_at is not null)::int, count(*) filter (where fees)::int from r where nirf
  union all
  select 'World ranked', count(*)::int, count(*) filter (where nullif(trim(coalesce(website, '')), '') is not null)::int,
         count(*) filter (where fees_checked_at is not null)::int, count(*) filter (where fees)::int from r where world and not nirf;
$$;

revoke all on function public.fee_queue(int, int), public.fee_progress() from public, anon, authenticated;
grant execute on function public.fee_queue(int, int), public.fee_progress() to service_role;
