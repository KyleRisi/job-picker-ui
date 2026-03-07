-- Backfill canonical primary listen_episode blocks into content_json/content_json_snapshot.
-- For posts/revisions with linked episodes, remove all legacy listen_episode blocks and prepend one canonical block.

DO $$
BEGIN
  UPDATE blog_posts AS p
  SET content_json = jsonb_build_array(primary_block.block) || filtered.filtered_blocks
  FROM LATERAL (
    SELECT l.episode_id
    FROM blog_post_episode_links AS l
    WHERE l.post_id = p.id
    ORDER BY l.sort_order ASC
    LIMIT 1
  ) AS first_episode
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'listen_episode',
      'episodeId', first_episode.episode_id::text,
      'heading', 'Listen to the linked episode',
      'description', '',
      'platform', 'generic'
    ) AS block
  ) AS primary_block
  CROSS JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(item ORDER BY ord), '[]'::jsonb) AS filtered_blocks
    FROM jsonb_array_elements(p.content_json) WITH ORDINALITY AS existing(item, ord)
    WHERE COALESCE(item->>'type', '') <> 'listen_episode'
  ) AS filtered
  WHERE p.content_json IS NOT NULL
    AND jsonb_typeof(p.content_json) = 'array';

  UPDATE blog_post_revisions AS r
  SET content_json_snapshot = jsonb_build_array(primary_block.block) || filtered.filtered_blocks
  FROM LATERAL (
    SELECT linked.item->>'episodeId' AS episode_id
    FROM jsonb_array_elements(r.linked_episodes_snapshot) WITH ORDINALITY AS linked(item, ord)
    WHERE COALESCE(linked.item->>'episodeId', '') <> ''
    ORDER BY
      CASE
        WHEN COALESCE(linked.item->>'sortOrder', '') ~ '^[0-9]+$' THEN (linked.item->>'sortOrder')::int
        ELSE 2147483647
      END ASC,
      CASE WHEN COALESCE(linked.item->>'isPrimary', 'false') = 'true' THEN 0 ELSE 1 END ASC,
      linked.ord ASC
    LIMIT 1
  ) AS first_episode
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'listen_episode',
      'episodeId', first_episode.episode_id,
      'heading', 'Listen to the linked episode',
      'description', '',
      'platform', 'generic'
    ) AS block
  ) AS primary_block
  CROSS JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(item ORDER BY ord), '[]'::jsonb) AS filtered_blocks
    FROM jsonb_array_elements(r.content_json_snapshot) WITH ORDINALITY AS existing(item, ord)
    WHERE COALESCE(item->>'type', '') <> 'listen_episode'
  ) AS filtered
  WHERE r.content_json_snapshot IS NOT NULL
    AND jsonb_typeof(r.content_json_snapshot) = 'array'
    AND r.linked_episodes_snapshot IS NOT NULL
    AND jsonb_typeof(r.linked_episodes_snapshot) = 'array'
    AND jsonb_array_length(r.linked_episodes_snapshot) > 0;
END $$;
