-- 070 · GMAT mock test follows the official GMAT Focus Edition structure (checked against GMAC, 28 Nov 2026):
--   Quantitative Reasoning 21 q / Verbal Reasoning 23 q / Data Insights 20 q, 45 minutes each (2 h 15 min), no negative marking.
-- Source: https://www.gmac.com/gmat-other-assessments/about-the-gmat-focus-edition/exam-overview
-- Only the STRUCTURE is taken from GMAC. Questions are written by our generator (original) — never copied from GMAC material.
-- Data Insights is single-answer here (tables/graphs given as text); data sufficiency keeps the official five answer choices.
insert into public.mock_blueprints (exam_slug, title, duration_min, sections, instructions, pattern_source, is_published, autopilot, ai_drafted, pattern_checked)
values (
  'gmat',
  'GMAT Focus Edition — full mock test',
  135,
  '[
    {"name":"Quantitative Reasoning","questions":21,"correct":1,"wrong":0,
     "topics":["Percentages and percent change","Ratios and proportions","Fractions and decimals","Number properties (odd/even, primes, divisibility, remainders)","Exponents and roots","Linear and quadratic equations","Inequalities and absolute value","Rates, work and speed","Interest and growth","Averages and weighted averages","Overlapping sets","Counting, combinations and probability","Sequences","Word problems (algebra)"]},
    {"name":"Verbal Reasoning","questions":23,"correct":1,"wrong":0,
     "topics":["Critical reasoning: assumption","Critical reasoning: strengthen","Critical reasoning: weaken","Critical reasoning: inference","Critical reasoning: evaluate the argument","Critical reasoning: explain a paradox","Critical reasoning: boldface roles","Reading comprehension: main idea","Reading comprehension: detail","Reading comprehension: inference","Reading comprehension: author purpose and tone","Reading comprehension: application"]},
    {"name":"Data Insights","questions":20,"correct":1,"wrong":0,
     "topics":["Data sufficiency (official five answer choices)","Table analysis","Graphics interpretation","Two-part analysis","Multi-source reasoning"]}
  ]'::jsonb,
  'Three sections, 45 minutes each, like the real GMAT Focus Edition (64 questions, 2 h 15 min). No negative marking — answer every question. '
  || 'No calculator in Quantitative Reasoning; a calculator is allowed in Data Insights on the real test. '
  || 'Data sufficiency answers: (A) statement 1 alone is sufficient, (B) statement 2 alone is sufficient, (C) both together are sufficient, (D) each alone is sufficient, (E) not sufficient. '
  || 'This is a practice test written by Collegeolo in the official format; for official questions use the free GMAT Official Starter Kit on mba.com.',
  'GMAC — GMAT Focus Edition exam structure: https://www.gmac.com/gmat-other-assessments/about-the-gmat-focus-edition/exam-overview (checked 28 Nov 2026)',
  false, true, false, true
)
on conflict (exam_slug) do update set
  title = excluded.title,
  duration_min = excluded.duration_min,
  sections = excluded.sections,
  instructions = excluded.instructions,
  pattern_source = excluded.pattern_source,
  autopilot = true,
  ai_drafted = false,
  pattern_checked = true;
-- is_published is left as it is: autopilot publishes the test once the question bank is big enough.
