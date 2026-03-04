alter table assignments
add column if not exists profile_photo_data_url text null;

alter table applications_archive
add column if not exists profile_photo_data_url text null;

