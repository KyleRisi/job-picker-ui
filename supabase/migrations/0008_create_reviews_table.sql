create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text not null,
  body text not null,
  rating int not null check (rating between 1 and 5),
  author text not null,
  country text not null default '',
  source text not null check (source in ('apple', 'website', 'manual', 'scraped')) default 'website',
  status text not null check (status in ('visible', 'hidden')) default 'visible',
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_received_at_idx on reviews (received_at desc);
create index if not exists reviews_status_idx on reviews (status);
create index if not exists reviews_rating_idx on reviews (rating);
create index if not exists reviews_source_idx on reviews (source);

alter table reviews enable row level security;

drop policy if exists "no direct reviews access" on reviews;
create policy "no direct reviews access" on reviews
for all using (false) with check (false);

drop trigger if exists reviews_set_updated_at on reviews;
create trigger reviews_set_updated_at
before update on reviews
for each row execute function set_updated_at();
