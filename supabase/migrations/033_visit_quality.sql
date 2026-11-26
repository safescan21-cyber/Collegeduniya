-- 033: "Real vs bots" — how many visitors look like real people (admins only)
-- Each browser id (visitor) in the period is put in one group:
--   suspicious : automation / link-preview / SEO-tool browser name, very old Chrome, empty browser name,
--                more than 20 pages in one minute, or more than 300 pages in the period
--   real       : opened 2+ different pages, or came from another site (Google, WhatsApp…), or is logged in
--   one_page   : opened a single page with no referrer — could be a person or a bot, can't tell
-- Admins' own visits are left out. Times are India time.

create or replace function public.visit_quality(p_days int default 3)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  with v as (
    select s.* from site_visits s
    where s.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 3), 60)))
      and (s.user_id is null or s.user_id not in (select id from profiles where role in ('admin', 'super_admin')))
  ),
  burst as (select visitor_id, max(c) as per_min from (select visitor_id, date_trunc('minute', created_at) m, count(*) c from v group by 1, 2) x group by 1),
  per as (
    select v.visitor_id, min(v.created_at) as first_at, count(*) as views, count(distinct v.path) as pages,
      bool_or(coalesce(v.referrer, '') <> '' and v.referrer !~* 'collegeolo\.com') as ext_ref,
      bool_or(v.user_id is not null) as logged, max(v.user_agent) as ua, max(v.country) as country,
      max(substring(v.referrer from '^https?://(?:www\.)?([^/:?#]+)')) filter (where v.referrer !~* 'collegeolo\.com') as ref_host,
      max(b.per_min) as per_min
    from v left join burst b using (visitor_id) group by v.visitor_id
  ),
  cls as (
    select p.*,
      case
        when coalesce(p.ua, '') = ''
          or p.ua ~* '(python|curl|wget|axios|node-fetch|undici|go-http|java/|okhttp|scrapy|selenium|puppeteer|playwright|phantom|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|claudebot|anthropic|chatgpt|perplexity|facebookexternalhit|whatsapp|telegram|slackbot|discord|yandex|baidu|bingpreview|crawl|scan)'
          or (p.ua ~* 'chrome/\d+' and coalesce(substring(p.ua from '(?i)chrome/(\d+)')::int, 999) < 100)
          or coalesce(p.per_min, 0) > 20 or p.views > 300 then 'suspicious'
        when p.pages >= 2 or p.ext_ref or p.logged then 'real'
        else 'one_page'
      end as kind,
      (case when p.ua ~* 'android' then 'Android' when p.ua ~* 'iphone|ipad' then 'iPhone/iPad' when p.ua ~* 'windows' then 'Windows'
            when p.ua ~* 'mac os' then 'Mac' when p.ua ~* 'linux|x11' then 'Linux desktop' else 'Other' end) || ' · ' ||
      (case when p.ua ~* 'edg/' then 'Edge' when p.ua ~* 'opr/|opera' then 'Opera' when p.ua ~* 'samsungbrowser' then 'Samsung'
            when p.ua ~* 'chrome|crios' then 'Chrome' when p.ua ~* 'firefox|fxios' then 'Firefox' when p.ua ~* 'safari' then 'Safari' else 'Other' end) as device
    from per p
  )
  select jsonb_build_object(
    'days', p_days,
    'totals', (select jsonb_build_object('visitors', count(*), 'real', count(*) filter (where kind = 'real'), 'one_page', count(*) filter (where kind = 'one_page'),
                 'suspicious', count(*) filter (where kind = 'suspicious'), 'page_views', coalesce(sum(views), 0),
                 'pages_per_real_visitor', round(coalesce(avg(views) filter (where kind = 'real'), 0), 1)) from cls),
    'by_day', (select coalesce(jsonb_agg(d order by d->>'day'), '[]') from (
                 select jsonb_build_object('day', to_char(first_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD'), 'real', count(*) filter (where kind = 'real'),
                   'one_page', count(*) filter (where kind = 'one_page'), 'suspicious', count(*) filter (where kind = 'suspicious')) d
                 from cls group by to_char(first_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD')) x),
    'by_hour', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'visitors', n, 'suspicious', s) order by h), '[]') from (
                 select extract(hour from first_at at time zone 'Asia/Kolkata')::int h, count(*) n, count(*) filter (where kind = 'suspicious') s from cls group by 1) x),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('device', device, 'visitors', n, 'suspicious', s, 'one_page', o) order by n desc), '[]') from (
                 select device, count(*) n, count(*) filter (where kind = 'suspicious') s, count(*) filter (where kind = 'one_page') o from cls group by device order by count(*) desc limit 12) x),
    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('site', coalesce(ref_host, '(direct / none)'), 'visitors', n) order by n desc), '[]') from (
                 select ref_host, count(*) n from cls group by ref_host order by count(*) desc limit 12) x),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('country', coalesce(country, 'unknown'), 'visitors', n) order by n desc), '[]') from (
                 select country, count(*) n from cls group by country order by count(*) desc limit 10) x),
    'top_pages', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', n) order by n desc), '[]') from (
                 select path, count(*) n from v group by path order by count(*) desc limit 12) x),
    'samples', (select coalesce(jsonb_agg(jsonb_build_object('ua', left(ua, 160), 'views', views, 'per_min', per_min) order by views desc), '[]') from (
                 select ua, views, per_min from cls where kind = 'suspicious' order by views desc limit 8) x)
  ) into out;
  return out;
end $$;
revoke all on function public.visit_quality(int) from public, anon;
grant execute on function public.visit_quality(int) to authenticated;
