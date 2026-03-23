-- Schema hardening for episode editorial runtime dependencies.

alter table if exists podcast_episodes
  add column if not exists episode_number int null,
  add column if not exists season_number int null,
  add column if not exists duration_seconds int null,
  add column if not exists source_url text null,
  add column if not exists missing_from_feed_at timestamptz null;

create index if not exists podcast_episodes_episode_number_idx
on podcast_episodes (episode_number);

create table if not exists discovery_terms (
  id uuid primary key default gen_random_uuid(),
  term_type text not null,
  entity_subtype text null,
  name text not null,
  slug text not null unique,
  description text null,
  intro_json jsonb not null default '[]'::jsonb,
  intro_markdown text null,
  hero_image_url text null,
  seo_title text null,
  meta_description text null,
  social_title text null,
  social_description text null,
  social_image_url text null,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_terms_type_active_sort_idx
on discovery_terms (term_type, is_active, sort_order asc, name asc);

create table if not exists podcast_episode_editorial (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references podcast_episodes(id) on delete cascade,
  author_id uuid null references blog_authors(id) on delete set null,
  web_title text null,
  web_slug text null,
  excerpt text null,
  body_json jsonb not null default '[]'::jsonb,
  body_markdown text null,
  hero_image_url text null,
  hero_image_storage_path text null,
  seo_title text null,
  meta_description text null,
  canonical_url_override text null,
  social_title text null,
  social_description text null,
  social_image_url text null,
  noindex boolean not null default false,
  nofollow boolean not null default false,
  is_featured boolean not null default false,
  is_visible boolean not null default true,
  is_archived boolean not null default false,
  editorial_notes text null,
  focus_keyword text null,
  created_by text null,
  updated_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id)
);

alter table if exists podcast_episode_editorial
  add column if not exists author_id uuid null references blog_authors(id) on delete set null,
  add column if not exists web_title text null,
  add column if not exists web_slug text null,
  add column if not exists excerpt text null,
  add column if not exists body_json jsonb not null default '[]'::jsonb,
  add column if not exists body_markdown text null,
  add column if not exists hero_image_url text null,
  add column if not exists hero_image_storage_path text null,
  add column if not exists seo_title text null,
  add column if not exists meta_description text null,
  add column if not exists canonical_url_override text null,
  add column if not exists social_title text null,
  add column if not exists social_description text null,
  add column if not exists social_image_url text null,
  add column if not exists noindex boolean not null default false,
  add column if not exists nofollow boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_visible boolean not null default true,
  add column if not exists is_archived boolean not null default false,
  add column if not exists editorial_notes text null,
  add column if not exists focus_keyword text null,
  add column if not exists created_by text null,
  add column if not exists updated_by text null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists podcast_episode_editorial_web_slug_idx
on podcast_episode_editorial (web_slug);

create unique index if not exists podcast_episode_editorial_episode_id_unique_idx
on podcast_episode_editorial (episode_id);

create table if not exists episode_discovery_terms (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references podcast_episodes(id) on delete cascade,
  term_id uuid not null references discovery_terms(id) on delete cascade,
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (episode_id, term_id)
);

alter table if exists episode_discovery_terms
  add column if not exists is_primary boolean not null default false,
  add column if not exists sort_order int not null default 0,
  add column if not exists created_at timestamptz not null default now();

create index if not exists episode_discovery_terms_episode_sort_idx
on episode_discovery_terms (episode_id, sort_order asc);

create index if not exists episode_discovery_terms_term_idx
on episode_discovery_terms (term_id);

create table if not exists episode_relationships (
  id uuid primary key default gen_random_uuid(),
  source_episode_id uuid not null references podcast_episodes(id) on delete cascade,
  target_episode_id uuid not null references podcast_episodes(id) on delete cascade,
  relationship_type text not null default 'related',
  sort_order int not null default 0,
  is_manual boolean not null default true,
  created_at timestamptz not null default now(),
  unique (source_episode_id, target_episode_id)
);

alter table if exists episode_relationships
  add column if not exists relationship_type text not null default 'related',
  add column if not exists sort_order int not null default 0,
  add column if not exists is_manual boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

create index if not exists episode_relationships_source_sort_idx
on episode_relationships (source_episode_id, sort_order asc);

