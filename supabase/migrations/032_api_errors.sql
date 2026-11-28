-- 032: API error log + automatic fixes (server-only; read through the API's admin routes)
-- Every API request that fails (5xx) or is very slow is counted per route and kind of problem, with the
-- likely cause and what fixes it. Automatic repairs (restarting a service, pausing background jobs) are logged.

create table if not exists public.api_errors (
  key        text primary key,               -- route + kind of problem
  route      text not null,
  status     int,
  kind       text not null,                  -- database_down, database_slow, login_service, ai_limit, code_error, slow, …
  cause      text,
  fix        text,
  message    text,                           -- latest error message
  count      bigint not null default 0,
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  resolved   boolean not null default false
);
create index if not exists api_errors_last_idx on public.api_errors (last_at desc);

create table if not exists public.auto_fixes (
  id         bigserial primary key,
  action     text not null,
  reason     text,
  ok         boolean,
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists auto_fixes_created_idx on public.auto_fixes (created_at desc);

alter table public.api_errors enable row level security;
alter table public.auto_fixes enable row level security;
revoke all on public.api_errors, public.auto_fixes from anon, authenticated;
revoke all on sequence public.auto_fixes_id_seq from anon, authenticated;

-- add counts collected in memory by the API (one call per minute)
create or replace function public.bump_api_errors(p_rows jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.api_errors as e (key, route, status, kind, cause, fix, message, count, first_at, last_at, resolved)
  select r->>'key', r->>'route', nullif(r->>'status','')::int, r->>'kind', r->>'cause', r->>'fix', left(r->>'message', 500),
         coalesce((r->>'count')::bigint, 1), coalesce((r->>'first_at')::timestamptz, now()), coalesce((r->>'last_at')::timestamptz, now()), false
  from jsonb_array_elements(p_rows) r
  on conflict (key) do update set
    count = e.count + excluded.count, status = excluded.status, cause = excluded.cause, fix = excluded.fix,
    message = excluded.message, last_at = greatest(e.last_at, excluded.last_at), resolved = false;
$$;
revoke all on function public.bump_api_errors(jsonb) from public, anon, authenticated;

-- keep the tables small: errors not seen for 30 days and fixes older than 90 days are removed
create or replace function public.trim_api_errors()
returns void language sql security definer set search_path = public as $$
  delete from public.api_errors where last_at < now() - interval '30 days';
  delete from public.auto_fixes where created_at < now() - interval '90 days';
$$;
revoke all on function public.trim_api_errors() from public, anon, authenticated;
