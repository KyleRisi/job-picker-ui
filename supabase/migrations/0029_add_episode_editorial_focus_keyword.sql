alter table if exists podcast_episode_editorial
  add column if not exists focus_keyword text null;
