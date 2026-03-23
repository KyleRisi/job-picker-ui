-- Freaky Register import script
--
-- Purpose:
-- 1) Import historical suggestions from staging CSV data
-- 2) Create/attach identities from emails
-- 3) Import historical votes (optional)
-- 4) Recalculate upvote counts
--
-- How to use:
-- A) Run this script once to create staging tables.
-- B) Upload CSVs into staging tables:
--    - docs/templates/freaky-suggestions-import-template.csv -> freaky_import_suggestions_staging
--    - docs/templates/freaky-votes-import-template.csv       -> freaky_import_votes_staging (optional)
-- C) Run this script again to execute import steps.
-- D) Verify results in freaky_suggestions + freaky_votes.
--
-- Notes:
-- - external_key is your stable ID from legacy source and is required.
-- - topic resolution order: topic_term_id -> topic_slug -> topic_name (active topic terms only).
-- - submitted_name is set to submitted_full_name.
-- - duplicate_of_external_key is optional and resolved after suggestion insert.

begin;

create table if not exists freaky_import_suggestions_staging (
  external_key text primary key,
  title text not null,
  description text not null,
  status text not null default 'published',
  is_visible boolean not null default true,
  created_at timestamptz null,
  submitted_full_name text not null default '',
  submitted_country text not null default '',
  submitter_email text null,
  topic_term_id text null,
  topic_slug text null,
  topic_name text null,
  duplicate_of_external_key text null
);

create table if not exists freaky_import_votes_staging (
  suggestion_external_key text not null,
  voter_email text not null,
  created_at timestamptz null
);

create index if not exists freaky_import_votes_external_key_idx
on freaky_import_votes_staging (suggestion_external_key);

create table if not exists freaky_import_suggestion_map (
  external_key text primary key,
  suggestion_id uuid not null references freaky_suggestions(id) on delete cascade,
  imported_at timestamptz not null default now()
);

-- Upsert identities from submitters and voters.
with import_emails as (
  select lower(trim(submitter_email)) as email
  from freaky_import_suggestions_staging
  where coalesce(trim(submitter_email), '') <> ''
  union
  select lower(trim(voter_email)) as email
  from freaky_import_votes_staging
  where coalesce(trim(voter_email), '') <> ''
)
insert into freaky_identities (
  email,
  email_normalized,
  email_verified_at,
  created_at,
  updated_at,
  last_seen_at
)
select
  email,
  email,
  now(),
  now(),
  now(),
  now()
from import_emails
where email <> ''
on conflict (email_normalized)
do update set
  last_seen_at = now();

-- Insert suggestions row-by-row so each external_key can be mapped safely.
do $$
declare
  r record;
  v_identity_id uuid;
  v_topic_id uuid;
  v_topic_slug text;
  v_topic_name text;
  v_suggestion_id uuid;
  v_status text;
  v_visible boolean;
  v_created timestamptz;
