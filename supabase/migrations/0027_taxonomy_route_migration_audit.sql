create table if not exists taxonomy_route_migration_audit (
  id uuid primary key default gen_random_uuid(),
  route text not null unique,
  previous_behavior text not null,
  new_behavior text not null,
  status_code int not null check (status_code in (200, 301, 410)),
  redirect_destination text null,
  rationale text not null,
  source_type text not null default 'taxonomy_route_policy',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taxonomy_route_migration_audit_route_format check (left(route, 1) = '/')
);

create index if not exists taxonomy_route_migration_audit_status_idx
on taxonomy_route_migration_audit (status_code, updated_at desc);

create index if not exists taxonomy_route_migration_audit_source_idx
on taxonomy_route_migration_audit (source_type, updated_at desc);

alter table taxonomy_route_migration_audit enable row level security;

drop policy if exists "no direct taxonomy_route_migration_audit access" on taxonomy_route_migration_audit;
create policy "no direct taxonomy_route_migration_audit access" on taxonomy_route_migration_audit
for all using (false) with check (false);

drop trigger if exists taxonomy_route_migration_audit_set_updated_at on taxonomy_route_migration_audit;
create trigger taxonomy_route_migration_audit_set_updated_at
before update on taxonomy_route_migration_audit
for each row execute function set_updated_at();
