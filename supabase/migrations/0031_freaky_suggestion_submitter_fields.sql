alter table freaky_suggestions
  add column if not exists submitted_name text not null default '',
  add column if not exists submitted_full_name text not null default '',
  add column if not exists submitted_country text not null default '',
  add column if not exists topic_term_id uuid null references discovery_terms(id) on delete set null,
  add column if not exists topic_slug text not null default '',
  add column if not exists topic_name text not null default '';

create index if not exists freaky_suggestions_topic_term_idx
on freaky_suggestions (topic_term_id);

create index if not exists freaky_suggestions_topic_slug_idx
on freaky_suggestions (topic_slug);
