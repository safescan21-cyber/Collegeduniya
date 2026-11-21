-- =====================================================================
-- Collegeolo.com — migration 019: fuller college pages, data-rich listings and course pages
--   • colleges: approvals, exams accepted, brochure, admission process, important dates, scholarships, FAQs
--     (entered by admins / colleges from official sources — empty fields are simply not shown)
--   • course_catalog (B.Tech, MBA, MBBS …) with basic facts; each college course is linked to it automatically
--   • RPCs for listing rows, the home-page top-colleges table and course statistics — all computed from real data
-- Run AFTER 018. No DROP statements.
-- =====================================================================

-- ---------------------------------------------------------------- 1. college details
alter table public.colleges add column if not exists approvals         text[] not null default '{}';   -- UGC, AICTE, NAAC A+, NBA, BCI, NMC, PCI …
alter table public.colleges add column if not exists exams_accepted    text[] not null default '{}';   -- exam slugs, e.g. {jee-main,mht-cet}
alter table public.colleges add column if not exists brochure_url      text;
alter table public.colleges add column if not exists admission_process text check (admission_process is null or char_length(admission_process) <= 6000);
alter table public.colleges add column if not exists important_dates   text check (important_dates is null or char_length(important_dates) <= 3000);   -- one per line: "Event | Date"
alter table public.colleges add column if not exists scholarship_info  text check (scholarship_info is null or char_length(scholarship_info) <= 4000);
alter table public.colleges add column if not exists faqs              text check (faqs is null or char_length(faqs) <= 8000);               -- "Q: …" / "A: …" blocks
alter table public.colleges add column if not exists details_source    text check (details_source is null or char_length(details_source) <= 300);  -- e.g. official prospectus 2026 link
create index if not exists colleges_exams_idx on public.colleges using gin (exams_accepted);
create index if not exists colleges_approvals_idx on public.colleges using gin (approvals);

-- same columns as before (migration 005) + the new ones at the end
create or replace view public.colleges_public with (security_invoker = false) as
select
  c.id, c.slug, c.name, c.short_name, c.type, c.country, c.country_code, c.state, c.district, c.city, c.city_geoname_id,
  case when 'address' = any(c.hidden_fields) then null else c.address end as address,
  case when 'map' = any(c.hidden_fields) then null else c.latitude end as latitude,
  case when 'map' = any(c.hidden_fields) then null else c.longitude end as longitude,
  case when 'established' = any(c.hidden_fields) then null else c.established end as established,
  case when 'ranking' = any(c.hidden_fields) then null else c.ranking end as ranking,
  case when 'accreditation' = any(c.hidden_fields) then null else c.accreditation end as accreditation,
  case when 'website' = any(c.hidden_fields) then null else c.website end as website,
  case when 'contact' = any(c.hidden_fields) then null else c.email end as email,
  case when 'contact' = any(c.hidden_fields) then null else c.phone end as phone,
  case when 'description' = any(c.hidden_fields) then null else c.description end as description,
  case when 'fees' = any(c.hidden_fields) then null else c.fees_min end as fees_min,
  case when 'fees' = any(c.hidden_fields) then null else c.fees_max end as fees_max,
  c.currency, c.streams, c.facilities,
  case when 'logo' = any(c.hidden_fields) then null else c.logo_url end as logo_url,
  case when 'photos' = any(c.hidden_fields) then null else c.cover_url end as cover_url,
  case when 'photos' = any(c.hidden_fields) or 'gallery' = any(c.hidden_sections) then '{}'::text[] else c.photos end as photos,
  case when 'students' = any(c.hidden_fields) then null else c.students_count end as students_count,
  c.admission_rate, c.management, c.affiliated_to, c.facts,
  case when 'photos' = any(c.hidden_fields) then '[]'::jsonb else c.photo_credits end as photo_credits,
  case when 'description' = any(c.hidden_fields) then null else c.description_source end as description_source,
  c.wikipedia_url,
  c.is_featured, c.is_published, c.accepts_applications and not ('apply' = any(c.hidden_sections)) as accepts_applications,
  c.application_note, c.source, c.wikidata_id, c.hidden_sections, c.hidden_fields,
  c.created_at, c.updated_at, c.data_updated_at,
  c.approvals, c.exams_accepted, c.brochure_url,
  case when 'admission' = any(c.hidden_sections) then null else c.admission_process end as admission_process,
  case when 'admission' = any(c.hidden_sections) then null else c.important_dates end as important_dates,
  case when 'scholarships' = any(c.hidden_sections) then null else c.scholarship_info end as scholarship_info,
  case when 'faqs' = any(c.hidden_sections) then null else c.faqs end as faqs,
  c.details_source
from public.colleges c
where c.is_published;
grant select on public.colleges_public to anon, authenticated;

