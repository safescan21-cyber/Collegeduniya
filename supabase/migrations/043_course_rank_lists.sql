-- 043 · College search by course, worldwide, as three ranked lists
--   course_rank_lists(course, scope, country, state)
--     scope 'country' → colleges in that country teaching the course, by the country's own ranking
--                       (India: NIRF; other countries: position among that country's universities in the world ranking)
--     scope 'world'   → every country, by the world research ranking (CWTS Leiden)
--     scope 'state'   → colleges in that state / region, by the same country ranking
--   A course matches when every word is in the course name, or the term is the catalog name ("btech", "mba").

create or replace function public.course_rank_lists(
  p_course text, p_scope text default 'country', p_country text default 'India', p_state text default null,
  p_offset int default 0, p_lim int default 10)
returns table (id uuid, world_rank int, country_rank int, rank_label text, courses int, course_name text, fee_min_inr numeric, course_list jsonb, total int)
language plpgsql stable security definer set search_path = public as $$
declare
  term text := nullif(lower(regexp_replace(trim(coalesce(p_course, '')), '[%_\\]', ' ', 'g')), '');
  slug text; words text[]; w text; kcond text := 'true'; ccond text := 'c.is_published'; ord text; total int; q text;
  scope text := coalesce(nullif(p_scope, ''), 'country');
  country text := coalesce(nullif(trim(p_country), ''), 'India');
begin
  if term is null then return; end if;
  slug := regexp_replace(term, '[^a-z0-9]', '', 'g');
  words := array(select x from regexp_split_to_table(regexp_replace(term, '[^[:alnum:]\s&]', ' ', 'g'), '\s+') x
                 where length(x) >= 2 and x not in ('of','the','and','in','with','course','degree','courses') limit 6);
  if coalesce(array_length(words, 1), 0) > 0 then
    foreach w in array words loop kcond := kcond || format(' and lower(k.name) like %L', '%' || w || '%'); end loop;
    kcond := format('((%s) or k.catalog_slug = %L)', kcond, slug);
  else
    kcond := format('k.catalog_slug = %L', slug);
  end if;

  if scope = 'world' then
    ccond := ccond || ' and wr.rank is not null';
    ord := 't.wrank asc, t.name';
  elsif scope = 'state' then
    if nullif(trim(coalesce(p_state, '')), '') is null then return; end if;
    ccond := ccond || format(' and c.country = %L and c.state = %L', country, p_state);
    ord := 't.crank asc nulls last, t.wrank asc nulls last, t.name';
  else
    ccond := ccond || format(' and c.country = %L', country);
    ord := 't.crank asc nulls last, t.wrank asc nulls last, t.name';
  end if;

  q := format($q$
    with m as (
      select k.college_id, count(*)::int n, min(k.name)::text nm,
             min(round(k.fees * coalesce(fx.inr, case when upper(coalesce(k.currency, 'INR')) = 'INR' then 1 end))) fee,
             to_jsonb((array_agg(jsonb_build_object('name', k.name, 'level', k.level, 'duration', k.duration, 'fees', k.fees,
                       'currency', upper(coalesce(k.currency, 'INR')), 'mode', k.study_mode) order by k.fees asc nulls last, k.name))[1:3]) list
      from courses k left join fx_rates fx on fx.currency = upper(coalesce(k.currency, 'INR'))
      where %s group by k.college_id),
    lw as (   -- latest world rank per college, and its place inside its own country
      select x.college_id, x.rank, rank() over (partition by cc.country order by x.rank)::int as in_country
      from (select distinct on (r.college_id) r.college_id, r.rank from college_rankings r
            where r.source = 'Leiden' and r.rank is not null order by r.college_id, r.year desc) x
      join colleges cc on cc.id = x.college_id and cc.is_published),
    t as (
      select c.id, c.name, wr.rank::int wrank,
             case when c.country = 'India' then coalesce(nr.rank, c.ranking) else coalesce(wr.in_country, c.ranking) end::int crank,
             case when c.country = 'India' then case when coalesce(nr.rank, c.ranking) is not null then 'NIRF' end
                  when wr.in_country is not null then 'World ranking, within ' || c.country
                  when c.ranking is not null then 'National ranking' end lbl,
             m.n, m.nm, m.fee, m.list
      from m join colleges c on c.id = m.college_id
      left join lw wr on wr.college_id = c.id
      left join lateral (select r.rank from college_rankings r where r.college_id = c.id and r.source = 'NIRF' and r.category = 'Overall'
                         and r.rank is not null order by r.year desc limit 1) nr on c.country = 'India'
      where %s)
    select t.id, t.wrank, t.crank, t.lbl, t.n, t.nm, t.fee, t.list, (select count(*)::int from t) from t order by %s offset %s limit %s
  $q$, kcond, ccond, ord, greatest(coalesce(p_offset, 0), 0), least(greatest(coalesce(p_lim, 10), 1), 50));
  return query execute q;
end $$;

grant execute on function public.course_rank_lists(text, text, text, text, int, int) to anon, authenticated;
