create or replace view public.blog_analytics_post_totals
with (security_invoker = true)
as
select
  p.id as post_id,
  p.slug,
  p.title,
  count(*) filter (where e.event_type = 'pageview') as pageviews,
  count(*) filter (where e.event_type = 'cta_click') as cta_clicks,
  count(*) filter (where e.event_type = 'platform_click') as platform_clicks,
  count(*) filter (where e.event_type = 'patreon_click') as patreon_clicks,
  count(*) filter (where e.event_type = 'listen_start') as listens_started,
  count(*) filter (where e.event_type = 'search_result_click') as search_result_clicks,
  coalesce(avg(((e.metadata ->> 'scrollPercent')::numeric)) filter (where e.event_type = 'scroll_depth'), 0) as avg_scroll_percent,
  max(e.occurred_at) as last_event_at
from public.blog_posts p
left join public.blog_analytics_events e on e.post_id = p.id
group by p.id, p.slug, p.title;

create or replace view public.blog_analytics_episode_totals
with (security_invoker = true)
as
select
  pe.id as episode_id,
  pe.slug,
  pe.title,
  count(*) filter (where e.event_type = 'platform_click') as platform_clicks,
  count(*) filter (where e.event_type = 'listen_start') as listens_started,
  max(e.occurred_at) as last_event_at
from public.podcast_episodes pe
left join public.blog_analytics_events e on e.episode_id = pe.id
group by pe.id, pe.slug, pe.title;