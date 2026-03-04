import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { sanitizeReplacementChars } from '@/lib/utils';
import { getDefaultSalaryBenefits, normalizeSalaryBenefitOptions } from '@/lib/job-salary';

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  reports_to: z.string().min(1),
  salary_benefits: z.string().min(1),
  status: z.enum(['AVAILABLE', 'FILLED', 'REHIRING']),
  rehiring_reason: z.string().optional()
});

const deleteSchema = z.object({ id: z.string().uuid() });

const editSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  reports_to: z.string().min(1),
  salary_benefits: z.string().min(1),
  status: z.enum(['AVAILABLE', 'FILLED', 'REHIRING']),
  rehiring_reason: z.string().optional()
});

async function getReportsToOptions(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'reports_to_options')
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = data?.value?.options;
  return Array.isArray(raw) ? raw.map((v: unknown) => `${v}`.trim()).filter(Boolean) : [];
}

async function getSalaryBenefitOptions(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'salary_benefit_options')
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = data?.value?.options;
  const options = Array.isArray(raw) ? raw.map((v: unknown) => `${v}`.trim()).filter(Boolean) : [];
  return normalizeSalaryBenefitOptions(options);
}

async function getRehiringReasons(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'rehiring_reasons')
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = data?.value?.options;
  return Array.isArray(raw) ? raw.map((v: unknown) => `${v}`.trim()).filter(Boolean) : [];
}

function pickRandomReason(reasons: string[]) {
  if (!reasons.length) return null;
  const idx = Math.floor(Math.random() * reasons.length);
  return reasons[idx] || null;
}

async function getNextJobRef(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: jobs, error } = await supabase.from('jobs').select('job_ref');
  if (error) throw new Error(error.message);
  let max = 0;
  for (const row of jobs || []) {
    const match = /^JOB-(\d+)$/i.exec(row.job_ref || '');
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `JOB-${String(max + 1).padStart(4, '0')}`;
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid job fields.');

  const supabase = createSupabaseAdminClient();
  const [reportsToOptions, salaryBenefitOptions, rehiringReasons] = await Promise.all([
    getReportsToOptions(supabase),
    getSalaryBenefitOptions(supabase),
    getRehiringReasons(supabase)
  ]);
  if (!reportsToOptions.length) {
    return badRequest('No hiring managers configured. Add Reports To options in Admin Settings first.');
  }
  if (!reportsToOptions.includes(parsed.data.reports_to)) {
    return badRequest('Invalid Reports To value. Choose one of the configured hiring managers.');
  }

  const payload = {
    title: sanitizeReplacementChars(parsed.data.title),
    description: sanitizeReplacementChars(parsed.data.description),
    reports_to: sanitizeReplacementChars(parsed.data.reports_to),
    salary_benefits: sanitizeReplacementChars(parsed.data.salary_benefits),
    status: parsed.data.status,
    rehiring_reason:
      parsed.data.status === 'REHIRING'
        ? sanitizeReplacementChars(
            `${parsed.data.rehiring_reason || ''}`.trim() || pickRandomReason(rehiringReasons) || ''
          ) || null
        : null
  };

  let lastError = '';
  let inserted = false;

  for (let i = 0; i < 5; i += 1) {
    const jobRef = await getNextJobRef(supabase);
    const salaryBenefits = payload.salary_benefits || getDefaultSalaryBenefits(jobRef, salaryBenefitOptions);
    const insert = await supabase.from('jobs').insert({ ...payload, salary_benefits: salaryBenefits, job_ref: jobRef });
    if (!insert.error) {
      inserted = true;
      break;
    }
    lastError = insert.error.message;
    if (!lastError.toLowerCase().includes('duplicate key')) {
      return badRequest(lastError);
    }
  }

  if (!inserted) return badRequest(lastError || 'Could not allocate a unique job number.');

  return ok({ message: 'Job created.' }, 201);
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = editSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid job update fields.');

  const { id, ...data } = parsed.data;
  const supabase = createSupabaseAdminClient();
  const [reportsToOptions, rehiringReasons] = await Promise.all([
    getReportsToOptions(supabase),
    getRehiringReasons(supabase)
  ]);
  if (!reportsToOptions.includes(data.reports_to)) {
    return badRequest('Invalid Reports To value. Choose one of the configured hiring managers.');
  }

  const payload = {
    title: sanitizeReplacementChars(data.title),
    description: sanitizeReplacementChars(data.description),
    reports_to: sanitizeReplacementChars(data.reports_to),
    salary_benefits: sanitizeReplacementChars(data.salary_benefits),
    status: data.status,
    rehiring_reason:
      data.status === 'REHIRING'
        ? sanitizeReplacementChars(`${data.rehiring_reason || ''}`.trim() || pickRandomReason(rehiringReasons) || '') ||
          null
        : null
  };

  const update = await supabase.from('jobs').update(payload).eq('id', id);
  if (update.error) return badRequest(update.error.message);
  return ok({ message: 'Job updated.' });
}

export async function DELETE(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Missing job id.');

  const supabase = createSupabaseAdminClient();
  const { data: activeAssignment, error: activeAssignmentError } = await supabase
    .from('assignments')
    .select('id')
    .eq('job_id', parsed.data.id)
    .eq('active', true)
    .maybeSingle();
  if (activeAssignmentError) return badRequest(activeAssignmentError.message);

  if (activeAssignment) {
    return badRequest('Cannot delete this role while it has an active assignment. Fire/resign this person first.');
  }

  const cleanup = await supabase.from('assignments').delete().eq('job_id', parsed.data.id);
  if (cleanup.error) return badRequest(cleanup.error.message);

  const del = await supabase.from('jobs').delete().eq('id', parsed.data.id);
  if (del.error) return badRequest(del.error.message);

  return ok({ message: 'Job deleted.' });
}
