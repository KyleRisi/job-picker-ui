alter table applications_archive
add column if not exists broadcasted_on_show boolean not null default false;

alter table applications_archive
add column if not exists broadcasted_at timestamptz null;

