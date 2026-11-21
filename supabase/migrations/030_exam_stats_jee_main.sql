-- =====================================================================
-- Collegeolo — migration 030: official candidate totals for the percentile → rank predictor
-- JEE Main Paper 1 (B.E./B.Tech), unique candidates who appeared in both sessions — NTA press releases.
-- Run AFTER 029. Safe to re-run.
-- =====================================================================
insert into public.exam_stats (exam_slug, year, session, total_candidates, source)
select v.slug, v.year, 'All', v.n, v.src
from (values
  ('jee-main', 2026, 1538468, 'NTA press release, 20 April 2026 — unique candidates appeared in both sessions (Paper 1)'),
  ('jee-main', 2025, 1475103, 'NTA press release, 19 April 2025 — unique candidates appeared in both sessions (Paper 1)')
) as v(slug, year, n, src)
where exists (select 1 from public.exams e where e.slug = v.slug)
on conflict (exam_slug, year, session) do nothing;
