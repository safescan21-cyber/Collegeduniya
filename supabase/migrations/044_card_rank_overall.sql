-- 044 · Listing cards show the same rank as the ranked lists
--   college_rows used the college's best rank in ANY NIRF category (e.g. Engineering #2) and labelled it just "NIRF",
--   so a card could say "#2 NIRF" next to a list badge saying "#3 NIRF" (Overall). Now: Overall first, and any other
--   category is named on the card ("NIRF Engineering").

create or replace function public.college_rows(p_ids uuid[])
returns table (id uuid, avg_rating numeric, review_count int, placement_avg numeric, placement_highest numeric, placement_year int,
               placement_currency text, rank_source text, rank_value int, rank_year int, course_count int, fee_low numeric, fee_high numeric,
               exams text[], approvals text[], cutoff_exam text, cutoff_rank int, cutoff_year int, brochure boolean)
language sql stable security definer set search_path = public as $$
  select c.id,
    (select round(avg(r.rating)::numeric, 1) from reviews r where r.college_id = c.id and r.status = 'approved'),
    (select count(*)::int from reviews r where r.college_id = c.id and r.status = 'approved'),
    p.avg_package, p.highest_package, p.year, p.currency,
    case when k.source = 'NIRF' and coalesce(k.category, 'Overall') not in ('Overall', '') then 'NIRF ' || k.category else k.source end, k.rank, k.year,
    (select count(*)::int from courses x where x.college_id = c.id),
    case when 'fees' = any(c.hidden_fields) then null else coalesce((select min(x.fees) from courses x where x.college_id = c.id and x.fees > 0), c.fees_min) end,
    case when 'fees' = any(c.hidden_fields) then null else coalesce((select max(x.fees) from courses x where x.college_id = c.id and x.fees > 0), c.fees_max) end,
    c.exams_accepted, c.approvals,
    co.exam_slug, co.closing_rank, co.year,
    c.brochure_url is not null
  from colleges c
  left join lateral (select * from college_placements x where x.college_id = c.id and not ('placements' = any(c.hidden_sections))
                     order by x.year desc, (x.course is null or x.course ilike 'all%') desc limit 1) p on true
  left join lateral (select * from college_rankings x where x.college_id = c.id and not ('ranking' = any(c.hidden_fields))
                     order by x.year desc, (x.source = 'NIRF') desc, (x.category = 'Overall') desc, x.rank limit 1) k on true
  left join lateral (select * from cutoffs x where x.college_id = c.id and not ('cutoffs' = any(c.hidden_sections))
                     and x.category in ('General','OPEN','GEN') order by x.year desc, x.closing_rank desc limit 1) co on true
  where c.id = any(p_ids) and c.is_published;
$$;
