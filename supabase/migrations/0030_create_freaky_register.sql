create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists freaky_identities (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null unique,
  email_verified_at timestamptz null,
  is_blocked boolean not null default false,
  blocked_at timestamptz null,
  block_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists freaky_identities_email_verified_idx
on freaky_identities (email_verified_at desc);

create index if not exists freaky_identities_blocked_idx
on freaky_identities (is_blocked, updated_at desc);

create table if not exists freaky_suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_normalized text not null,
  description text not null,
  status text not null default 'pending_verification' check (
    status in ('pending_verification', 'published', 'hidden', 'spam', 'removed', 'duplicate', 'expired_unverified')
  ),
  is_visible boolean not null default false,
  upvote_count integer not null default 0 check (upvote_count >= 0),
  submitted_by_identity_id uuid null references freaky_identities(id) on delete set null,
  verification_completed_at timestamptz null,
  duplicate_of_suggestion_id uuid null references freaky_suggestions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists freaky_suggestions_visibility_sort_idx
on freaky_suggestions (is_visible, status, upvote_count desc, created_at desc);

create index if not exists freaky_suggestions_newest_idx
on freaky_suggestions (created_at desc);

create index if not exists freaky_suggestions_title_norm_idx
on freaky_suggestions (title_normalized);

create index if not exists freaky_suggestions_title_norm_trgm_idx
on freaky_suggestions using gin (title_normalized gin_trgm_ops);

create index if not exists freaky_suggestions_description_trgm_idx
on freaky_suggestions using gin (description gin_trgm_ops);

create table if not exists freaky_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('publish_suggestion', 'cast_vote')),
  token_hash text not null unique,
  identity_id uuid not null references freaky_identities(id) on delete cascade,
  suggestion_id uuid null references freaky_suggestions(id) on delete cascade,
  request_ip text not null default '',
  user_agent text not null default '',
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists freaky_verification_tokens_lookup_idx
on freaky_verification_tokens (token_hash, expires_at desc);

create index if not exists freaky_verification_tokens_identity_purpose_idx
on freaky_verification_tokens (identity_id, purpose, created_at desc);

create index if not exists freaky_verification_tokens_cleanup_idx
on freaky_verification_tokens (consumed_at, expires_at, created_at);

create table if not exists freaky_votes (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references freaky_suggestions(id) on delete cascade,
  identity_id uuid not null references freaky_identities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (suggestion_id, identity_id)
);

create index if not exists freaky_votes_suggestion_idx
on freaky_votes (suggestion_id, created_at desc);

create index if not exists freaky_votes_identity_idx
on freaky_votes (identity_id, created_at desc);

alter table freaky_identities enable row level security;
alter table freaky_suggestions enable row level security;
alter table freaky_verification_tokens enable row level security;
alter table freaky_votes enable row level security;

drop policy if exists "no direct freaky identities access" on freaky_identities;
create policy "no direct freaky identities access" on freaky_identities
for all using (false) with check (false);

drop policy if exists "no direct freaky suggestions access" on freaky_suggestions;
create policy "no direct freaky suggestions access" on freaky_suggestions
for all using (false) with check (false);

drop policy if exists "no direct freaky verification tokens access" on freaky_verification_tokens;
create policy "no direct freaky verification tokens access" on freaky_verification_tokens
for all using (false) with check (false);

drop policy if exists "no direct freaky votes access" on freaky_votes;
create policy "no direct freaky votes access" on freaky_votes
for all using (false) with check (false);

drop trigger if exists freaky_identities_set_updated_at on freaky_identities;
create trigger freaky_identities_set_updated_at
before update on freaky_identities
for each row execute function set_updated_at();

drop trigger if exists freaky_suggestions_set_updated_at on freaky_suggestions;
create trigger freaky_suggestions_set_updated_at
before update on freaky_suggestions
for each row execute function set_updated_at();

create or replace function normalize_freaky_title(p_title text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(p_title, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function freaky_find_similar_suggestions(p_title text, p_limit integer default 5)
returns table (
  id uuid,
  title text,
  description text,
  upvote_count integer,
  created_at timestamptz,
  is_exact boolean,
  similarity_score real
)
language sql
stable
set search_path = public
as $$
  with input as (
    select normalize_freaky_title(p_title) as normalized_title
  )
  select
    s.id,
    s.title,
    s.description,
    s.upvote_count,
    s.created_at,
    s.title_normalized = input.normalized_title as is_exact,
    similarity(s.title_normalized, input.normalized_title) as similarity_score
  from freaky_suggestions s
  cross join input
  where
    s.is_visible = true
    and s.status = 'published'
    and input.normalized_title <> ''
    and (
      s.title_normalized = input.normalized_title
      or s.title_normalized % input.normalized_title
      or s.title_normalized ilike ('%' || input.normalized_title || '%')
    )
  order by
    (s.title_normalized = input.normalized_title) desc,
    similarity(s.title_normalized, input.normalized_title) desc,
    s.upvote_count desc,
    s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 10));
$$;

create or replace function freaky_refresh_upvote_count(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update freaky_suggestions
  set upvote_count = (
    select count(*)::integer
    from freaky_votes
    where suggestion_id = p_suggestion_id
  )
  where id = p_suggestion_id;
end;
$$;

create or replace function freaky_register_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  archived_count integer := 0;
  deleted_token_count integer := 0;
begin
  with archived as (
    update freaky_suggestions
    set
      status = 'expired_unverified',
      is_visible = false,
      updated_at = now()
    where
      status = 'pending_verification'
      and is_visible = false
      and verification_completed_at is null
      and created_at < now() - interval '7 days'
    returning id
  )
  select count(*)::integer into archived_count from archived;

  with deleted_tokens as (
    delete from freaky_verification_tokens
    where
      (expires_at < now() - interval '14 days')
      or (consumed_at is not null and consumed_at < now() - interval '14 days')
    returning id
  )
  select count(*)::integer into deleted_token_count from deleted_tokens;

  return jsonb_build_object(
    'archivedSuggestions', archived_count,
    'deletedTokens', deleted_token_count,
    'ranAt', now()
  );
end;
$$;
