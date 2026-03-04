create extension if not exists pgcrypto;

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  reports_to text not null,
  job_ref text not null unique,
  status text not null check (status in ('AVAILABLE', 'FILLED', 'REHIRING')) default 'AVAILABLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete restrict,
  active boolean not null default true,
  assignment_ref text not null unique,
  full_name text not null,
  first_name text not null,
  email text not null,
  user_id uuid null references auth.users(id) on delete set null,
  q1 text not null,
  q2 text not null,
  q3 text not null,
  day_to_day text not null,
  incidents text not null,
  kpi_assessment text not null,
  consent_read_on_show boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assignments_one_active_email_idx
on assignments ((lower(email))) where active = true;

create unique index if not exists assignments_one_active_job_idx
on assignments (job_id) where active = true;

create table if not exists applications_archive (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  assignment_ref text not null,
  full_name text not null,
  email text not null,
  q1 text not null,
  q2 text not null,
  q3 text not null,
  day_to_day text not null,
  incidents text not null,
  kpi_assessment text not null,
  consent_read_on_show boolean not null,
  applied_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now()
);

create table if not exists exit_interviews (
  id uuid primary key default gen_random_uuid(),
  job_title text not null,
  assignment_ref text not null,
  full_name text not null,
  email text not null,
  exit_q1 text not null,
  exit_q2 text not null,
  exit_q3 text not null,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);

create table if not exists rate_limits (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  ip text not null,
  email text null,
  created_at timestamptz not null default now()
);

create table if not exists email_change_requests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  old_email text not null,
  new_email text not null,
  token text not null unique,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

insert into settings(key, value) values
('show_filled_first_names', '{"enabled": true}'::jsonb),
('disable_new_signups', '{"enabled": false}'::jsonb),
('reports_to_options', '{"options": []}'::jsonb)
on conflict (key) do nothing;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on jobs;
create trigger jobs_set_updated_at before update on jobs
for each row execute function set_updated_at();

drop trigger if exists assignments_set_updated_at on assignments;
create trigger assignments_set_updated_at before update on assignments
for each row execute function set_updated_at();

create or replace function auth_user_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u where lower(u.email) = lower(p_email)
  );
$$;

create or replace function claim_job_atomic(
  p_job_id uuid,
  p_full_name text,
  p_email text,
  p_q1 text,
  p_q2 text,
  p_q3 text,
  p_day_to_day text,
  p_incidents text,
  p_kpi_assessment text,
  p_consent boolean
)
returns table (
  assignment_id uuid,
  assignment_ref text,
  job_title text,
  first_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job jobs%rowtype;
  v_assignment_id uuid;
  v_assignment_ref text;
  v_first_name text;
begin
  select * into v_job from jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found';
  end if;

  if v_job.status not in ('AVAILABLE', 'REHIRING') then
    raise exception 'This role has already been claimed.';
  end if;

  if exists (
    select 1 from assignments a
    where a.active = true and lower(a.email) = lower(p_email)
  ) then
    raise exception 'You already have an active role.';
  end if;

  v_first_name := split_part(trim(regexp_replace(p_full_name, '\\s+', ' ', 'g')), ' ', 1);
  v_assignment_ref := 'CIRC-' || upper(substr(md5(random()::text || clock_timestamp()::text || p_email), 1, 10));

  insert into assignments (
    job_id, active, assignment_ref, full_name, first_name, email, q1, q2, q3,
    day_to_day, incidents, kpi_assessment, consent_read_on_show
  ) values (
    p_job_id, true, v_assignment_ref, p_full_name, v_first_name, lower(p_email), p_q1, p_q2, p_q3,
    p_day_to_day, p_incidents, p_kpi_assessment, p_consent
  ) returning id into v_assignment_id;

  update jobs set status = 'FILLED' where id = p_job_id;

  insert into applications_archive (
    job_id, assignment_ref, full_name, email, q1, q2, q3,
    day_to_day, incidents, kpi_assessment, consent_read_on_show
  ) values (
    p_job_id, v_assignment_ref, p_full_name, lower(p_email), p_q1, p_q2, p_q3,
    p_day_to_day, p_incidents, p_kpi_assessment, p_consent
  );

  return query select v_assignment_id, v_assignment_ref, v_job.title, v_first_name;
exception
  when unique_violation then
    raise exception 'This job was claimed moments ago. Please choose another role.';
end;
$$;

create or replace function resign_assignment_atomic(
  p_assignment_id uuid,
  p_exit_q1 text,
  p_exit_q2 text,
  p_exit_q3 text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment assignments%rowtype;
  v_job jobs%rowtype;
begin
  select * into v_assignment from assignments where id = p_assignment_id and active = true for update;
  if not found then
    raise exception 'Assignment not found.';
  end if;

  select * into v_job from jobs where id = v_assignment.job_id for update;

  insert into exit_interviews (
    job_title,
    assignment_ref,
    full_name,
    email,
    exit_q1,
    exit_q2,
    exit_q3
  ) values (
    v_job.title,
    v_assignment.assignment_ref,
    v_assignment.full_name,
    v_assignment.email,
    p_exit_q1,
    p_exit_q2,
    p_exit_q3
  );

  update jobs set status = 'REHIRING' where id = v_job.id;

  update assignments set
    active = false,
    day_to_day = '',
    incidents = '',
    kpi_assessment = '',
    full_name = '[redacted]',
    first_name = '[redacted]',
    email = concat('archived+', id::text, '@example.invalid')
  where id = v_assignment.id;
end;
$$;

create or replace function get_setting_bool(p_key text, p_default boolean)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select (value->>'enabled')::boolean from settings where key = p_key), p_default);
$$;

alter table jobs enable row level security;
alter table assignments enable row level security;
alter table applications_archive enable row level security;
alter table exit_interviews enable row level security;
alter table settings enable row level security;
alter table rate_limits enable row level security;
alter table email_change_requests enable row level security;

create policy if not exists "jobs public read" on jobs
for select using (true);

create policy if not exists "assignments users read own" on assignments
for select to authenticated
using (active = true and (auth.uid() = user_id or lower(auth.jwt() ->> 'email') = lower(email)));

create policy if not exists "assignments users update own" on assignments
for update to authenticated
using (active = true and (auth.uid() = user_id or lower(auth.jwt() ->> 'email') = lower(email)))
with check (active = true and (auth.uid() = user_id or lower(auth.jwt() ->> 'email') = lower(email)));

create policy if not exists "deny anon assignments" on assignments
for all to anon using (false) with check (false);

create policy if not exists "no direct archive access" on applications_archive
for all using (false) with check (false);

create policy if not exists "no direct exit access" on exit_interviews
for all using (false) with check (false);

create policy if not exists "settings public read" on settings
for select using (true);

create policy if not exists "no direct rate limit access" on rate_limits
for all using (false) with check (false);

create policy if not exists "no direct email change access" on email_change_requests
for all using (false) with check (false);
