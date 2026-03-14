alter table if exists podcast_episode_editorial
  add column if not exists author_id uuid null references blog_authors(id) on delete set null;

create index if not exists podcast_episode_editorial_author_id_idx
on podcast_episode_editorial (author_id);
