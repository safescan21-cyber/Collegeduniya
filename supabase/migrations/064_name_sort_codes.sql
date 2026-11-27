-- 064 · "Name A–Z": also ignore list codes glued to the front of imported names ("100001-Kces'S Mooljee Jaitha College",
--   "061-Pt. Sri Jagannath …"), so page 1 starts with real "A…" names. Names that genuinely start with a number
--   ("1 Decembrie 1918" University) keep their number.
create or replace function public.name_sort_key(n text)
returns text language sql immutable parallel safe as $$
  select lower(regexp_replace(regexp_replace(coalesce(n, ''), '^[^[:alnum:]]*[0-9]{2,}\s*[-–.:)]\s*', ''), '^[^[:alnum:]]+', ''))
$$;
