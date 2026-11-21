-- =====================================================================
-- Collegeolo — migration 024: courses imported from official datasets (UK Discover Uni, …)
-- Imported courses carry their source and id so a re-import replaces them instead of duplicating;
-- courses typed in by admins (source null) are never touched.
-- Run AFTER 023. No DROP statements.
-- =====================================================================
alter table public.courses add column if not exists source text;
alter table public.courses add column if not exists external_id text;
alter table public.courses add column if not exists url text;
alter table public.courses add column if not exists study_mode text;   -- Full-time / Part-time / Both
create unique index if not exists courses_source_ext_uq on public.courses (college_id, source, external_id);   -- NULL source (admin courses) never conflicts
