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

export async function getJobsForPublic() {
  const supabase = createSupabaseAdminClient();
  const { data: jobs, error } = await supabase.from('jobs').select('*').order('job_ref', { ascending: false });
  if (error) throw error;

  const { data: assignments } = await supabase
    .from('assignments')
    .select('job_id,first_name,full_name,created_at')
    .eq('active', true);

  const filledShortMap = new Map(
    (assignments || []).map((a) => [
      a.job_id,
      sanitizeReplacementChars(toFirstAndLastInitial(a.full_name || '', a.first_name || ''))
    ])
  );
  const filledFullMap = new Map(
    (assignments || []).map((a) => [a.job_id, sanitizeReplacementChars(`${a.full_name || ''}`.trim())])
  );
  const filledAtMap = new Map((assignments || []).map((a) => [a.job_id, `${a.created_at || ''}`]));

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
      filledAt: filledAtMap.get(job.id) || null
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