-- ---------------------------------------------------------------- 2. course catalogue
create table if not exists public.course_catalog (
  slug        text primary key,
  name        text not null,                 -- B.Tech
  full_name   text not null,                 -- Bachelor of Technology
  level       text not null check (level in ('UG','PG','Diploma','PhD','Certificate')),
  stream      text not null,
  duration    text,                          -- 4 years
  eligibility text,                          -- basic, widely published eligibility
  exam_slugs  text[] not null default '{}',  -- common entrance exams (links to /exams/<slug> when that page exists)
  match       text not null,                 -- case-insensitive regex matched against college course names
  about       text,                          -- written by the team; shown only when filled
  careers     text,                          -- written by the team; shown only when filled
  sort        int not null default 100,
  is_published boolean not null default true,
  updated_at  timestamptz default now()
);
alter table public.course_catalog enable row level security;
drop policy if exists "catalog read" on public.course_catalog;
drop policy if exists "catalog admin" on public.course_catalog;
create policy "catalog read" on public.course_catalog for select using (is_published or public.is_admin());
create policy "catalog admin" on public.course_catalog for all using (public.is_admin()) with check (public.is_admin());

-- basic facts only (names, duration, standard eligibility, common exams); descriptions are left for the team to write
insert into public.course_catalog (slug, name, full_name, level, stream, duration, eligibility, exam_slugs, match, sort) values
 ('btech','B.Tech / B.E.','Bachelor of Technology / Bachelor of Engineering','UG','Engineering','4 years','Class 12 with Physics, Chemistry and Mathematics','{jee-main,jee-advanced,mht-cet,kcet,wbjee}','^\s*(b\.?\s*tech|b\.?\s*e\.?)(\y|\s|$)',1),
 ('mtech','M.Tech / M.E.','Master of Technology / Master of Engineering','PG','Engineering','2 years','B.Tech / B.E. in a related branch','{gate}','^\s*(m\.?\s*tech|m\.?\s*e\.?)(\y|\s|$)',2),
 ('mba','MBA / PGDM','Master of Business Administration / Post Graduate Diploma in Management','PG','Management','2 years','A bachelor''s degree in any subject','{cat,xat,mat,cmat,snap,nmat}','^\s*(mba|pgdm)\y',3),
 ('bba','BBA','Bachelor of Business Administration','UG','Management','3 years','Class 12 in any stream','{cuet-ug,ipmat}','^\s*bba\y(?!.*llb)',4),
 ('mbbs','MBBS','Bachelor of Medicine, Bachelor of Surgery','UG','Medical','5.5 years including a 1-year internship','Class 12 with Physics, Chemistry and Biology','{neet-ug}','^\s*mbbs\y',5),
 ('bds','BDS','Bachelor of Dental Surgery','UG','Medical','5 years including a 1-year internship','Class 12 with Physics, Chemistry and Biology','{neet-ug}','^\s*bds\y',6),
 ('bsc-nursing','B.Sc Nursing','Bachelor of Science in Nursing','UG','Medical','4 years','Class 12 with Physics, Chemistry and Biology',  '{neet-ug}','^\s*b\.?\s*sc.*nursing',7),
 ('bpharm','B.Pharm','Bachelor of Pharmacy','UG','Pharmacy','4 years','Class 12 with Physics, Chemistry and Biology or Mathematics','{mht-cet}','^\s*b\.?\s*pharm',8),
 ('bca','BCA','Bachelor of Computer Applications','UG','Computer Applications','3 years','Class 12, usually with Mathematics','{cuet-ug}','^\s*bca\y',9),
 ('mca','MCA','Master of Computer Applications','PG','Computer Applications','2 years','A bachelor''s degree, usually with Mathematics','{nimcet}','^\s*mca\y',10),
 ('bsc','B.Sc','Bachelor of Science','UG','Science','3–4 years','Class 12 with Science','{cuet-ug}','^\s*b\.?\s*sc\y(?!.*(nursing|llb))',11),
 ('msc','M.Sc','Master of Science','PG','Science','2 years','B.Sc in a related subject','{cuet-pg,iit-jam}','^\s*m\.?\s*sc\y',12),
 ('bcom','B.Com','Bachelor of Commerce','UG','Commerce','3–4 years','Class 12, usually Commerce','{cuet-ug}','^\s*b\.?\s*com\y(?!.*llb)',13),
 ('mcom','M.Com','Master of Commerce','PG','Commerce','2 years','B.Com or a related degree','{cuet-pg}','^\s*m\.?\s*com\y',14),
 ('ba','BA','Bachelor of Arts','UG','Arts','3–4 years','Class 12 in any stream','{cuet-ug}','^\s*b\.?\s*a\.?(\s|\(|$)(?!.*llb)',15),
 ('ma','MA','Master of Arts','PG','Arts','2 years','A bachelor''s degree','{cuet-pg}','^\s*m\.?\s*a\.?(\s|\(|$)',16),
 ('llb','LLB','Bachelor of Laws (3-year)','UG','Law','3 years','A bachelor''s degree in any subject','{}','^\s*llb\y',17),
 ('ba-llb','Integrated LLB (BA LLB, BBA LLB…)','Five-year integrated law degree','UG','Law','5 years','Class 12 in any stream','{clat,ailet}','(ba|bba|b\.?\s*com|b\.?\s*sc)\.?\s*llb',18),
 ('barch','B.Arch','Bachelor of Architecture','UG','Architecture','5 years','Class 12 with Physics, Chemistry and Mathematics','{nata,jee-main}','^\s*b\.?\s*arch',19),
 ('bdes','B.Des','Bachelor of Design','UG','Design','4 years','Class 12 in any stream','{uceed,nift}','^\s*b\.?\s*des',20),
 ('bed','B.Ed','Bachelor of Education','UG','Education','2 years','A bachelor''s or master''s degree','{}','^\s*b\.?\s*ed\y',21),
 ('bhm','BHM','Bachelor of Hotel Management','UG','Hotel Management','3–4 years','Class 12 in any stream','{nchm-jee}','^\s*(bhm|bhmct|b\.?\s*sc\.?\s*hospitality)',22),
 ('diploma-engineering','Diploma (Polytechnic)','Diploma in Engineering','Diploma','Engineering','3 years','Class 10','{}','^\s*diploma\y.*(engineering|polytechnic)|^\s*polytechnic',23),
 ('phd','PhD','Doctor of Philosophy','PhD','Research','3–6 years','A master''s degree in a related subject','{ugc-net}','^\s*ph\.?\s*d',24)
