-- 069 · Scholarship stories: written by students who really received the scholarship, shown only after an admin approves.
--   Optional award-letter photo goes to the private "verification" bucket through the API (service role) and is deleted
--   as soon as an admin decides — only the "verified" tick is kept. Students never read other students' rows directly.
create table if not exists public.scholarship_stories (
  id             uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  display_name   text not null check (char_length(display_name) between 2 and 60),
  college        text check (char_length(college) <= 120),
  course         text check (char_length(course) <= 120),
  year_awarded   int  not null check (year_awarded between 1990 and 2100),
  story          text not null check (char_length(story) between 80 and 3000),
  tips           text check (char_length(tips) <= 1500),
  proof_path     text,
  verified       boolean not null default false,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note     text,
  created_at     timestamptz not null default now(),
  approved_at    timestamptz,
  unique (scholarship_id, user_id)
);
create index if not exists scholarship_stories_pub_idx on public.scholarship_stories (scholarship_id, status, approved_at desc);
alter table public.scholarship_stories enable row level security;
drop policy if exists "stories own read" on public.scholarship_stories;
drop policy if exists "stories admin" on public.scholarship_stories;
create policy "stories own read" on public.scholarship_stories for select to authenticated using (user_id = auth.uid());
create policy "stories admin" on public.scholarship_stories for all using (public.is_admin()) with check (public.is_admin());
-- writes go through the API (it checks the user and the photo); no insert/update policy for users

-- approved stories for one scholarship (no user ids leave the database)
create or replace function public.scholarship_stories_public(p_scholarship uuid, p_lim int default 20)
returns table (id uuid, display_name text, college text, course text, year_awarded int, story text, tips text, verified boolean, approved_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.display_name, s.college, s.course, s.year_awarded, s.story, s.tips, s.verified, s.approved_at
  from scholarship_stories s
  where s.scholarship_id = p_scholarship and s.status = 'approved'
  order by s.verified desc, s.approved_at desc nulls last
  limit least(greatest(coalesce(p_lim, 20), 1), 50)
$$;
grant execute on function public.scholarship_stories_public(uuid, int) to anon, authenticated;
