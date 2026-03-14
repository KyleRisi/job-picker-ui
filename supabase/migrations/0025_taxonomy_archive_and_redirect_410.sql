alter table categories
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz null,
  add column if not exists archive_mode text null,
  add column if not exists redirect_target text null;

alter table tags
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz null,
  add column if not exists archive_mode text null,
  add column if not exists redirect_target text null;

alter table series
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz null,
  add column if not exists archive_mode text null,
  add column if not exists redirect_target text null;

alter table topic_clusters
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz null,
  add column if not exists archive_mode text null,
  add column if not exists redirect_target text null;

alter table blog_authors
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz null,
  add column if not exists archive_mode text null,
  add column if not exists redirect_target text null;

alter table redirects drop constraint if exists redirects_status_code_check;
alter table redirects
  add constraint redirects_status_code_check
  check (status_code in (301, 302, 307, 308, 410));

alter table redirects
  alter column target_url drop not null;

create table if not exists taxonomy_archive_events (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null default '',
  actor_email text not null default '',
  taxonomy_kind text not null,
  taxonomy_id uuid not null,
  source_url text not null,
  archive_mode text not null,
  redirect_target text null,
  merge_target_id uuid null,
  affected_association_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists taxonomy_archive_events_kind_created_idx
on taxonomy_archive_events (taxonomy_kind, created_at desc);

alter table taxonomy_archive_events enable row level security;

drop policy if exists "no direct taxonomy_archive_events access" on taxonomy_archive_events;
create policy "no direct taxonomy_archive_events access" on taxonomy_archive_events
for all using (false) with check (false);