create index if not exists episode_relationships_target_idx
on episode_relationships (target_episode_id);

create table if not exists episode_related_posts (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references podcast_episodes(id) on delete cascade,
  blog_post_id uuid not null references blog_posts(id) on delete cascade,
  sort_order int not null default 0,
  is_manual boolean not null default true,
  created_at timestamptz not null default now(),
  unique (episode_id, blog_post_id)
);

alter table if exists episode_related_posts
  add column if not exists sort_order int not null default 0,
  add column if not exists is_manual boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

create index if not exists episode_related_posts_episode_sort_idx
on episode_related_posts (episode_id, sort_order asc);

create index if not exists episode_related_posts_post_idx
on episode_related_posts (blog_post_id);

create table if not exists podcast_episode_prepublish_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  normalized_title text not null,
  status text not null default 'draft' check (status in ('draft', 'ready_to_match', 'needs_review', 'conflict', 'attached', 'archived')),
  review_reason text null,
  candidate_episode_ids uuid[] not null default '{}'::uuid[],
  matched_episode_id uuid null references podcast_episodes(id) on delete set null,
  matched_at timestamptz null,
  editorial_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text null,
  updated_by text null,
  ready_to_match_at timestamptz null,
  ready_to_match_by text null,
  last_match_attempt_at timestamptz null,
  match_attempt_count int not null default 0 check (match_attempt_count >= 0),
  attach_method text null check (attach_method in ('auto', 'manual', 'conflict_resolution', 'rollback')),
  attached_by text null,
  resolved_by text null,
  resolved_at timestamptz null,
  archived_at timestamptz null,
  source_hint text null,
  expected_publish_date date null,
  manual_match_notes text null default '',
  episode_number_hint int null,
  series_name_hint text null,
  part_number_hint int null,
  alternate_titles jsonb not null default '[]'::jsonb,
  allow_title_collision boolean not null default false
);

create index if not exists podcast_episode_prepublish_drafts_status_updated_idx
on podcast_episode_prepublish_drafts (status, updated_at desc);

create index if not exists podcast_episode_prepublish_drafts_status_title_idx
on podcast_episode_prepublish_drafts (status, normalized_title);

create index if not exists podcast_episode_prepublish_drafts_ready_at_idx
on podcast_episode_prepublish_drafts (ready_to_match_at asc)
where status = 'ready_to_match';

create index if not exists podcast_episode_prepublish_drafts_matched_episode_idx
on podcast_episode_prepublish_drafts (matched_episode_id);

create unique index if not exists podcast_episode_prepublish_drafts_active_title_unique_idx
on podcast_episode_prepublish_drafts (normalized_title)
where status in ('draft', 'ready_to_match', 'needs_review', 'conflict')
  and archived_at is null
  and allow_title_collision = false;

create table if not exists podcast_episode_attach_snapshots (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references podcast_episode_prepublish_drafts(id) on delete cascade,
  episode_id uuid not null references podcast_episodes(id) on delete cascade,
  attach_method text not null check (attach_method in ('auto', 'manual', 'conflict_resolution', 'rollback')),
  actor_id text null,
  created_at timestamptz not null default now(),
  editorial_before jsonb not null default '{}'::jsonb,
  discovery_before jsonb not null default '[]'::jsonb,
  relationships_before jsonb not null default '[]'::jsonb,
  related_posts_before jsonb not null default '[]'::jsonb,
  editorial_before_updated_at timestamptz null,
  state_fingerprint text null,
  restored_at timestamptz null,
  restored_by text null,
  restore_note text null
);

create index if not exists podcast_episode_attach_snapshots_draft_idx
on podcast_episode_attach_snapshots (draft_id, created_at desc);

create index if not exists podcast_episode_attach_snapshots_episode_idx
on podcast_episode_attach_snapshots (episode_id, created_at desc);

