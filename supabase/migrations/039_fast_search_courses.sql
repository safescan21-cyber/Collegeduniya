-- Collegeolo.com — migration 039: fast college search + worldwide course search.
--   1 trigram indexes (pg_trgm) so "%word%" searches use an index instead of reading every college / course
--   2 college_search()  — one call returns the page of matching college ids + total (capped), any filter combination,
--                         best matches first when searching by name; replaces 4–6 separate queries on /colleges
--   3 fx_rates           — daily rates (filled by the API) so fees in EUR / USD / GBP … can be compared in rupees
--   4 course_search()    — every course in every country: by name, country, level, max fee; "best" = world research
--                         ranking (Leiden), then India's NIRF, then fee

-- ---------------------------------------------------------------- 1. indexes
do $$
declare sch text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    if exists (select 1 from pg_namespace where nspname = 'extensions') then create extension pg_trgm with schema extensions;
    else create extension pg_trgm; end if;
  end if;
  select n.nspname into sch from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  execute format('create index if not exists colleges_search_trgm_idx on public.colleges using gin
    ((lower(name || '' '' || coalesce(short_name, '''') || '' '' || coalesce(city, '''') || '' '' || coalesce(state, '''') || '' '' || coalesce(district, ''''))) %I.gin_trgm_ops)', sch);
  execute format('create index if not exists courses_name_trgm_idx on public.courses using gin (lower(name) %I.gin_trgm_ops)', sch);
end $$;
create index if not exists colleges_country_rank_idx on public.colleges (country, ranking) where is_published;
create index if not exists colleges_state_idx on public.colleges (state) where is_published;
create index if not exists colleges_city_lower_idx on public.colleges (lower(city)) where is_published;
create index if not exists courses_level_college_idx on public.courses (level, college_id);
create index if not exists courses_catalog_college_idx on public.courses (catalog_slug, college_id);
create index if not exists college_rankings_source_idx on public.college_rankings (source, college_id, year desc);

-- ---------------------------------------------------------------- 2. college search (dynamic SQL → a good plan for each filter mix)
create or replace function public.college_search(
  p_q text default null, p_country text default null, p_state text default null, p_city text default null, p_type text default null,
  p_inst text default null, p_stream text default null, p_exam text default null, p_approval text default null, p_fees_max numeric default null,
  p_level text default null, p_course text default null, p_sort text default 'rank', p_offset int default 0, p_lim int default 20)
returns table (id uuid, total int, country_used text)
language plpgsql stable security definer set search_path = public as $$
declare
  term text := nullif(lower(regexp_replace(trim(coalesce(p_q, '')), '[%_\\]', ' ', 'g')), '');
  words text[]; w text; country text := nullif(trim(coalesce(p_country, '')), '');
  cond text := 'c.is_published'; ord text; total int; sql text;
  alias jsonb := '{"usa":"United States","us":"United States","america":"United States","uk":"United Kingdom","britain":"United Kingdom","england":"United Kingdom","uae":"United Arab Emirates","dubai":"United Arab Emirates","korea":"South Korea","holland":"Netherlands"}';
begin
  -- a country name ("Japan", "USA") becomes a country filter
  if term is not null and country is null then
    select co.name into country from countries co where lower(co.name) = coalesce(alias->>term, term) limit 1;
    if country is not null then term := null; end if;
  end if;
  if term is not null then
    words := array(select x from regexp_split_to_table(regexp_replace(term, '[^[:alnum:]\s&]', ' ', 'g'), '\s+') x where length(x) >= 2 and x not in ('of','the','and','for','in','at','college','university') limit 6);
    if coalesce(array_length(words, 1), 0) = 0 then words := array[term]; end if;
    foreach w in array words loop
      cond := cond || format(' and lower(c.name || '' '' || coalesce(c.short_name, '''') || '' '' || coalesce(c.city, '''') || '' '' || coalesce(c.state, '''') || '' '' || coalesce(c.district, '''')) like %L', '%' || w || '%');
    end loop;
  end if;
  if country is not null then cond := cond || format(' and c.country = %L', country); end if;
  if nullif(p_state, '') is not null then cond := cond || format(' and c.state = %L', p_state); end if;
  if nullif(p_city, '') is not null then cond := cond || format(' and lower(c.city) = lower(%L)', p_city); end if;
  if nullif(p_type, '') is not null then cond := cond || format(' and c.type = %L', p_type); end if;
  if nullif(p_inst, '') is not null then cond := cond || format(' and c.facts->>''institution'' = %L', p_inst); end if;
  if nullif(p_stream, '') is not null then cond := cond || format(' and c.streams @> array[%L]', p_stream); end if;
  if nullif(p_exam, '') is not null then cond := cond || format(' and c.exams_accepted @> array[%L]', p_exam); end if;
  if nullif(p_approval, '') is not null then cond := cond || format(' and c.approvals @> array[%L]', p_approval); end if;
  if p_fees_max is not null then cond := cond || format(' and c.fees_min <= %s', p_fees_max); end if;
  if nullif(p_level, '') is not null then cond := cond || format(' and exists (select 1 from courses k where k.college_id = c.id and k.level = %L)', p_level); end if;
  if nullif(p_course, '') is not null then cond := cond || format(' and exists (select 1 from courses k where k.college_id = c.id and k.catalog_slug = %L)', p_course); end if;

  ord := case p_sort
    when 'fees_low' then 'c.fees_min asc nulls last, c.name'
    when 'fees_high' then 'c.fees_max desc nulls last, c.name'
    when 'newest' then 'c.created_at desc'
    when 'name' then 'c.name'
    else 'c.ranking asc nulls last, c.name' end;
  if term is not null and coalesce(p_sort, 'rank') = 'rank' then   -- name search: exact and starts-with matches first
    ord := format('(lower(c.name) = %L or lower(coalesce(c.short_name, '''')) = %L) desc, (lower(c.name) like %L) desc, ', term, term, term || '%') || ord;
  end if;

  execute 'select count(*)::int from (select 1 from colleges c where ' || cond || ' limit 10001) t' into total;   -- "10,000+" is enough for paging
  sql := format('select c.id, %s, %L::text from colleges c where %s order by %s offset %s limit %s',
                total, country, cond, ord, greatest(coalesce(p_offset, 0), 0), least(greatest(coalesce(p_lim, 20), 1), 60));
  return query execute sql;
  if not found and total = 0 then return query select null::uuid, 0, country; end if;   -- still tell the page which country was used
end $$;

-- ---------------------------------------------------------------- 3. exchange rates (rupees per 1 unit), refreshed daily by the API
create table if not exists public.fx_rates (
  currency   text primary key,
  inr        numeric not null check (inr > 0),
  updated_at timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
drop policy if exists "fx read" on public.fx_rates;
create policy "fx read" on public.fx_rates for select using (true);
insert into public.fx_rates (currency, inr) values ('INR', 1) on conflict (currency) do nothing;

-- ---------------------------------------------------------------- 4. worldwide course search
create or replace function public.course_search(
  p_q text default null, p_country text default null, p_level text default null, p_max_inr numeric default null,
  p_sort text default 'best', p_offset int default 0, p_lim int default 20)
returns table (id uuid, name text, level text, duration text, fees numeric, currency text, fees_inr numeric, url text, study_mode text,
               college_id uuid, college_name text, college_slug text, city text, country text, country_code text,
               world_rank int, nirf_rank int, total int)
language plpgsql stable security definer set search_path = public as $$
declare
  term text := nullif(lower(regexp_replace(trim(coalesce(p_q, '')), '[%_\\]', ' ', 'g')), '');
  words text[]; w text; cond text := 'c.is_published'; ord text; total int;
  base text := 'from courses k join colleges c on c.id = k.college_id
      left join fx_rates fx on fx.currency = upper(coalesce(k.currency, ''INR''))
      left join lateral (select r.rank from college_rankings r where r.college_id = c.id and r.source = ''Leiden'' and r.rank is not null order by r.year desc limit 1) wr on true
      left join lateral (select r.rank from college_rankings r where r.college_id = c.id and r.source = ''NIRF'' and r.category = ''Overall'' and r.rank is not null order by r.year desc limit 1) nr on true';
begin
  if term is not null then
    words := array(select x from regexp_split_to_table(regexp_replace(term, '[^[:alnum:]\s&]', ' ', 'g'), '\s+') x where length(x) >= 2 and x not in ('of','the','and','in','with','course','degree') limit 6);
    if coalesce(array_length(words, 1), 0) = 0 then words := array[term]; end if;
    foreach w in array words loop
      cond := cond || format(' and lower(k.name) like %L', '%' || w || '%');
    end loop;
  end if;
  if nullif(p_country, '') is not null then cond := cond || format(' and c.country = %L', p_country); end if;
  if nullif(p_level, '') is not null then cond := cond || format(' and k.level = %L', p_level); end if;
  if p_max_inr is not null then cond := cond || format(' and k.fees is not null and k.fees * coalesce(fx.inr, case when upper(coalesce(k.currency, ''INR'')) = ''INR'' then 1 end) <= %s', p_max_inr); end if;
  if term is null and nullif(p_country, '') is null and nullif(p_level, '') is null and p_max_inr is null then return; end if;   -- needs at least one filter

  ord := case p_sort
    when 'fees_low' then 'fees_inr asc nulls last, wr.rank asc nulls last'
    when 'fees_high' then 'fees_inr desc nulls last'
    else 'wr.rank asc nulls last, nr.rank asc nulls last, c.ranking asc nulls last, fees_inr asc nulls last' end;

  execute 'select count(*)::int from (select 1 ' || base || ' where ' || cond || ' limit 5001) t' into total;
  return query execute format(
    'select k.id, k.name::text, k.level::text, k.duration::text, k.fees::numeric, upper(coalesce(k.currency, ''INR'')), round(k.fees * fx.inr) as fees_inr, k.url, k.study_mode,
            c.id, c.name, c.slug, c.city, c.country, c.country_code::text, wr.rank::int, nr.rank::int, %s %s where %s order by %s offset %s limit %s',
    total, base, cond, ord, greatest(coalesce(p_offset, 0), 0), least(greatest(coalesce(p_lim, 20), 1), 50));
end $$;

grant execute on function public.college_search(text, text, text, text, text, text, text, text, text, numeric, text, text, text, int, int),
  public.course_search(text, text, text, numeric, text, int, int) to anon, authenticated;

-- dropdown lists for /colleges (the page used to read 5,000 college rows just to list the countries)
create or replace function public.college_countries()
returns table (country text) language sql stable security definer set search_path = public as $$
  select distinct c.country from colleges c where c.is_published and c.country is not null order by 1;
$$;
create or replace function public.college_states(p_country text)
returns table (state text) language sql stable security definer set search_path = public as $$
  select distinct c.state from colleges c where c.is_published and c.country = p_country and c.state is not null order by 1;
$$;
grant execute on function public.college_countries(), public.college_states(text) to anon, authenticated;
