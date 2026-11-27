-- 063 · Colleges "Name A–Z" ignores leading quotes, spaces and invisible characters.
--   Imported names like  ''SMAT's …''  or  " 1 Decembrie 1918" University  (and names starting with a zero-width
--   or non-breaking space) sorted before every "A…" name, so page 1 of the list looked random.
create or replace function public.name_sort_key(n text)
returns text language sql immutable parallel safe as $$
  select lower(regexp_replace(coalesce(n, ''), '^[^[:alnum:]]+', ''))
$$;

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
    when 'name' then 'public.name_sort_key(c.name), c.name'
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
grant execute on function public.college_search(text, text, text, text, text, text, text, text, text, numeric, text, text, text, int, int),
  public.course_search(text, text, text, numeric, text, int, int) to anon, authenticated;
