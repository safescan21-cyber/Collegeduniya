-- 062 · "Which queries use the database most?" — from pg_stat_statements (on by default in Supabase).
--   Many short queries can keep the database busy without any single one being slow; this shows them by total time.
--   admin_top_queries_reset() starts a fresh count (e.g. after fixing something).
create or replace function public.admin_top_queries(p_lim int default 8)
returns table (calls bigint, total_seconds int, avg_ms numeric, query text)
language plpgsql stable security definer set search_path = public, extensions, pg_catalog as $$
declare sch text;
begin
  select n.nspname into sch from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_stat_statements';
  if sch is null then return; end if;
  return query execute format(
    'select s.calls, (s.total_exec_time / 1000)::int, round((s.mean_exec_time)::numeric, 1), left(regexp_replace(s.query, ''\s+'', '' '', ''g''), 220)
       from %I.pg_stat_statements s
      where s.query !~* ''^(begin|commit|set |show |select pg_|listen|notify)'' and s.query !~* ''pg_stat_statements|pg_stat_activity''
      order by s.total_exec_time desc limit %s', sch, greatest(1, least(p_lim, 20)));
end $$;
revoke execute on function public.admin_top_queries(int) from public, anon, authenticated;
grant execute on function public.admin_top_queries(int) to service_role;

create or replace function public.admin_top_queries_reset()
returns void language plpgsql security definer set search_path = public, extensions, pg_catalog as $$
declare sch text;
begin
  select n.nspname into sch from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_stat_statements';
  if sch is not null then execute format('select %I.pg_stat_statements_reset()', sch); end if;
end $$;
revoke execute on function public.admin_top_queries_reset() from public, anon, authenticated;
grant execute on function public.admin_top_queries_reset() to service_role;

notify pgrst, 'reload config';
