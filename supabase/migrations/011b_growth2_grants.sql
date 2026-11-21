-- Collegeolo — 011b: grants for growth2 functions (run AFTER 011_growth2)
alter function public.simple_slug(text) set search_path = public;
revoke execute on function public.claim_referral(text), public.my_referrals(), public.points_balance(uuid), public.request_redemption(text) from public, anon;
grant execute on function public.claim_referral(text), public.my_referrals(), public.points_balance(uuid), public.request_redemption(text) to authenticated;
