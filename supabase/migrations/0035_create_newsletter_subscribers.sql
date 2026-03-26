create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  environment text not null check (environment in ('preview', 'production')),
  source_path text not null default '/',
  source_section text not null default 'email_signup',
  page_version text not null default 'homepage_v2',
  submitted_count int not null default 1 check (submitted_count >= 1),
  first_submitted_at timestamptz not null default now(),
  last_submitted_at timestamptz not null default now(),
  ip text null,
  user_agent text null
);

create unique index if not exists newsletter_subscribers_email_environment_unique_idx
on newsletter_subscribers (email_normalized, environment);

create index if not exists newsletter_subscribers_environment_submitted_idx
on newsletter_subscribers (environment, last_submitted_at desc);

alter table if exists newsletter_subscribers enable row level security;

drop policy if exists "no direct newsletter access" on newsletter_subscribers;
create policy "no direct newsletter access" on newsletter_subscribers
for all using (false) with check (false);
