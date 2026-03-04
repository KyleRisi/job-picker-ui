create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  reason text not null check (reason in ('general', 'guest', 'press', 'sponsorship', 'other')),
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  ip_address text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_submissions_created_at_idx
on contact_submissions (created_at desc);

create index if not exists contact_submissions_status_created_at_idx
on contact_submissions (status, created_at desc);

create index if not exists contact_submissions_email_idx
on contact_submissions ((lower(email)));

alter table contact_submissions enable row level security;

drop policy if exists "no direct contact submissions access" on contact_submissions;
create policy "no direct contact submissions access" on contact_submissions
for all using (false) with check (false);

drop trigger if exists contact_submissions_set_updated_at on contact_submissions;
create trigger contact_submissions_set_updated_at
before update on contact_submissions
for each row execute function set_updated_at();