create or replace function episode_state_fingerprint(p_episode_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  with editorial as (
    select coalesce(to_jsonb(e), '{}'::jsonb) as payload, e.updated_at
    from podcast_episode_editorial e
    where e.episode_id = p_episode_id
    limit 1
  ),
  discovery as (
    select coalesce(jsonb_agg(to_jsonb(d) order by d.sort_order asc, d.id asc), '[]'::jsonb) as payload
    from episode_discovery_terms d
    where d.episode_id = p_episode_id
  ),
  rel as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order asc, r.id asc), '[]'::jsonb) as payload
    from episode_relationships r
    where r.source_episode_id = p_episode_id
  ),
  posts as (
    select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order asc, p.id asc), '[]'::jsonb) as payload
    from episode_related_posts p
    where p.episode_id = p_episode_id
  )
  select md5(
    coalesce((select payload::text from editorial), '{}')
    || coalesce((select payload::text from discovery), '[]')
    || coalesce((select payload::text from rel), '[]')
    || coalesce((select payload::text from posts), '[]')
  );
$$;

create or replace function episode_has_meaningful_editorial_conflict(p_episode_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  with editorial_match as (
    select exists (
      select 1
      from podcast_episode_editorial e
      where e.episode_id = p_episode_id
        and (
          nullif(trim(coalesce(e.web_title, '')), '') is not null
          or nullif(trim(coalesce(e.web_slug, '')), '') is not null
          or nullif(trim(coalesce(e.excerpt, '')), '') is not null
          or jsonb_array_length(coalesce(e.body_json, '[]'::jsonb)) > 0
          or nullif(trim(coalesce(e.body_markdown, '')), '') is not null
          or nullif(trim(coalesce(e.hero_image_url, '')), '') is not null
          or nullif(trim(coalesce(e.hero_image_storage_path, '')), '') is not null
          or nullif(trim(coalesce(e.seo_title, '')), '') is not null
          or nullif(trim(coalesce(e.meta_description, '')), '') is not null
          or nullif(trim(coalesce(e.canonical_url_override, '')), '') is not null
          or nullif(trim(coalesce(e.social_title, '')), '') is not null
          or nullif(trim(coalesce(e.social_description, '')), '') is not null
          or nullif(trim(coalesce(e.social_image_url, '')), '') is not null
          or nullif(trim(coalesce(e.focus_keyword, '')), '') is not null
          or nullif(trim(coalesce(e.editorial_notes, '')), '') is not null
          or e.author_id is not null
          or e.noindex = true
          or e.nofollow = true
          or e.is_featured = true
          or e.is_visible = false
          or e.is_archived = true
        )
    ) as has_editorial
  ),
  discovery_match as (
    select exists (
      select 1
      from episode_discovery_terms d
      where d.episode_id = p_episode_id
    ) as has_discovery
  ),
  relationship_match as (
    select exists (
      select 1
      from episode_relationships r
      where r.source_episode_id = p_episode_id
    ) as has_relationships
  ),
  post_match as (
    select exists (
      select 1
      from episode_related_posts p
      where p.episode_id = p_episode_id
    ) as has_related_posts
  )
  select
    coalesce((select has_editorial from editorial_match), false)
    or coalesce((select has_discovery from discovery_match), false)
    or coalesce((select has_relationships from relationship_match), false)
    or coalesce((select has_related_posts from post_match), false);
$$;

create or replace function apply_episode_editorial_state(
  p_episode_id uuid,
  p_editorial jsonb,
  p_discovery jsonb,
  p_related_episodes jsonb,
  p_related_posts jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into podcast_episode_editorial (
    episode_id,
    author_id,
    web_title,
    web_slug,
    excerpt,
    body_json,
    body_markdown,
    hero_image_url,
    hero_image_storage_path,
    seo_title,
    meta_description,
    canonical_url_override,
    social_title,
    social_description,
    social_image_url,
    noindex,
    nofollow,
    is_featured,
    is_visible,
    is_archived,
    editorial_notes,
    focus_keyword,
    updated_at
  )
  values (
    p_episode_id,
    nullif(p_editorial->>'authorId', '')::uuid,
    nullif(p_editorial->>'webTitle', ''),
    nullif(p_editorial->>'webSlug', ''),
    nullif(p_editorial->>'excerpt', ''),
    coalesce(p_editorial->'bodyJson', '[]'::jsonb),
    nullif(p_editorial->>'bodyMarkdown', ''),
    nullif(p_editorial->>'heroImageUrl', ''),
    nullif(p_editorial->>'heroImageStoragePath', ''),
    nullif(p_editorial->>'seoTitle', ''),
    nullif(p_editorial->>'metaDescription', ''),
    nullif(p_editorial->>'canonicalUrlOverride', ''),
    nullif(p_editorial->>'socialTitle', ''),
    nullif(p_editorial->>'socialDescription', ''),
    nullif(p_editorial->>'socialImageUrl', ''),
    coalesce((p_editorial->>'noindex')::boolean, false),
    coalesce((p_editorial->>'nofollow')::boolean, false),
    coalesce((p_editorial->>'isFeatured')::boolean, false),
    coalesce((p_editorial->>'isVisible')::boolean, true),
    coalesce((p_editorial->>'isArchived')::boolean, false),
    nullif(p_editorial->>'editorialNotes', ''),
    nullif(p_editorial->>'focusKeyword', ''),
    now()
  )
  on conflict (episode_id) do update set
    author_id = excluded.author_id,
    web_title = excluded.web_title,
    web_slug = excluded.web_slug,
    excerpt = excluded.excerpt,
    body_json = excluded.body_json,
    body_markdown = excluded.body_markdown,
    hero_image_url = excluded.hero_image_url,
    hero_image_storage_path = excluded.hero_image_storage_path,
    seo_title = excluded.seo_title,
    meta_description = excluded.meta_description,
    canonical_url_override = excluded.canonical_url_override,
    social_title = excluded.social_title,
    social_description = excluded.social_description,
    social_image_url = excluded.social_image_url,
    noindex = excluded.noindex,
    nofollow = excluded.nofollow,
    is_featured = excluded.is_featured,
    is_visible = excluded.is_visible,
    is_archived = excluded.is_archived,
    editorial_notes = excluded.editorial_notes,
    focus_keyword = excluded.focus_keyword,
    updated_at = now();

  delete from episode_discovery_terms where episode_id = p_episode_id;

  with discovery_rows as (
    select
      (item->>'termId')::uuid as term_id,
      coalesce((item->>'isPrimary')::boolean, false) as is_primary,
      coalesce((item->>'sortOrder')::int, ord::int) as sort_order,
      ord
    from jsonb_array_elements(coalesce(p_discovery, '[]'::jsonb)) with ordinality as src(item, ord)
    where nullif(item->>'termId', '') is not null
  ),
  deduped_discovery as (
    select distinct on (term_id)
      term_id,
      is_primary,
      sort_order
    from discovery_rows
    order by term_id, ord asc
  )
  insert into episode_discovery_terms (episode_id, term_id, is_primary, sort_order)
  select p_episode_id, term_id, is_primary, sort_order
  from deduped_discovery;

  delete from episode_relationships where source_episode_id = p_episode_id;

  with relationship_rows as (
    select
      (item->>'episodeId')::uuid as episode_id,
      coalesce(nullif(item->>'relationshipType', ''), 'related') as relationship_type,
      coalesce((item->>'sortOrder')::int, ord::int) as sort_order,
      ord
    from jsonb_array_elements(coalesce(p_related_episodes, '[]'::jsonb)) with ordinality as src(item, ord)
    where nullif(item->>'episodeId', '') is not null
      and (item->>'episodeId')::uuid <> p_episode_id
  ),
  deduped_relationships as (
    select distinct on (episode_id)
      episode_id,
      relationship_type,
      sort_order
    from relationship_rows
    order by episode_id, ord asc
  )
  insert into episode_relationships (source_episode_id, target_episode_id, relationship_type, sort_order, is_manual)
  select p_episode_id, episode_id, relationship_type, sort_order, true
  from deduped_relationships;

  delete from episode_related_posts where episode_id = p_episode_id;

  with related_post_rows as (
    select
      (item->>'postId')::uuid as post_id,
      coalesce((item->>'sortOrder')::int, ord::int) as sort_order,
      ord
    from jsonb_array_elements(coalesce(p_related_posts, '[]'::jsonb)) with ordinality as src(item, ord)
    where nullif(item->>'postId', '') is not null
  ),
  deduped_related_posts as (
    select distinct on (post_id)
      post_id,
      sort_order
    from related_post_rows
    order by post_id, ord asc
  )
  insert into episode_related_posts (episode_id, blog_post_id, sort_order, is_manual)
  select p_episode_id, post_id, sort_order, true
  from deduped_related_posts;
end;
$$;

create or replace function attach_prepublish_draft_to_episode(
  p_draft_id uuid,
  p_episode_id uuid,
  p_actor text,
  p_attach_method text default 'manual',
  p_force_conflict boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft podcast_episode_prepublish_drafts%rowtype;
  v_target_episode_id uuid;
  v_conflict boolean;
  v_editorial_before jsonb := '{}'::jsonb;
  v_discovery_before jsonb := '[]'::jsonb;
  v_relationships_before jsonb := '[]'::jsonb;
  v_related_posts_before jsonb := '[]'::jsonb;
  v_editorial_before_updated_at timestamptz := null;
  v_state_fingerprint text := null;
  v_snapshot_id uuid;
begin
  select * into v_draft
  from podcast_episode_prepublish_drafts
  where id = p_draft_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found', 'error', 'Draft not found.');
  end if;

  if v_draft.status in ('attached', 'archived') then
    return jsonb_build_object(
      'status', 'terminal',
      'draftStatus', v_draft.status,
      'matchedEpisodeId', v_draft.matched_episode_id
    );
  end if;

  v_target_episode_id := coalesce(p_episode_id, v_draft.matched_episode_id);
  if v_target_episode_id is null then
    return jsonb_build_object('status', 'invalid', 'error', 'No target episode id provided.');
  end if;

  if not exists (select 1 from podcast_episodes where id = v_target_episode_id) then
    return jsonb_build_object('status', 'invalid', 'error', 'Target episode not found.');
  end if;

  perform 1
  from podcast_episodes
  where id = v_target_episode_id
  for update;

  v_conflict := episode_has_meaningful_editorial_conflict(v_target_episode_id);
  if v_conflict and not p_force_conflict then
    update podcast_episode_prepublish_drafts
    set
      status = 'conflict',
      review_reason = coalesce(review_reason, 'Existing live editorial content requires manual conflict resolution.'),
      candidate_episode_ids = array[v_target_episode_id],
      matched_episode_id = v_target_episode_id,
      updated_at = now(),
      last_match_attempt_at = now(),
      match_attempt_count = match_attempt_count + 1
    where id = p_draft_id;

    return jsonb_build_object('status', 'conflict', 'episodeId', v_target_episode_id::text);
  end if;

  select to_jsonb(e), e.updated_at
  into v_editorial_before, v_editorial_before_updated_at
  from podcast_episode_editorial e
  where e.episode_id = v_target_episode_id;

  if v_editorial_before is null then
    v_editorial_before := '{}'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(d) order by d.sort_order asc, d.id asc), '[]'::jsonb)
  into v_discovery_before
  from episode_discovery_terms d
  where d.episode_id = v_target_episode_id;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order asc, r.id asc), '[]'::jsonb)
  into v_relationships_before
  from episode_relationships r
  where r.source_episode_id = v_target_episode_id;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order asc, p.id asc), '[]'::jsonb)
  into v_related_posts_before
  from episode_related_posts p
  where p.episode_id = v_target_episode_id;

  v_state_fingerprint := md5(
    coalesce(v_editorial_before::text, '{}')
    || coalesce(v_discovery_before::text, '[]')
    || coalesce(v_relationships_before::text, '[]')
    || coalesce(v_related_posts_before::text, '[]')
  );

  insert into podcast_episode_attach_snapshots (
    draft_id,
    episode_id,
    attach_method,
    actor_id,
    editorial_before,
    discovery_before,
    relationships_before,
    related_posts_before,
    editorial_before_updated_at,
    state_fingerprint
  )
  values (
    p_draft_id,
    v_target_episode_id,
    coalesce(nullif(p_attach_method, ''), 'manual'),
    nullif(p_actor, ''),
    v_editorial_before,
    v_discovery_before,
    v_relationships_before,
    v_related_posts_before,
    v_editorial_before_updated_at,
    v_state_fingerprint
  )
  returning id into v_snapshot_id;

  perform apply_episode_editorial_state(
    v_target_episode_id,
    coalesce(v_draft.editorial_payload->'editorial', '{}'::jsonb),
    coalesce(v_draft.editorial_payload->'discovery', '[]'::jsonb),
    coalesce(v_draft.editorial_payload->'relatedEpisodes', '[]'::jsonb),
    coalesce(v_draft.editorial_payload->'relatedPosts', '[]'::jsonb)
  );

  update podcast_episode_prepublish_drafts
  set
    status = 'attached',
    matched_episode_id = v_target_episode_id,
    matched_at = now(),
    attach_method = coalesce(nullif(p_attach_method, ''), 'manual'),
    attached_by = nullif(p_actor, ''),
    resolved_by = case when status = 'conflict' then nullif(p_actor, '') else resolved_by end,
    resolved_at = case when status = 'conflict' then now() else resolved_at end,
    updated_at = now(),
    last_match_attempt_at = now(),
    match_attempt_count = match_attempt_count + 1,
    candidate_episode_ids = array[v_target_episode_id],
    review_reason = null
  where id = p_draft_id;

  return jsonb_build_object(
    'status', 'attached',
    'episodeId', v_target_episode_id::text,
    'snapshotId', v_snapshot_id::text
  );
