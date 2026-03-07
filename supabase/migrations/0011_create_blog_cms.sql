create extension if not exists pg_trgm;
create extension if not exists unaccent;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'blog_post_status') then
    create type blog_post_status as enum ('draft', 'scheduled', 'published', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'episode_sync_status') then
    create type episode_sync_status as enum ('running', 'succeeded', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'import_job_status') then
    create type import_job_status as enum ('pending', 'previewed', 'running', 'succeeded', 'failed', 'partial');
  end if;

  if not exists (select 1 from pg_type where typname = 'blog_analytics_event_type') then
    create type blog_analytics_event_type as enum (
      'pageview',
      'scroll_depth',
      'cta_click',
      'platform_click',
      'patreon_click',
      'listen_start',
      'search_result_click'
    );
  end if;
end
$$;

alter table redirects
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_ref text null;

create index if not exists redirects_source_type_idx
on redirects (source_type, updated_at desc);

create table if not exists blog_authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  bio text not null default '',
  image_url text null,
  image_asset_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  mime_type text not null,
  width int null,
  height int null,
  alt_text_default text not null default '',
  caption_default text not null default '',
  credit_source text not null default '',
  focal_x numeric(5,2) null,
  focal_y numeric(5,2) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table blog_authors
  add constraint blog_authors_image_asset_id_fkey
  foreign key (image_asset_id) references media_assets(id) on delete set null;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  parent_id uuid null references categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists series (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists topic_clusters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  pillar_post_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists post_labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  rss_guid text not null unique,
  title text not null,
  slug text not null unique,
  description_plain text not null default '',
  description_html text not null default '',
  published_at timestamptz null,
  audio_url text not null default '',
  artwork_url text null,
  transcript text not null default '',
  show_notes text not null default '',
  is_visible boolean not null default true,
  is_archived boolean not null default false,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  status blog_post_status not null default 'draft',
  excerpt text null,
  excerpt_auto text null,
  excerpt_plain text not null default '',
  content_json jsonb not null default '[]'::jsonb,
  content_markdown text null,
  featured_image_id uuid null references media_assets(id) on delete set null,
  author_id uuid not null references blog_authors(id) on delete restrict,
  published_at timestamptz null,
  scheduled_at timestamptz null,
  archived_at timestamptz null,
  reading_time_minutes int null,
  is_featured boolean not null default false,
  primary_category_id uuid null references categories(id) on delete set null,
  canonical_url text null,
  noindex boolean not null default false,
  nofollow boolean not null default false,
  seo_title text null,
  seo_description text null,
  social_title text null,
  social_description text null,
  og_image_id uuid null references media_assets(id) on delete set null,
  focus_keyword text null,
  seo_score int null,
  schema_type text null default 'BlogPosting',
  toc_json jsonb not null default '[]'::jsonb,
  heading_outline jsonb not null default '[]'::jsonb,
  seo_warnings jsonb not null default '[]'::jsonb,
  search_plaintext text not null default '',
  search_document tsvector not null default to_tsvector('simple', ''),
  related_override_enabled boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists blog_posts_slug_unique_live_idx
on blog_posts (slug)
where deleted_at is null;

create index if not exists blog_posts_status_publish_idx
on blog_posts (status, published_at desc nulls last);

create index if not exists blog_posts_scheduled_idx
on blog_posts (scheduled_at asc)
where status = 'scheduled' and deleted_at is null;

create index if not exists blog_posts_featured_idx
on blog_posts (is_featured, published_at desc)
where deleted_at is null;

create index if not exists blog_posts_search_document_idx
on blog_posts using gin (search_document);

create index if not exists blog_posts_search_plaintext_trgm_idx
on blog_posts using gin (search_plaintext gin_trgm_ops);

create index if not exists blog_posts_title_trgm_idx
on blog_posts using gin (title gin_trgm_ops);

alter table topic_clusters
  add constraint topic_clusters_pillar_post_id_fkey
  foreign key (pillar_post_id) references blog_posts(id) on delete set null;

create table if not exists blog_post_categories (
  post_id uuid not null references blog_posts(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, category_id)
);

create table if not exists blog_post_tags (
  post_id uuid not null references blog_posts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tag_id)
);