on conflict (slug) do nothing;

alter table public.courses add column if not exists catalog_slug text references public.course_catalog(slug) on delete set null;
create index if not exists courses_catalog_idx on public.courses (catalog_slug, fees);

create or replace function public.match_course_catalog(p_name text)
returns text language sql stable set search_path = public as $$
  select slug from course_catalog where p_name ~* match order by sort limit 1;
$$;
create or replace function public.course_catalog_link()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name or new.catalog_slug is null then
    new.catalog_slug := coalesce(public.match_course_catalog(new.name), new.catalog_slug);
  end if;
  return new;
end $$;
create or replace trigger courses_catalog_link before insert or update of name, catalog_slug on public.courses
  for each row execute function public.course_catalog_link();
update public.courses set catalog_slug = public.match_course_catalog(name) where catalog_slug is null;

-- ---------------------------------------------------------------- 3. listing rows: fees, placement, rating, rank, exams per college
create or replace function public.college_rows(p_ids uuid[])
returns table (id uuid, avg_rating numeric, review_count int, placement_avg numeric, placement_highest numeric, placement_year int,
               placement_currency text, rank_source text, rank_value int, rank_year int, course_count int, fee_low numeric, fee_high numeric,
               exams text[], approvals text[], cutoff_exam text, cutoff_rank int, cutoff_year int, brochure boolean)
language sql stable security definer set search_path = public as $$
  select c.id,
    (select round(avg(r.rating)::numeric, 1) from reviews r where r.college_id = c.id and r.status = 'approved'),
    (select count(*)::int from reviews r where r.college_id = c.id and r.status = 'approved'),
    p.avg_package, p.highest_package, p.year, p.currency,
    k.source, k.rank, k.year,
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
                     order by x.year desc, (x.source = 'NIRF') desc, x.rank limit 1) k on true
  left join lateral (select * from cutoffs x where x.college_id = c.id and not ('cutoffs' = any(c.hidden_sections))
                     and x.category in ('General','OPEN','GEN') order by x.year desc, x.closing_rank desc limit 1) co on true
  where c.id = any(p_ids) and c.is_published;
$$;

-- home page: top colleges of a stream, in rank order, with the same facts
create or replace function public.top_colleges_table(p_stream text default null, p_country text default 'India', p_lim int default 10)
returns table (id uuid, slug text, name text, city text, state text, logo_url text, rank_source text, rank_value int, rank_year int,
               fee_low numeric, currency text, placement_avg numeric, placement_highest numeric, avg_rating numeric, review_count int,
               cutoff_exam text, cutoff_rank int)
