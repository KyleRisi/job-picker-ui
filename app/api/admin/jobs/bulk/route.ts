import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { parseCsv, sanitizeReplacementChars } from '@/lib/utils';
import { requireAdminInApi } from '@/lib/api-auth';
import { getDefaultSalaryBenefits, normalizeSalaryBenefitOptions } from '@/lib/job-salary';

function toJobRef(n: number) {
  return `JOB-${String(n).padStart(4, '0')}`;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

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

async function getNextJobNumber(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: jobs, error } = await supabase.from('jobs').select('job_ref');
  if (error) throw new Error(error.message);
  let max = 0;
  for (const row of jobs || []) {
    const match = /^JOB-(\d+)$/i.exec(row.job_ref || '');
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const body = await req.json();
  const csv = `${body.csv || ''}`;
  const parsed = parseCsv(csv);
  if (parsed.errors.length) return badRequest(`CSV errors: ${parsed.errors.join('; ')}`);

  const [header, ...rows] = parsed.rows;
  const expected = ['title', 'description'];
  const normalizedHeader = header.map((h, idx) =>
    (idx === 0 ? h.replace(/^\uFEFF/, '') : h).toLowerCase().trim()
  );
  if (normalizedHeader.join(',') !== expected.join(',')) {
    return badRequest('CSV header must be: title,description');
  }

  const data: Array<{ title: string; description: string; status: 'AVAILABLE' }> = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const title = sanitizeReplacementChars(`${row[0] || ''}`);
    const description = sanitizeReplacementChars(`${row[1] || ''}`);
    if (!title || !description) {
      errors.push(`Row ${idx + 2}: missing required fields`);
      return;
    }
    data.push({ title, description, status: 'AVAILABLE' });
  });

  if (errors.length) return badRequest(`CSV validation failed: ${errors.join('; ')}`);
  if (!data.length) return badRequest('CSV has no data rows.');

  const supabase = createSupabaseAdminClient();
  const [reportsToOptions, salaryBenefitOptions] = await Promise.all([
    getReportsToOptions(supabase),
    getSalaryBenefitOptions(supabase)
  ]);
  if (!reportsToOptions.length) {
    return badRequest('No hiring managers configured. Add Reports To options in Admin Settings first.');
  }

  let lastError = '';
  let inserted = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nextJobNumber = await getNextJobNumber(supabase);
    const rowsToInsert = data.map((row, idx) => ({
      ...row,
      job_ref: toJobRef(nextJobNumber + idx),
      salary_benefits: getDefaultSalaryBenefits(toJobRef(nextJobNumber + idx), salaryBenefitOptions),
      reports_to: pickRandom(reportsToOptions)
    }));
    const insert = await supabase.from('jobs').insert(rowsToInsert);
    if (!insert.error) {
      inserted = true;
      break;
    }
    lastError = insert.error.message;
    if (!lastError.toLowerCase().includes('duplicate key')) return badRequest(lastError);
  }

  if (!inserted) return badRequest(lastError || 'Could not allocate unique job numbers.');

  return ok({ message: `Uploaded ${data.length} jobs.` }, 201);
}
