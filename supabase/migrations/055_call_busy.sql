-- 055 · Calls: "busy" when the person is already on a call (was sent as "declined", so callers thought they were rejected)
create or replace function public.update_call(p_call uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
declare k calls;
begin
  select * into k from calls where id = p_call and auth.uid() in (caller_id, callee_id) for update;
  if k.id is null then raise exception 'Not found'; end if;
  if p_status = 'accepted' and k.status = 'ringing' and auth.uid() = k.callee_id then
    update calls set status = 'accepted', answered_at = now() where id = k.id;
  elsif p_status in ('declined', 'busy') and k.status = 'ringing' and auth.uid() = k.callee_id then
    update calls set status = p_status, ended_at = now() where id = k.id;
  elsif p_status in ('ended','failed') and k.status in ('ringing','accepted') then
    update calls set status = case when k.status = 'ringing' then (case when auth.uid() = k.caller_id then 'missed' else 'declined' end) else p_status end,
                     ended_at = now() where id = k.id;
  end if;
  return (select status from calls where id = k.id);
end $$;
