-- =====================================================================
-- Collegeolo — migration 025: keys entered by a super admin in the admin panel (AI providers …)
-- Readable only by the server (service role): RLS on, no policies, no grants to anon/authenticated.
-- Run AFTER 024. No DROP statements.
-- =====================================================================
create table if not exists public.app_secrets (
  name        text primary key check (name ~ '^[A-Z][A-Z0-9_]{2,60}$'),
  value       text not null,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
