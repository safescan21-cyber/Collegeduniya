-- =====================================================================
-- Collegeolo.com — migration 009: security hardening (Supabase advisor)
-- Run AFTER 008. Safe to re-run.
-- =====================================================================

-- 1. Visitors may read only non-sensitive columns straight from base tables.
--    Everything else goes through the masking views (colleges_public, reviews_public …),
--    so hidden fees / contacts, internal admin notes, ID-proof paths and company
--    registration numbers can't be fetched from /rest/v1 directly.
revoke select on public.colleges from anon, authenticated;
grant select (id, slug, name, short_name, type, country, country_code, state, district, city, city_geoname_id,
              is_published, is_featured, accepts_applications, created_at, updated_at)
  on public.colleges to anon, authenticated;

alter table public.reviews add column if not exists has_proof boolean generated always as (proof_url is not null) stored;
revoke select on public.reviews from anon, authenticated;
grant select (id, college_id, user_id, rating, rating_faculty, rating_campus, rating_placement, title, body, course,
              batch_year, status, edited_by_admin, created_at, updated_at, is_verified, reward_status, has_proof)
  on public.reviews to anon, authenticated;

revoke select on public.companies from anon;
grant select (id, owner_id, name, slug, logo_url, website, industry, size, about, address, city, country,
              contact_email, contact_phone, is_verified, created_at, updated_at)
  on public.companies to anon;

-- 2. Functions that read colleges for visitors run as owner (they already mask hidden fields)
alter function public.nearby_colleges(double precision, double precision, double precision) security definer;
alter function public.predict_colleges(text, int, text, text, text) security definer;

-- 3. Fixed search_path on every function
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
             and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

-- 4. Trigger functions are not API endpoints
do $$
declare fn text;
begin
  foreach fn in array array['handle_new_user()','protect_profile_columns()','protect_review_columns()','protect_application_columns()',
    'protect_listing()','protect_answer()','protect_college_application()','protect_company()','quota_application_guard()',
    'quota_seat_defaults()','touch_updated_at()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;
