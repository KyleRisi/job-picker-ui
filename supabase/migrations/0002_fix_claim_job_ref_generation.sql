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