end;
$$;

create or replace function restore_episode_state_from_attach_snapshot(
  p_snapshot_id uuid,
  p_actor text,
  p_force boolean default false,
  p_restore_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot podcast_episode_attach_snapshots%rowtype;
  v_current_fingerprint text;
  v_is_stale boolean;
  v_editorial jsonb := '{}'::jsonb;
  v_discovery jsonb := '[]'::jsonb;
  v_relationships jsonb := '[]'::jsonb;
  v_related_posts jsonb := '[]'::jsonb;
begin
  select * into v_snapshot
  from podcast_episode_attach_snapshots
  where id = p_snapshot_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found', 'error', 'Snapshot not found.');
  end if;

  v_current_fingerprint := episode_state_fingerprint(v_snapshot.episode_id);
  v_is_stale := v_snapshot.state_fingerprint is not null
    and v_current_fingerprint is not null
    and v_current_fingerprint <> v_snapshot.state_fingerprint;

  if v_is_stale and not p_force then
    return jsonb_build_object(
      'status', 'stale',
      'error', 'Episode state changed since snapshot creation. Force restore required.',
      'episodeId', v_snapshot.episode_id::text,
      'snapshotFingerprint', v_snapshot.state_fingerprint,
      'currentFingerprint', v_current_fingerprint
    );
  end if;

  if coalesce(v_snapshot.editorial_before, '{}'::jsonb) <> '{}'::jsonb then
    v_editorial := jsonb_build_object(
      'authorId', coalesce(v_snapshot.editorial_before->>'author_id', ''),
      'webTitle', coalesce(v_snapshot.editorial_before->>'web_title', ''),
      'webSlug', coalesce(v_snapshot.editorial_before->>'web_slug', ''),
      'excerpt', coalesce(v_snapshot.editorial_before->>'excerpt', ''),
      'bodyJson', coalesce(v_snapshot.editorial_before->'body_json', '[]'::jsonb),
      'bodyMarkdown', coalesce(v_snapshot.editorial_before->>'body_markdown', ''),
      'heroImageUrl', coalesce(v_snapshot.editorial_before->>'hero_image_url', ''),
      'heroImageStoragePath', coalesce(v_snapshot.editorial_before->>'hero_image_storage_path', ''),
      'seoTitle', coalesce(v_snapshot.editorial_before->>'seo_title', ''),
      'metaDescription', coalesce(v_snapshot.editorial_before->>'meta_description', ''),
      'canonicalUrlOverride', coalesce(v_snapshot.editorial_before->>'canonical_url_override', ''),
      'socialTitle', coalesce(v_snapshot.editorial_before->>'social_title', ''),
      'socialDescription', coalesce(v_snapshot.editorial_before->>'social_description', ''),
      'socialImageUrl', coalesce(v_snapshot.editorial_before->>'social_image_url', ''),
      'noindex', coalesce((v_snapshot.editorial_before->>'noindex')::boolean, false),
      'nofollow', coalesce((v_snapshot.editorial_before->>'nofollow')::boolean, false),
      'isFeatured', coalesce((v_snapshot.editorial_before->>'is_featured')::boolean, false),
      'isVisible', coalesce((v_snapshot.editorial_before->>'is_visible')::boolean, true),
      'isArchived', coalesce((v_snapshot.editorial_before->>'is_archived')::boolean, false),
      'editorialNotes', coalesce(v_snapshot.editorial_before->>'editorial_notes', ''),
      'focusKeyword', coalesce(v_snapshot.editorial_before->>'focus_keyword', '')
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'termId', item->>'term_id',
    'isPrimary', coalesce((item->>'is_primary')::boolean, false),
    'sortOrder', coalesce((item->>'sort_order')::int, 0)
  )), '[]'::jsonb)
  into v_discovery
  from jsonb_array_elements(coalesce(v_snapshot.discovery_before, '[]'::jsonb)) as item;

  select coalesce(jsonb_agg(jsonb_build_object(
    'episodeId', item->>'target_episode_id',
    'relationshipType', coalesce(item->>'relationship_type', 'related'),
    'sortOrder', coalesce((item->>'sort_order')::int, 0)
  )), '[]'::jsonb)
  into v_relationships
  from jsonb_array_elements(coalesce(v_snapshot.relationships_before, '[]'::jsonb)) as item;

  select coalesce(jsonb_agg(jsonb_build_object(
    'postId', item->>'blog_post_id',
    'sortOrder', coalesce((item->>'sort_order')::int, 0)
  )), '[]'::jsonb)
  into v_related_posts
  from jsonb_array_elements(coalesce(v_snapshot.related_posts_before, '[]'::jsonb)) as item;

  perform apply_episode_editorial_state(
    v_snapshot.episode_id,
    v_editorial,
    v_discovery,
    v_relationships,
    v_related_posts
  );

  if coalesce(v_snapshot.editorial_before, '{}'::jsonb) = '{}'::jsonb then
    delete from podcast_episode_editorial
    where episode_id = v_snapshot.episode_id;
  end if;

  update podcast_episode_attach_snapshots
  set
    restored_at = now(),
    restored_by = nullif(p_actor, ''),
    restore_note = nullif(p_restore_note, '')
  where id = v_snapshot.id;

  return jsonb_build_object(
    'status', 'restored',
    'episodeId', v_snapshot.episode_id::text,
    'snapshotId', v_snapshot.id::text,
    'forced', p_force
  );
