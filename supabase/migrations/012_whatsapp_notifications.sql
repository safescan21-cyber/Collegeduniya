-- =====================================================================
-- StudyEarnstay.com — migration 012: WhatsApp login + notifications outbox. Run AFTER 011.
--   * profiles.whatsapp / whatsapp_opt_in — where and whether to send WhatsApp updates
--   * phone (WhatsApp OTP) sign-ups get a profile with their number
--   * notifications — every event is queued here by triggers; the Node API delivers it
--     (WhatsApp if the student opted in, otherwise email) and the dashboard lists it in-app
-- =====================================================================

alter table public.profiles add column if not exists whatsapp text;
alter table public.profiles add column if not exists whatsapp_opt_in boolean not null default false;

-- sign-up: email OTP (email set) or WhatsApp OTP (phone set, number stored by Supabase without "+")
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t text := coalesce(new.raw_user_meta_data->>'account_type', 'student');
  ph text := nullif(new.phone, '');
begin
  if t not in ('student','pg_owner','employer') then t := 'student'; end if;
  if ph is not null and left(ph, 1) <> '+' then ph := '+' || ph; end if;
  insert into public.profiles (id, email, full_name, phone, account_type, whatsapp, whatsapp_opt_in)
  values (new.id, nullif(new.email, ''),
          nullif(new.raw_user_meta_data->>'full_name', ''),
          coalesce(nullif(new.raw_user_meta_data->>'phone', ''), ph),
          t,
          ph,
          coalesce((new.raw_user_meta_data->>'whatsapp_opt_in')::boolean, false))
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------- outbox
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,            -- application_status, new_applicant, visit_request, visit_status, message, reward, review_verified, ambassador
  title       text not null,
  body        text,
  link        text,                     -- path on the site, e.g. /dashboard?tab=applications
  ref_id      uuid,
  status      text not null default 'pending' check (status in ('pending','sent','skipped','failed')),
  channel     text,                     -- whatsapp | email (set when sent)
  attempts    int not null default 0,
  error       text,
  read_at     timestamptz,
  created_at  timestamptz default now(),
  sent_at     timestamptz
);
create index if not exists notifications_pending_idx on public.notifications (status, created_at) where status = 'pending';
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notif own read" on public.notifications;
drop policy if exists "notif own mark read" on public.notifications;
drop policy if exists "notif admin" on public.notifications;
create policy "notif own read" on public.notifications for select using (user_id = auth.uid());
create policy "notif own mark read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif admin" on public.notifications for all using (public.is_admin()) with check (public.is_admin());

-- students may only set read_at on their own notifications
create or replace function public.notification_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new := old;   -- start from the stored row …
    new.read_at := coalesce(new.read_at, now());   -- … and only allow marking as read
  end if;
  return new;
end $$;
create or replace trigger notifications_guard before update on public.notifications for each row execute function public.notification_guard();

create or replace function public.notify(uid uuid, p_kind text, p_title text, p_body text, p_link text, p_ref uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, title, body, link, ref_id)
  select uid, p_kind, left(p_title, 200), left(p_body, 600), p_link, p_ref where uid is not null;
$$;

-- ---------------------------------------------------------------- triggers that queue notifications
create or replace function public.nq_job_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare j record;
begin
  select title, company, created_by into j from jobs where id = new.job_id;
  if tg_op = 'INSERT' then
    perform notify(j.created_by, 'new_applicant', 'New applicant: ' || coalesce(j.title, 'your job'),
      new.full_name || ' applied for ' || coalesce(j.title, 'your job') || '.', '/employer', new.id);
  elsif new.status is distinct from old.status then
    perform notify(new.user_id, 'application_status', 'Application update: ' || coalesce(j.title, 'job'),
      'Your application for ' || coalesce(j.title, 'the job') || ' at ' || coalesce(j.company, 'the company') || ' is now ' || replace(new.status, '_', ' ') || '.',
      '/dashboard?tab=applications', new.id);
  end if;
  return new;
end $$;
create or replace trigger job_applications_nq after insert or update of status on public.job_applications for each row execute function public.nq_job_application();