create table if not exists blog_post_series (
  post_id uuid not null references blog_posts(id) on delete cascade,
  series_id uuid not null references series(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, series_id)
);

create table if not exists blog_post_topic_clusters (
  post_id uuid not null references blog_posts(id) on delete cascade,
  topic_cluster_id uuid not null references topic_clusters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, topic_cluster_id)
);

create table if not exists blog_post_labels (
  post_id uuid not null references blog_posts(id) on delete cascade,
  label_id uuid not null references post_labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, label_id)
);

create table if not exists blog_post_episode_links (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references blog_posts(id) on delete cascade,
  episode_id uuid not null references podcast_episodes(id) on delete restrict,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (post_id, episode_id)
);

create unique index if not exists blog_post_episode_primary_unique_idx
on blog_post_episode_links (post_id)
where is_primary = true;

create table if not exists blog_post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references blog_posts(id) on delete cascade,
  revision_number int not null,
  title_snapshot text not null,
  excerpt_snapshot text null,
  content_json_snapshot jsonb not null default '[]'::jsonb,
  content_markdown_snapshot text null,
  seo_snapshot jsonb not null default '{}'::jsonb,
  taxonomy_snapshot jsonb not null default '{}'::jsonb,
  linked_episodes_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (post_id, revision_number)
);

create table if not exists blog_post_slug_history (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references blog_posts(id) on delete cascade,
  slug text not null,
  redirect_id uuid null references redirects(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (post_id, slug)
);

create table if not exists blog_post_related_overrides (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references blog_posts(id) on delete cascade,
  related_post_id uuid not null references blog_posts(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (post_id, related_post_id)
);

create table if not exists episode_sync_logs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  status episode_sync_status not null default 'running',
  records_added int not null default 0,
  records_updated int not null default 0,
  records_skipped int not null default 0,
  error_summary text not null default ''
);

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  status import_job_status not null default 'pending',
  records_created int not null default 0,
  records_failed int not null default 0,
  log_output text not null default '',
  payload jsonb not null default '{}'::jsonb
);

create table if not exists import_job_records (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references import_jobs(id) on delete cascade,
  source_key text not null,
  source_url text null,
  source_title text not null default '',
  target_post_id uuid null references blog_posts(id) on delete set null,
  status text not null default 'pending',
  message text not null default '',
  preview_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_job_id, source_key)
);

create table if not exists blog_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type blog_analytics_event_type not null,
  post_id uuid null references blog_posts(id) on delete cascade,
  episode_id uuid null references podcast_episodes(id) on delete set null,
  session_id text not null,
  path text not null,
  referrer text not null default '',
  search_query text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists blog_analytics_events_post_idx
on blog_analytics_events (post_id, occurred_at desc);

create index if not exists blog_analytics_events_session_idx
on blog_analytics_events (session_id, occurred_at desc);

create index if not exists blog_analytics_events_type_idx
on blog_analytics_events (event_type, occurred_at desc);

create or replace view blog_analytics_post_totals as
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
from blog_posts p
left join blog_analytics_events e on e.post_id = p.id
group by p.id, p.slug, p.title;

create or replace view blog_analytics_episode_totals as
select
  pe.id as episode_id,
  pe.slug,
  pe.title,
  count(*) filter (where e.event_type = 'platform_click') as platform_clicks,
  count(*) filter (where e.event_type = 'listen_start') as listens_started,
  max(e.occurred_at) as last_event_at
from podcast_episodes pe
left join blog_analytics_events e on e.episode_id = pe.id
group by pe.id, pe.slug, pe.title;