end;
$$;

drop trigger if exists podcast_episode_editorial_set_updated_at on podcast_episode_editorial;
create trigger podcast_episode_editorial_set_updated_at
before update on podcast_episode_editorial
for each row execute function set_updated_at();

drop trigger if exists podcast_episode_prepublish_drafts_set_updated_at on podcast_episode_prepublish_drafts;
create trigger podcast_episode_prepublish_drafts_set_updated_at
before update on podcast_episode_prepublish_drafts
for each row execute function set_updated_at();

alter table discovery_terms enable row level security;
alter table podcast_episode_editorial enable row level security;
alter table episode_discovery_terms enable row level security;
alter table episode_relationships enable row level security;
alter table episode_related_posts enable row level security;
alter table podcast_episode_prepublish_drafts enable row level security;
alter table podcast_episode_attach_snapshots enable row level security;

drop policy if exists "no direct discovery_terms access" on discovery_terms;
create policy "no direct discovery_terms access" on discovery_terms
for all using (false) with check (false);

drop policy if exists "no direct podcast_episode_editorial access" on podcast_episode_editorial;
create policy "no direct podcast_episode_editorial access" on podcast_episode_editorial
for all using (false) with check (false);

drop policy if exists "no direct episode_discovery_terms access" on episode_discovery_terms;
create policy "no direct episode_discovery_terms access" on episode_discovery_terms
for all using (false) with check (false);

drop policy if exists "no direct episode_relationships access" on episode_relationships;
create policy "no direct episode_relationships access" on episode_relationships
for all using (false) with check (false);

drop policy if exists "no direct episode_related_posts access" on episode_related_posts;
create policy "no direct episode_related_posts access" on episode_related_posts
for all using (false) with check (false);

drop policy if exists "no direct podcast_episode_prepublish_drafts access" on podcast_episode_prepublish_drafts;
create policy "no direct podcast_episode_prepublish_drafts access" on podcast_episode_prepublish_drafts
for all using (false) with check (false);

drop policy if exists "no direct podcast_episode_attach_snapshots access" on podcast_episode_attach_snapshots;
create policy "no direct podcast_episode_attach_snapshots access" on podcast_episode_attach_snapshots
for all using (false) with check (false);