begin
  for r in
    select *
    from freaky_import_suggestions_staging
    order by coalesce(created_at, now()), external_key
  loop
    v_identity_id := null;
    v_topic_id := null;
    v_topic_slug := '';
    v_topic_name := '';
    v_status := case
      when r.status in ('pending_verification','published','hidden','spam','removed','duplicate','expired_unverified') then r.status
      else 'published'
    end;
    v_visible := case
      when v_status = 'published' then coalesce(r.is_visible, true)
      else false
    end;
    v_created := coalesce(r.created_at, now());

    if coalesce(trim(r.submitter_email), '') <> '' then
      select id into v_identity_id
      from freaky_identities
      where email_normalized = lower(trim(r.submitter_email))
      limit 1;
    end if;

    -- Topic resolution order: term id -> slug -> name
    if coalesce(trim(r.topic_term_id), '') <> '' then
      select dt.id, dt.slug, dt.name
      into v_topic_id, v_topic_slug, v_topic_name
      from discovery_terms dt
      where dt.id::text = trim(r.topic_term_id)
        and dt.term_type = 'topic'
        and dt.is_active = true
      limit 1;
    end if;

    if v_topic_id is null and coalesce(trim(r.topic_slug), '') <> '' then
      select dt.id, dt.slug, dt.name
      into v_topic_id, v_topic_slug, v_topic_name
      from discovery_terms dt
      where lower(dt.slug) = lower(trim(r.topic_slug))
        and dt.term_type = 'topic'
        and dt.is_active = true
      limit 1;
    end if;

    if v_topic_id is null and coalesce(trim(r.topic_name), '') <> '' then
      select dt.id, dt.slug, dt.name
      into v_topic_id, v_topic_slug, v_topic_name
      from discovery_terms dt
      where lower(dt.name) = lower(trim(r.topic_name))
        and dt.term_type = 'topic'
        and dt.is_active = true
      limit 1;
    end if;

    insert into freaky_suggestions (
      title,
      title_normalized,
      description,
      status,
      is_visible,
      upvote_count,
      submitted_by_identity_id,
      verification_completed_at,
      created_at,
      updated_at,
      submitted_name,
      submitted_full_name,
      submitted_country,
      topic_term_id,
      topic_slug,
      topic_name
    ) values (
      trim(r.title),
      normalize_freaky_title(r.title),
      trim(r.description),
      v_status,
      v_visible,
      0,
      v_identity_id,
      case when v_status = 'published' then v_created else null end,
      v_created,
      now(),
      trim(coalesce(r.submitted_full_name, '')),
      trim(coalesce(r.submitted_full_name, '')),
      trim(coalesce(r.submitted_country, '')),
      v_topic_id,
      coalesce(v_topic_slug, ''),
      coalesce(v_topic_name, '')
    ) returning id into v_suggestion_id;

    insert into freaky_import_suggestion_map (external_key, suggestion_id, imported_at)
    values (r.external_key, v_suggestion_id, now())
    on conflict (external_key)
    do update set suggestion_id = excluded.suggestion_id, imported_at = excluded.imported_at;
  end loop;
end $$;

-- Resolve duplicate links using external_key mapping.
update freaky_suggestions s
set
  duplicate_of_suggestion_id = m2.suggestion_id,
  status = case when s.status = 'published' then 'duplicate' else s.status end,
  is_visible = case when s.status = 'published' then false else s.is_visible end,
  updated_at = now()
from freaky_import_suggestion_map m1
join freaky_import_suggestions_staging src on src.external_key = m1.external_key
join freaky_import_suggestion_map m2 on m2.external_key = src.duplicate_of_external_key
where s.id = m1.suggestion_id
  and coalesce(src.duplicate_of_external_key, '') <> '';

-- Insert votes (optional) with one-vote-per-identity protection.
insert into freaky_votes (
  suggestion_id,
  identity_id,
  created_at
)
select
  m.suggestion_id,
  i.id,
  coalesce(v.created_at, now())
from freaky_import_votes_staging v
join freaky_import_suggestion_map m
  on m.external_key = v.suggestion_external_key
join freaky_identities i
  on i.email_normalized = lower(trim(v.voter_email))
where coalesce(trim(v.voter_email), '') <> ''
on conflict (suggestion_id, identity_id) do nothing;

-- Recalculate upvote_count for imported suggestions.
update freaky_suggestions s
set upvote_count = v.vote_count,
    updated_at = now()
from (
  select suggestion_id, count(*)::integer as vote_count
  from freaky_votes
  group by suggestion_id
) v
where s.id = v.suggestion_id
  and s.id in (select suggestion_id from freaky_import_suggestion_map);

update freaky_suggestions s
set upvote_count = 0,
    updated_at = now()
where s.id in (select suggestion_id from freaky_import_suggestion_map)
  and not exists (
    select 1
    from freaky_votes v
    where v.suggestion_id = s.id
  );

commit;

-- Optional verification queries:
-- select count(*) from freaky_import_suggestions_staging;
-- select count(*) from freaky_suggestions where id in (select suggestion_id from freaky_import_suggestion_map);
-- select count(*) from freaky_votes where suggestion_id in (select suggestion_id from freaky_import_suggestion_map);
