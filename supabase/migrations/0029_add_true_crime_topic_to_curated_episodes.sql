-- Add the true-crime topic to curated hub episodes that are currently excluded
-- from /episodes?topic=true-crime.
--
-- Safety goals:
-- 1) Keep existing primary topics unchanged.
-- 2) Only attach an additional topic mapping for the targeted episode slugs.
-- 3) Be idempotent (no duplicate links if re-run).

with target_term as (
  select id
  from discovery_terms
  where term_type = 'topic'
    and slug = 'true-crime'
  limit 1
), target_episodes as (
  select id
  from podcast_episodes
  where slug in (
    'the-millionaire-cough-britain-s-biggest-game-show-scandal',
    'body-in-room-348-how-a-locked-room-led-to-an-impossible-answer',
    'jennifer-fairgate-the-woman-with-no-past',
    'elizabeth-holmes-silicon-valley-s-greatest-fraud',
    'rudy-kurniawan-the-man-who-duped-the-elite-with-fake-fine-wines',
    'knoedler-gallery-scandal-the-greatest-art-fraud-of-the-century',
    'dr-donald-cline-conceived-in-deceit-the-infamous-fertility-scandal'
  )
), rows_to_insert as (
  select
    ep.id as episode_id,
    tt.id as term_id,
    coalesce(max(link.sort_order), -1) + 1 as sort_order,
    false as is_primary
  from target_episodes ep
  cross join target_term tt
  left join episode_discovery_terms link
    on link.episode_id = ep.id
  where not exists (
    select 1
    from episode_discovery_terms existing
    where existing.episode_id = ep.id
      and existing.term_id = tt.id
  )
  group by ep.id, tt.id
)
insert into episode_discovery_terms (episode_id, term_id, sort_order, is_primary)
select episode_id, term_id, sort_order, is_primary
from rows_to_insert;