language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (k.college_id) k.college_id, k.source, k.rank, k.year
    from college_rankings k
    where p_stream is null or k.category ilike p_stream || '%' or k.category ilike 'overall%'
    order by k.college_id, k.year desc, (p_stream is not null and k.category ilike p_stream || '%') desc, k.rank
  ), picked as (
    select c.*, b.source as rsrc, coalesce(b.rank, c.ranking) as rnk, b.year as ryear
    from colleges c left join best b on b.college_id = c.id
    where c.is_published and (p_country is null or c.country = p_country)
      and (p_stream is null or p_stream = any(c.streams))
      and coalesce(b.rank, c.ranking) is not null and not ('ranking' = any(c.hidden_fields))
    order by coalesce(b.rank, c.ranking), c.name
    limit least(greatest(p_lim, 1), 50)
  )
  select p.id, p.slug, p.name, p.city, p.state, case when 'logo' = any(p.hidden_fields) then null else p.logo_url end,
         p.rsrc, p.rnk, p.ryear, r.fee_low, p.currency, r.placement_avg, r.placement_highest, r.avg_rating, r.review_count,
         r.cutoff_exam, r.cutoff_rank
  from picked p cross join lateral public.college_rows(array[p.id]) r
  order by p.rnk, p.name;
$$;

-- ---------------------------------------------------------------- 4. course pages: numbers from colleges that actually offer the course
create or replace function public.course_stats(p_slug text, p_country text default null)
returns table (colleges bigint, fee_min numeric, fee_median numeric, fee_max numeric, placement_median numeric,
               public_colleges bigint, private_colleges bigint, states jsonb, cities jsonb)
language sql stable security definer set search_path = public as $$
  with offered as (
    select distinct on (c.id) c.id, c.type, c.state, c.city, x.fees
    from courses x join colleges c on c.id = x.college_id and c.is_published
    where x.catalog_slug = p_slug and (p_country is null or c.country = p_country)
    order by c.id, x.fees nulls last
  )
  select count(*),
         min(fees) filter (where fees > 0),
         percentile_cont(0.5) within group (order by fees) filter (where fees > 0),
         max(fees) filter (where fees > 0),
         (select percentile_cont(0.5) within group (order by p.median_package)
            from college_placements p where p.college_id in (select id from offered) and p.median_package > 0
              and p.year >= extract(year from now())::int - 3),
         count(*) filter (where type in ('Public')), count(*) filter (where type in ('Private','Deemed')),
         (select coalesce(jsonb_agg(jsonb_build_object('name', s, 'n', n) order by n desc), '[]'::jsonb)
            from (select state s, count(*) n from offered where state is not null group by state order by count(*) desc limit 12) t),
         (select coalesce(jsonb_agg(jsonb_build_object('name', s, 'n', n) order by n desc), '[]'::jsonb)
            from (select city s, count(*) n from offered group by city order by count(*) desc limit 12) t)
  from offered;
$$;

create or replace function public.course_colleges(p_slug text, p_state text default null, p_sort text default 'rank', p_offset int default 0, p_lim int default 20)
returns table (id uuid, slug text, name text, city text, state text, type text, logo_url text, course_name text, duration text,
               fees numeric, currency text, seats int, rank_value int)
language sql stable security definer set search_path = public as $$
  select * from (
    select distinct on (c.id) c.id, c.slug, c.name, c.city, c.state, c.type,
           case when 'logo' = any(c.hidden_fields) then null else c.logo_url end as logo_url,
           x.name as course_name, x.duration, case when 'fees' = any(c.hidden_fields) then null else x.fees end as fees, x.currency, x.seats,
           case when 'ranking' = any(c.hidden_fields) then null else c.ranking end as rank_value
    from courses x join colleges c on c.id = x.college_id and c.is_published
    where x.catalog_slug = p_slug and (p_state is null or c.state = p_state)
    order by c.id, x.fees nulls last
  ) t
  order by case when p_sort = 'fees_low' then t.fees end asc nulls last,
           case when p_sort = 'fees_high' then t.fees end desc nulls last,
           t.rank_value nulls last, t.name
  offset greatest(p_offset, 0) limit least(greatest(p_lim, 1), 50);
$$;

create or replace function public.course_catalog_counts()
returns table (slug text, colleges bigint, fee_min numeric)
language sql stable security definer set search_path = public as $$
  select k.slug, count(distinct c.id), min(x.fees) filter (where x.fees > 0 and c.id is not null)
  from course_catalog k
  left join courses x on x.catalog_slug = k.slug
  left join colleges c on c.id = x.college_id and c.is_published
  where k.is_published
  group by k.slug;
$$;

create or replace function public.top_study_cities(p_country text default 'India', p_lim int default 12)
returns table (city text, state text, colleges bigint)
language sql stable security definer set search_path = public as $$
  select c.city, max(c.state), count(*) from colleges c
  where c.is_published and (p_country is null or c.country = p_country)
  group by c.city order by count(*) desc, c.city limit least(greatest(p_lim, 1), 50);
$$;

grant execute on function public.course_catalog_counts(), public.top_study_cities(text, int) to anon, authenticated;
grant execute on function public.college_rows(uuid[]), public.top_colleges_table(text, text, int), public.course_stats(text, text),
  public.course_colleges(text, text, text, int, int), public.match_course_catalog(text) to anon, authenticated;
