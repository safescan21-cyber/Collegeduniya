-- 045 · Facts for ranking lists (NIRF table + world ranking cards on /rankings)
--   rank_card_facts(ids) → photo, logo, course count, lowest yearly fee (own currency + rupees), latest placement,
--   U.S. median earnings 10 years after entry (College Scorecard), and up to 4 popular courses with their fees.

create or replace function public.rank_card_facts(p_ids uuid[])
returns table (id uuid, slug text, city text, state text, country text, photo text, logo text, courses int,
               fee_min numeric, fee_currency text, fee_min_inr numeric,
               placement numeric, placement_kind text, placement_currency text, placement_year int,
               median_earnings numeric, top_courses jsonb)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.city, c.state, c.country,
    coalesce(c.cover_url, c.photos[1]), c.logo_url,
    (select count(*)::int from courses k where k.college_id = c.id),
    case when 'fees' = any(c.hidden_fields) then null else f.fees end,
    case when 'fees' = any(c.hidden_fields) then null else f.cur end,
    case when 'fees' = any(c.hidden_fields) then null else round(f.fees * coalesce(fx.inr, case when f.cur = 'INR' then 1 end)) end,
    coalesce(p.median_package, p.avg_package), case when p.median_package is not null then 'median' when p.avg_package is not null then 'average' end,
    p.currency, p.year,
    nullif(c.facts->>'median_earnings_10y', '')::numeric,
    (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'level', t.level, 'fees', t.fees, 'currency', t.cur) order by t.o), '[]'::jsonb)
       from (select k.name, k.level, case when 'fees' = any(c.hidden_fields) then null else k.fees end fees, upper(coalesce(k.currency, 'INR')) cur,
                    row_number() over (order by case when lower(k.name) ~ '(computer|data science|artificial|software)' then 0
                                                      when lower(k.name) ~ '(business|management|mba|medicine|mbbs|economics|electrical|electronics|mechanical|law|psychology|nursing|finance)' then 1
                                                      when lower(k.name) ~ 'engineering' then 2 else 3 end,
                                                (k.level = 'UG') desc, (k.fees is not null) desc, k.name) o
             from courses k where k.college_id = c.id) t where t.o <= 4)
  from colleges c
  left join lateral (select k.fees, upper(coalesce(k.currency, 'INR')) cur from courses k
                     where k.college_id = c.id and k.fees > 0 order by (k.level = 'UG') desc, k.fees limit 1) f0 on true
  left join lateral (select coalesce(f0.fees, case when c.fees_min > 0 then c.fees_min end) fees,
                            coalesce(f0.cur, upper(coalesce(c.currency, 'INR'))) cur) f on true
  left join fx_rates fx on fx.currency = f.cur
  left join lateral (select * from college_placements x where x.college_id = c.id and not ('placements' = any(c.hidden_sections))
                     and coalesce(x.median_package, x.avg_package) is not null
                     order by x.year desc, (x.course is null or x.course ilike 'all%') desc, coalesce(x.median_package, x.avg_package) desc limit 1) p on true
  where c.id = any(p_ids) and c.is_published;
$$;

grant execute on function public.rank_card_facts(uuid[]) to anon, authenticated;
