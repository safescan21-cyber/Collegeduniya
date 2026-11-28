-- =====================================================================
-- Collegeolo — migration 028: college rankings readable by visitors again
-- The "rankings public read" rule looked at colleges.hidden_fields, a column visitors may not read
-- (migration 009), so the check failed and no ranking ever showed. The check now runs as the owner.
-- Run AFTER 027. Policy is replaced in place (drop + create of the same policy).
-- =====================================================================
create or replace function public.college_ranking_visible(p_college uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from colleges c where c.id = p_college and c.is_published
                 and not ('ranking' = any(coalesce(c.hidden_fields, '{}'::text[]))));
$$;
grant execute on function public.college_ranking_visible(uuid) to anon, authenticated;

drop policy if exists "rankings public read" on public.college_rankings;
create policy "rankings public read" on public.college_rankings for select using (public.college_ranking_visible(college_id) or public.is_admin());
grant select on public.college_rankings to anon, authenticated;
