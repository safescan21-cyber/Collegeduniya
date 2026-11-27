-- 061 · Database watchdog: see what is using the database, and stop runaway queries.
--   • Time limits per role: website visitors' queries stop after 15 s, background jobs after 5 minutes (only where no limit exists yet).
--   • admin_db_activity(): the queries running right now (for Admin → System health).
--   • db_watchdog(): stops any app query (not autovacuum, not a migration run by psql) running longer than 5 minutes.

-- only where no limit is set yet (keeps a stricter existing limit, e.g. Supabase's own 3 s / 8 s)
do $$
declare r record;
begin
  for r in select * from (values ('anon', '15s'), ('authenticated', '15s'), ('service_role', '5min')) v(role, lim) loop
    if not exists (select 1 from pg_db_role_setting s join pg_roles ro on ro.oid = s.setrole
                   where ro.rolname = r.role and s.setdatabase = 0 and exists (select 1 from unnest(s.setconfig) c where c like 'statement_timeout=%')) then
      execute format('alter role %I set statement_timeout = %L', r.role, r.lim);
    end if;
  end loop;
end $$;

create or replace function public.admin_db_activity()
returns table (pid int, role text, app text, state text, seconds int, waiting text, query text)
language sql stable security definer set search_path = public, pg_catalog as $$
  select a.pid, a.usename::text, a.application_name, a.state,
         extract(epoch from now() - coalesce(a.query_start, a.xact_start, a.backend_start))::int,
         nullif(concat_ws(':', a.wait_event_type, a.wait_event), ''),
         left(regexp_replace(a.query, '\s+', ' ', 'g'), 300)
  from pg_stat_activity a
  where a.pid <> pg_backend_pid() and a.state is distinct from 'idle' and a.backend_type in ('client backend', 'autovacuum worker')
  order by now() - coalesce(a.query_start, a.xact_start) desc nulls last
  limit 15
$$;
revoke execute on function public.admin_db_activity() from public, anon, authenticated;
grant execute on function public.admin_db_activity() to service_role;

create or replace function public.db_watchdog(p_max_seconds int default 300)
returns table (pid int, seconds int, query text)
language sql volatile security definer set search_path = public, pg_catalog as $$
  select a.pid, extract(epoch from now() - a.query_start)::int, left(regexp_replace(a.query, '\s+', ' ', 'g'), 200)
  from pg_stat_activity a
  where a.pid <> pg_backend_pid() and a.backend_type = 'client backend'
    and a.state in ('active', 'idle in transaction') and a.query_start < now() - make_interval(secs => greatest(p_max_seconds, 60))
    and coalesce(a.application_name, '') not in ('psql', 'pg_dump', 'pg_restore')
    and a.usename not in ('supabase_replication_admin', 'supabase_admin')
    and pg_cancel_backend(a.pid)
$$;
revoke execute on function public.db_watchdog(int) from public, anon, authenticated;
grant execute on function public.db_watchdog(int) to service_role;

notify pgrst, 'reload config';
