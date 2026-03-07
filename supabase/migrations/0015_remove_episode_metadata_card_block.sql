-- Destructively remove deprecated episode metadata card structured block type.
-- This migration intentionally has no backup and no fallback conversion.

DO $$
DECLARE
  deprecated_types TEXT[] := ARRAY[
    'episode_metadata_card'
  ];
BEGIN
  UPDATE blog_posts
  SET content_json = (
    SELECT COALESCE(jsonb_agg(item ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(content_json) WITH ORDINALITY AS elements(item, ord)
    WHERE NOT ((item->>'type') = ANY(deprecated_types))
  )
  WHERE content_json IS NOT NULL
    AND jsonb_typeof(content_json) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(content_json) AS item
      WHERE (item->>'type') = ANY(deprecated_types)
    );

  UPDATE blog_post_revisions
  SET content_json_snapshot = (
    SELECT COALESCE(jsonb_agg(item ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(content_json_snapshot) WITH ORDINALITY AS elements(item, ord)
    WHERE NOT ((item->>'type') = ANY(deprecated_types))
  )
  WHERE content_json_snapshot IS NOT NULL
    AND jsonb_typeof(content_json_snapshot) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(content_json_snapshot) AS item
      WHERE (item->>'type') = ANY(deprecated_types)
    );
END $$;