create or replace function search_blog_posts(
  p_query text,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  excerpt text,
  published_at timestamptz,
  featured_image_id uuid,
  author_slug text,
  author_name text,
  rank real,
  similarity real
)
language sql
stable
set search_path = public
as $$
  with query_input as (
    select trim(coalesce(p_query, '')) as raw_q
  ),
  query_parts as (
    select
      raw_q,
      websearch_to_tsquery('english', raw_q) as tsq
    from query_input
    where raw_q <> ''
  )
  select
    p.id,
    p.slug,
    p.title,
    coalesce(nullif(p.excerpt, ''), nullif(p.excerpt_auto, ''), p.excerpt_plain) as excerpt,
    p.published_at,
    p.featured_image_id,
    a.slug as author_slug,
    a.name as author_name,
    ts_rank_cd(p.search_document, qp.tsq)::real as rank,
    greatest(
      similarity(p.title, qp.raw_q),
      similarity(p.search_plaintext, qp.raw_q)
    )::real as similarity
  from blog_posts p
  join blog_authors a on a.id = p.author_id
  join query_parts qp on true
  where p.deleted_at is null
    and p.status = 'published'
    and coalesce(p.published_at, now()) <= now()
    and (
      p.search_document @@ qp.tsq
      or p.title % qp.raw_q
      or p.search_plaintext % qp.raw_q
    )
  order by
    (ts_rank_cd(p.search_document, qp.tsq) * 1.8)
    + greatest(similarity(p.title, qp.raw_q), similarity(p.search_plaintext, qp.raw_q)) desc,
    p.published_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function publish_due_blog_posts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count int := 0;
begin
  update blog_posts
  set
    status = 'published',
    published_at = coalesce(published_at, scheduled_at, now()),
    updated_at = now()
  where deleted_at is null
    and status = 'scheduled'
    and scheduled_at is not null
    and scheduled_at <= now();

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

create or replace function set_blog_post_search_document()
returns trigger
language plpgsql
as $$
begin
  new.search_document :=
    setweight(to_tsvector('english', unaccent(coalesce(new.title, ''))), 'A')
    || setweight(to_tsvector('english', unaccent(coalesce(new.excerpt_plain, ''))), 'B')
    || setweight(to_tsvector('english', unaccent(coalesce(new.search_plaintext, ''))), 'C');
  return new;
end;
$$;

drop trigger if exists blog_authors_set_updated_at on blog_authors;
create trigger blog_authors_set_updated_at
before update on blog_authors
for each row execute function set_updated_at();

drop trigger if exists media_assets_set_updated_at on media_assets;
create trigger media_assets_set_updated_at
before update on media_assets
for each row execute function set_updated_at();

drop trigger if exists categories_set_updated_at on categories;
create trigger categories_set_updated_at
before update on categories
for each row execute function set_updated_at();

drop trigger if exists tags_set_updated_at on tags;
create trigger tags_set_updated_at
before update on tags
for each row execute function set_updated_at();

drop trigger if exists series_set_updated_at on series;
create trigger series_set_updated_at
before update on series
for each row execute function set_updated_at();

drop trigger if exists topic_clusters_set_updated_at on topic_clusters;
create trigger topic_clusters_set_updated_at
before update on topic_clusters
for each row execute function set_updated_at();

drop trigger if exists post_labels_set_updated_at on post_labels;
create trigger post_labels_set_updated_at
before update on post_labels
for each row execute function set_updated_at();

drop trigger if exists podcast_episodes_set_updated_at on podcast_episodes;
create trigger podcast_episodes_set_updated_at
before update on podcast_episodes
for each row execute function set_updated_at();

drop trigger if exists blog_posts_set_updated_at on blog_posts;
create trigger blog_posts_set_updated_at
before update on blog_posts
for each row execute function set_updated_at();

drop trigger if exists blog_posts_set_search_document on blog_posts;
create trigger blog_posts_set_search_document
before insert or update on blog_posts
for each row execute function set_blog_post_search_document();

drop trigger if exists import_job_records_set_updated_at on import_job_records;
create trigger import_job_records_set_updated_at
before update on import_job_records
for each row execute function set_updated_at();

alter table blog_authors enable row level security;
alter table media_assets enable row level security;
alter table categories enable row level security;
alter table tags enable row level security;
alter table series enable row level security;
alter table topic_clusters enable row level security;
alter table post_labels enable row level security;
alter table podcast_episodes enable row level security;
alter table blog_posts enable row level security;
alter table blog_post_categories enable row level security;
alter table blog_post_tags enable row level security;
alter table blog_post_series enable row level security;
alter table blog_post_topic_clusters enable row level security;
alter table blog_post_labels enable row level security;
alter table blog_post_episode_links enable row level security;
alter table blog_post_revisions enable row level security;
alter table blog_post_slug_history enable row level security;
alter table blog_post_related_overrides enable row level security;
alter table episode_sync_logs enable row level security;
alter table import_jobs enable row level security;
alter table import_job_records enable row level security;
alter table blog_analytics_events enable row level security;

