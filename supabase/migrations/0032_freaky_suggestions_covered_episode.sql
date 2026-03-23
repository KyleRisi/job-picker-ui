alter table freaky_suggestions
  add column if not exists covered_episode_id uuid null references podcast_episodes(id) on delete set null,
  add column if not exists covered_at timestamptz null;

create index if not exists freaky_suggestions_covered_episode_idx
on freaky_suggestions (covered_episode_id);

create index if not exists freaky_suggestions_covered_sort_idx
on freaky_suggestions (covered_at desc);
