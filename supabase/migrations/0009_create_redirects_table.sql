create table if not exists redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null,
  target_url text not null,
  status_code int not null check (status_code in (301, 302, 307, 308)) default 301,
  match_type text not null check (match_type in ('exact', 'prefix')) default 'exact',
  is_active boolean not null default true,
  priority int not null default 100 check (priority >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint redirects_source_path_format check (left(source_path, 1) = '/'),
  constraint redirects_source_path_canonical check (
    source_path = '/'
    or (
      right(source_path, 1) <> '/'
      and source_path = lower(source_path)
    )
  )
);

create unique index if not exists redirects_unique_source_match_idx
on redirects (source_path, match_type);

create index if not exists redirects_active_match_idx
on redirects (is_active, match_type, priority desc, source_path);

create index if not exists redirects_updated_at_idx
on redirects (updated_at desc);

alter table redirects enable row level security;

drop policy if exists "no direct redirects access" on redirects;
create policy "no direct redirects access" on redirects
for all using (false) with check (false);

drop trigger if exists redirects_set_updated_at on redirects;
create trigger redirects_set_updated_at
before update on redirects
for each row execute function set_updated_at();

create or replace function resolve_redirect(p_path text)
returns table (
  id uuid,
  source_path text,
  target_url text,
  status_code int,
  match_type text,
  priority int
)
language sql
stable
set search_path = public
as $$
  with normalized as (
    select case
      when coalesce(trim(p_path), '') = '' then '/'
      when trim(p_path) = '/' then '/'
      else lower(regexp_replace(trim(p_path), '/+$', ''))
    end as path
  )
  select
    r.id,
    r.source_path,
    r.target_url,
    r.status_code,
    r.match_type,
    r.priority
  from redirects r
  cross join normalized n
  where r.is_active = true
    and (
      (r.match_type = 'exact' and r.source_path = n.path)
      or (
        r.match_type = 'prefix'
        and (
          n.path = r.source_path
          or n.path like case
            when r.source_path = '/' then '/%'
            else r.source_path || '/%'
          end
        )
      )
    )
  order by
    case when r.match_type = 'exact' then 0 else 1 end,
    length(r.source_path) desc,
    r.priority desc,
    r.updated_at desc
  limit 1;
$$;
