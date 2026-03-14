import { createSupabaseAdminClient } from './supabase';
import { DEFAULT_REHIRING_REASONS, STATUS } from './constants';
import { sanitizeReplacementChars } from './utils';
import { normalizeSalaryBenefitOptions } from './job-salary';

function toFirstAndLastInitial(fullName: string, fallbackFirstName: string) {
  const parts = `${fullName || ''}`.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return `${fallbackFirstName || ''}`.trim();
  const first = parts[0];
  if (parts.length < 2) return first;
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || '';
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

function normalizeStatus(status: string): 'AVAILABLE' | 'FILLED' | 'REHIRING' {
  const value = (status || '').trim().toUpperCase();
  if (value === STATUS.FILLED) return STATUS.FILLED;
  if (value === STATUS.REHIRING) return STATUS.REHIRING;
  return STATUS.AVAILABLE;
}

export async function getSettings() {
  const supabase = createSupabaseAdminClient();
  const [{ data }, { data: jobs }] = await Promise.all([
    supabase.from('settings').select('key,value'),
    supabase.from('jobs').select('reports_to')
  ]);
  const out: {
    show_filled_first_names: boolean;
    disable_new_signups: boolean;
    reports_to_options: string[];
    salary_benefit_options: string[];
    rehiring_reasons: string[];
  } = {
    show_filled_first_names: true,
    disable_new_signups: false,
    reports_to_options: [],
    salary_benefit_options: [],
    rehiring_reasons: []
  };

  (data || []).forEach((row) => {
    if (row.key === 'show_filled_first_names') {
      out.show_filled_first_names = Boolean(row.value?.enabled);
      return;
    }
    if (row.key === 'disable_new_signups') {
      out.disable_new_signups = Boolean(row.value?.enabled);
      return;
    }
    if (row.key === 'reports_to_options') {
      const options = Array.isArray(row.value?.options)
        ? row.value.options.map((v: unknown) => `${v}`.trim()).filter(Boolean)
        : [];
      out.reports_to_options = options;
      return;
    }
    if (row.key === 'salary_benefit_options') {
      const options = Array.isArray(row.value?.options)
        ? row.value.options.map((v: unknown) => `${v}`.trim()).filter(Boolean)
        : [];
      out.salary_benefit_options = normalizeSalaryBenefitOptions(options);
      return;
    }
    if (row.key === 'rehiring_reasons') {
      const options = Array.isArray(row.value?.options)
        ? row.value.options.map((v: unknown) => `${v}`.trim()).filter(Boolean)
        : [];
      out.rehiring_reasons = options;
    }
  });

  // Seed manager options from existing job records so settings starts populated.
  const fromJobs = (jobs || []).map((j) => `${j.reports_to || ''}`.trim()).filter(Boolean);
  out.reports_to_options = Array.from(new Set([...out.reports_to_options, ...fromJobs])).sort((a, b) =>
    a.localeCompare(b)
  );
  out.salary_benefit_options = normalizeSalaryBenefitOptions(out.salary_benefit_options);
  const normalizedReasons = out.rehiring_reasons.map((v) => `${v}`.trim()).filter(Boolean);
  out.rehiring_reasons = Array.from(new Set([...DEFAULT_REHIRING_REASONS, ...normalizedReasons]));

  return out;
}

export async function getJobsForPublic(options?: { includeFilledApplicationId?: boolean }) {
  const includeFilledApplicationId = Boolean(options?.includeFilledApplicationId);
  const supabase = createSupabaseAdminClient();
  const { data: jobs, error } = await supabase.from('jobs').select('*').order('job_ref', { ascending: false });
  if (error) throw error;

  const { data: assignments } = await supabase
    .from('assignments')
    .select(
      includeFilledApplicationId
        ? 'job_id,first_name,full_name,created_at,assignment_ref,email,q1,q2,q3,day_to_day,incidents,kpi_assessment,consent_read_on_show'
        : 'job_id,first_name,full_name,created_at'
    )
    .eq('active', true);

  const { data: broadcastRows } = await supabase
    .from('applications_archive')
    .select('job_id,broadcasted_on_show,broadcasted_at')
    .eq('broadcasted_on_show', true);

  const assignmentList = ((assignments || []) as unknown) as Array<{
    job_id: string;
    first_name?: string | null;
    full_name?: string | null;
    created_at?: string | null;
    assignment_ref?: string | null;
    email?: string | null;
    q1?: string | null;
    q2?: string | null;
    q3?: string | null;
    day_to_day?: string | null;
    incidents?: string | null;
    kpi_assessment?: string | null;
    consent_read_on_show?: boolean | null;
  }>;

  const filledShortMap = new Map(
    assignmentList.map((a) => [
      a.job_id,
      sanitizeReplacementChars(toFirstAndLastInitial(a.full_name || '', a.first_name || ''))
    ])
  );
  const filledFullMap = new Map(
    assignmentList.map((a) => [a.job_id, sanitizeReplacementChars(`${a.full_name || ''}`.trim())])
  );
  const filledAtMap = new Map(assignmentList.map((a) => [a.job_id, `${a.created_at || ''}`]));
  const consentReadOnShowMap = new Map(
    assignmentList.map((a) => [a.job_id, Boolean(a.consent_read_on_show)])
  );
  const broadcastMap = new Map(
    (broadcastRows || []).map((b) => [b.job_id, `${b.broadcasted_at || ''}`])
  );
  let filledApplicationIdByJobId = new Map<string, string>();

  if (includeFilledApplicationId && assignmentList.length) {
    const assignmentRows = assignmentList.filter(
      (row): row is typeof row & { assignment_ref: string } => Boolean(row.assignment_ref)
    );
    const refs = assignmentRows.map((row) => row.assignment_ref).filter(Boolean);

    if (refs.length) {
      let { data: archives } = await supabase
        .from('applications_archive')
        .select('id,assignment_ref')
        .in('assignment_ref', refs);

      const existingRefs = new Set((archives || []).map((row) => row.assignment_ref));
      const missingRows = assignmentRows.filter((row) => !existingRefs.has(row.assignment_ref));

      if (missingRows.length) {
        await supabase.from('applications_archive').insert(
          missingRows.map((row) => ({
            job_id: row.job_id,
            assignment_ref: row.assignment_ref,
            full_name: row.full_name || '-',
            email: row.email || 'unknown@example.invalid',
            q1: row.q1 || '-',
            q2: row.q2 || '-',
            q3: row.q3 || '-',
            day_to_day: row.day_to_day || '',
            incidents: row.incidents || '',
            kpi_assessment: row.kpi_assessment || '',
            consent_read_on_show: Boolean(row.consent_read_on_show)
          }))
        );
        const refreshed = await supabase
          .from('applications_archive')
          .select('id,assignment_ref')
          .in('assignment_ref', refs);
        archives = refreshed.data || [];
      }

      const appIdByRef = new Map((archives || []).map((row) => [row.assignment_ref, row.id]));
      filledApplicationIdByJobId = new Map(
        assignmentRows
          .map((row) => [row.job_id, appIdByRef.get(row.assignment_ref) || ''])
          .filter((pair): pair is [string, string] => Boolean(pair[0] && pair[1]))
      );
    }
  }

  return (jobs || []).map((job) => {
    const hasActiveAssignment = filledShortMap.has(job.id);
    const status = hasActiveAssignment ? STATUS.FILLED : normalizeStatus(job.status);
    return {
      ...job,
      title: sanitizeReplacementChars(`${job.title || ''}`),
      description: sanitizeReplacementChars(`${job.description || ''}`),
      reports_to: sanitizeReplacementChars(`${job.reports_to || ''}`),
      salary_benefits: sanitizeReplacementChars(`${job.salary_benefits || ''}`),
      status,
      filledBy: filledShortMap.get(job.id) || null,
      filledByFull: filledFullMap.get(job.id) || null,
      filledAt: filledAtMap.get(job.id) || null,
      consentReadOnShow: includeFilledApplicationId ? Boolean(consentReadOnShowMap.get(job.id)) : null,
      filledApplicationId: includeFilledApplicationId ? filledApplicationIdByJobId.get(job.id) || null : null,
      broadcastedOnShow: broadcastMap.has(job.id),
      broadcastedAt: broadcastMap.get(job.id) || null
    };
  });
}

export async function getActiveTeamMembers() {
  const supabase = createSupabaseAdminClient();
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('id,full_name,created_at,profile_photo_data_url,jobs(title)')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (assignments || []).map((row) => {
    const jobRelation =
      row.jobs as { title?: string } | Array<{ title?: string }> | null | undefined;
    const relation = Array.isArray(jobRelation) ? jobRelation[0] : jobRelation;
    const relationTitle = relation?.title;
    const fullName = sanitizeReplacementChars(`${row.full_name || ''}`.trim());
    const jobTitle = sanitizeReplacementChars(`${relationTitle || ''}`.trim()) || 'Circus Performer';
    const photo = `${row.profile_photo_data_url || ''}`.trim() || null;

    return {
      id: `${row.id || ''}`,
      full_name: fullName,
      job_title: jobTitle,
      profile_photo_data_url: photo,
      created_at: `${row.created_at || ''}`
    };
  });
}

export async function getJobById(id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single();
  if (error) return null;

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id')
    .eq('job_id', id)
    .eq('active', true)
    .maybeSingle();

  const normalized = normalizeStatus(data.status);
  return {
    ...data,
    title: sanitizeReplacementChars(`${data.title || ''}`),
    description: sanitizeReplacementChars(`${data.description || ''}`),
    reports_to: sanitizeReplacementChars(`${data.reports_to || ''}`),
    salary_benefits: sanitizeReplacementChars(`${data.salary_benefits || ''}`),
    status: assignment ? STATUS.FILLED : normalized === STATUS.FILLED ? STATUS.AVAILABLE : normalized
  };
}