create or replace function public.nq_college_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare cname text;
begin
  if new.status is distinct from old.status then
    select name into cname from colleges where id = new.college_id;
    perform notify(new.user_id, 'application_status', 'Application update: ' || coalesce(cname, 'college'),
      'Your application to ' || coalesce(cname, 'the college') || coalesce(' (' || (to_jsonb(new)->>'course') || ')', '') || ' is now ' || replace(new.status, '_', ' ') || '.',
      '/dashboard?tab=colleges', new.id);
  end if;
  return new;
end $$;
create or replace trigger college_applications_nq after update of status on public.college_applications for each row execute function public.nq_college_application();
create or replace trigger quota_applications_nq after update of status on public.quota_applications for each row execute function public.nq_college_application();

create or replace function public.nq_hostel_visit()
returns trigger language plpgsql security definer set search_path = public as $$
declare h record;
begin
  select name, submitted_by into h from hostels where id = new.hostel_id;
  if tg_op = 'INSERT' then
    perform notify(h.submitted_by, 'visit_request', 'Visit request: ' || coalesce(h.name, 'your PG'),
      new.name || ' wants to visit on ' || to_char(new.visit_date, 'DD Mon YYYY') || coalesce(' (' || new.slot || ')', '') || '. Confirm or reschedule in your owner dashboard.',
      '/owner', new.id);
  elsif new.status is distinct from old.status then
    perform notify(new.user_id, 'visit_status', 'Visit ' || replace(new.status, '_', ' ') || ': ' || coalesce(h.name, 'PG'),
      'Your visit to ' || coalesce(h.name, 'the PG') || ' on ' || to_char(new.visit_date, 'DD Mon YYYY') || ' is ' || replace(new.status, '_', ' ') || '.',
      '/dashboard?tab=visits', new.id);
  end if;
  return new;
end $$;
create or replace trigger hostel_visits_nq after insert or update of status on public.hostel_visits for each row execute function public.nq_hostel_visit();

-- at most one "new message" notification per conversation per recipient per hour
create or replace function public.nq_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record; other uuid;
begin
  select user_a, user_b into c from conversations where id = new.conversation_id;
  other := case when c.user_a = new.sender_id then c.user_b else c.user_a end;
  if other is not null and not exists (
    select 1 from notifications where user_id = other and kind = 'message' and ref_id = new.conversation_id and created_at > now() - interval '1 hour'
  ) then
    perform notify(other, 'message', 'New message on StudyEarnstay', 'Someone sent you a message. Open it to reply.',
      '/messages?c=' || new.conversation_id, new.conversation_id);
  end if;
  return new;
end $$;
create or replace trigger messages_nq after insert on public.messages for each row execute function public.nq_message();

create or replace function public.nq_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('fulfilled','rejected') then
    perform notify(new.user_id, 'reward', case when new.status = 'fulfilled' then 'Your reward is ready 🎁' else 'Reward request refunded' end,
      case when new.status = 'fulfilled' then 'Your voucher is on the rewards page.' else 'We could not fulfil this request, so your points are back.' end,
      '/rewards', new.id);
  end if;
  return new;
end $$;
create or replace trigger reward_redemptions_nq after update of status on public.reward_redemptions for each row execute function public.nq_redemption();

create or replace function public.nq_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_verified and not coalesce(old.is_verified, false) then
    perform notify(new.user_id, 'review_verified', 'Your review is verified ✅', 'Thanks for helping other students — points were added to your rewards.', '/rewards', new.id);
  end if;
  return new;
end $$;
create or replace trigger reviews_nq after update of is_verified on public.reviews for each row execute function public.nq_review();

create or replace function public.nq_ambassador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    perform notify(new.user_id, 'ambassador', case when new.status = 'approved' then 'You are a campus ambassador 🎉' else 'Ambassador application update' end,
      case when new.status = 'approved' then 'Share your invite link to start earning points.' else 'Your ambassador application was not approved this time.' end,
      '/ambassador', new.user_id);
  end if;
  return new;
end $$;
create or replace trigger ambassadors_nq after update of status on public.ambassadors for each row execute function public.nq_ambassador();

do $$
declare fn text;
begin
  foreach fn in array array['notification_guard()','notify(uuid, text, text, text, text, uuid)','nq_job_application()','nq_college_application()',
                            'nq_hostel_visit()','nq_message()','nq_redemption()','nq_review()','nq_ambassador()','handle_new_user()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;
