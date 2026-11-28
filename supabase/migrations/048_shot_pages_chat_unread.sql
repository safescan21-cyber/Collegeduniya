-- 048 · A page per shot (SEO) and a more visible chat
--   1. shot_guard: a video shot may carry a thumbnail ("poster", a frame saved at upload) from the poster's own folder
--   2. shots_for_sitemap(): published shots for sitemap.xml (video entries with thumbnail)
--   3. chat_unread_total(): unread chats + group messages + chat requests, for the header / bottom-bar badge

create or replace function public.shot_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare item jsonb; folder text;
begin
  if new.kind = 'shot' then
    if jsonb_typeof(new.media) <> 'array' or jsonb_array_length(new.media) <> 1 then raise exception 'A shot is one video or one photo'; end if;
    if new.body is not null and char_length(new.body) > 500 then raise exception 'Shot captions can be up to 500 characters'; end if;
    item := new.media->0;
    if item ? 'poster' then
      folder := split_part(coalesce(item->>'path', ''), '/', 1);
      if item->>'type' <> 'video' or jsonb_typeof(item->'poster') <> 'string' or folder = ''
         or item->>'poster' not like folder || '/%.jpg' or item->>'poster' like '%..%' then
        raise exception 'Invalid thumbnail';
      end if;
    end if;
    new.title := null;
  end if;
  return new;
end $$;
create or replace trigger posts_shot_guard before insert or update on public.posts for each row execute function public.shot_guard();
revoke execute on function public.shot_guard() from public, anon, authenticated;

create or replace function public.shots_for_sitemap(p_lim int default 5000)
returns table (id uuid, body text, media jsonb, created_at timestamptz, edited_at timestamptz, likes int, comments int, author_name text, college_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.body, p.media, p.created_at, p.edited_at, p.likes, p.comments,
         coalesce(split_part(pr.full_name, ' ', 1), 'Student'), c.name
  from posts p
  join profiles pr on pr.id = p.user_id and not coalesce(pr.is_blocked, false)
  left join colleges c on c.id = p.college_id
  where p.kind = 'shot' and p.status = 'published'
  order by p.created_at desc
  limit least(greatest(coalesce(p_lim, 5000), 1), 20000);
$$;
grant execute on function public.shots_for_sitemap(int) to anon, authenticated;

create or replace function public.chat_unread_total()
returns table (chats int, groups int, requests int)
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(i.unread) from public.my_inbox() i where i.status = 'active'), 0)::int,
         coalesce((select sum(g.unread) from public.my_groups() g), 0)::int,
         coalesce((select count(*) from public.my_inbox() i where i.status = 'pending' and not i.i_requested), 0)::int
  where auth.uid() is not null;
$$;
grant execute on function public.chat_unread_total() to authenticated;
