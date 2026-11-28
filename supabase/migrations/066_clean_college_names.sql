-- 066 · Clean imported college names, slowly and reversibly.
--   "100001-Kces'S Mooljee Jaitha College, Jalgaon."  →  "Kces's Mooljee Jaitha College, Jalgaon."
--   "''SMAT ' s SHIVANAND COLLEGE, KAGWAD''"          →  "SMAT ' s SHIVANAND COLLEGE, KAGWAD"
--   Only imported rows (never colleges the team added by hand). Web addresses (slugs) are not changed.
--   Every change is kept in college_name_fixes (old → new), so it can be undone.
create table if not exists public.college_name_fixes (
  college_id uuid primary key references public.colleges(id) on delete cascade,
  old_name text not null, new_name text not null, fixed_at timestamptz not null default now()
);
alter table public.college_name_fixes enable row level security;   -- no policies: service role only

create or replace function public.clean_college_name(n text)
returns text language sql immutable parallel safe as $$
  select btrim(regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(n, ''), '^[^[:alnum:]]*[0-9]{2,}\s*[-–.:)]\s*', ''),        -- list code at the front
             '^[''"‘’“”\s]+(.*[^''"‘’“”\s])[''"‘’“”\s]+$', '\1'),                                      -- quotes wrapping the WHOLE name
           '([[:alpha:]])[''’]S\M', '\1''s', 'g'))                                                    -- College'S → College's
$$;

-- one small batch (called every few minutes by the API, only when the server is calm)
create or replace function public.fix_college_names(p_lim int default 300)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with pick as (
    select c.id, c.name, public.clean_college_name(c.name) as clean
    from colleges c
    where c.source in ('aishe', 'hipolabs', 'wikidata', 'eter', 'discover_uni', 'scorecard', 'josaa', 'cricos', 'nirf')
      and (c.name ~ '^[^[:alnum:]]*[0-9]{2,}\s*[-–.:)]' or c.name ~ '^[''"‘’“”\s].*[^''"‘’“”\s][''"‘’“”\s]+$' or c.name ~ '[[:alpha:]][''’]S\M')
      and not exists (select 1 from college_name_fixes f where f.college_id = c.id)
    limit least(greatest(coalesce(p_lim, 300), 1), 1000)
  ), logged as (
    insert into college_name_fixes (college_id, old_name, new_name)
    select id, name, case when length(clean) >= 3 then clean else name end from pick   -- every picked row is logged, so it is never picked again
    on conflict (college_id) do nothing
    returning college_id, new_name
  )
  update colleges c set name = l.new_name from logged l where c.id = l.college_id and c.name <> l.new_name;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.fix_college_names(int) from public, anon, authenticated;
grant execute on function public.fix_college_names(int) to service_role;

-- undo everything (if ever needed): select public.undo_college_name_fixes();
create or replace function public.undo_college_name_fixes()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update colleges c set name = f.old_name from college_name_fixes f where f.college_id = c.id and c.name = f.new_name;
  get diagnostics n = row_count;
  delete from college_name_fixes;
  return n;
end $$;
revoke execute on function public.undo_college_name_fixes() from public, anon, authenticated;
grant execute on function public.undo_college_name_fixes() to service_role;