drop policy if exists "no direct blog_authors access" on blog_authors;
create policy "no direct blog_authors access" on blog_authors
for all using (false) with check (false);

drop policy if exists "no direct media_assets access" on media_assets;
create policy "no direct media_assets access" on media_assets
for all using (false) with check (false);

drop policy if exists "no direct categories access" on categories;
create policy "no direct categories access" on categories
for all using (false) with check (false);

drop policy if exists "no direct tags access" on tags;
create policy "no direct tags access" on tags
for all using (false) with check (false);

drop policy if exists "no direct series access" on series;
create policy "no direct series access" on series
for all using (false) with check (false);

drop policy if exists "no direct topic_clusters access" on topic_clusters;
create policy "no direct topic_clusters access" on topic_clusters
for all using (false) with check (false);

drop policy if exists "no direct post_labels access" on post_labels;
create policy "no direct post_labels access" on post_labels
for all using (false) with check (false);

drop policy if exists "no direct podcast_episodes access" on podcast_episodes;
create policy "no direct podcast_episodes access" on podcast_episodes
for all using (false) with check (false);

drop policy if exists "no direct blog_posts access" on blog_posts;
create policy "no direct blog_posts access" on blog_posts
for all using (false) with check (false);

drop policy if exists "no direct blog_post_categories access" on blog_post_categories;
create policy "no direct blog_post_categories access" on blog_post_categories
for all using (false) with check (false);

drop policy if exists "no direct blog_post_tags access" on blog_post_tags;
create policy "no direct blog_post_tags access" on blog_post_tags
for all using (false) with check (false);

drop policy if exists "no direct blog_post_series access" on blog_post_series;
create policy "no direct blog_post_series access" on blog_post_series
for all using (false) with check (false);

drop policy if exists "no direct blog_post_topic_clusters access" on blog_post_topic_clusters;
create policy "no direct blog_post_topic_clusters access" on blog_post_topic_clusters
for all using (false) with check (false);

drop policy if exists "no direct blog_post_labels access" on blog_post_labels;
create policy "no direct blog_post_labels access" on blog_post_labels
for all using (false) with check (false);

drop policy if exists "no direct blog_post_episode_links access" on blog_post_episode_links;
create policy "no direct blog_post_episode_links access" on blog_post_episode_links
for all using (false) with check (false);

drop policy if exists "no direct blog_post_revisions access" on blog_post_revisions;
create policy "no direct blog_post_revisions access" on blog_post_revisions
for all using (false) with check (false);

drop policy if exists "no direct blog_post_slug_history access" on blog_post_slug_history;
create policy "no direct blog_post_slug_history access" on blog_post_slug_history
for all using (false) with check (false);

drop policy if exists "no direct blog_post_related_overrides access" on blog_post_related_overrides;
create policy "no direct blog_post_related_overrides access" on blog_post_related_overrides
for all using (false) with check (false);

drop policy if exists "no direct episode_sync_logs access" on episode_sync_logs;
create policy "no direct episode_sync_logs access" on episode_sync_logs
for all using (false) with check (false);

drop policy if exists "no direct import_jobs access" on import_jobs;
create policy "no direct import_jobs access" on import_jobs
for all using (false) with check (false);

drop policy if exists "no direct import_job_records access" on import_job_records;
create policy "no direct import_job_records access" on import_job_records
for all using (false) with check (false);

drop policy if exists "no direct blog_analytics_events access" on blog_analytics_events;
create policy "no direct blog_analytics_events access" on blog_analytics_events
for all using (false) with check (false);

insert into blog_authors (name, slug, bio)
values ('Kyle', 'kyle', 'Host and writer for The Compendium podcast.')
on conflict (slug) do nothing;
