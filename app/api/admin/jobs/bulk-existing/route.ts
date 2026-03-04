import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { parseCsv, sanitizeReplacementChars } from '@/lib/utils';
import { requireAdminInApi } from '@/lib/api-auth';
import { getDefaultSalaryBenefits, normalizeSalaryBenefitOptions } from '@/lib/job-salary';

type ExistingEmployeeRow = {
  title: string;
  description: string;
  full_name: string;
  email: string;
  q1: string;
  q2: string;
  q3: string;
  day_to_day: string;
  incidents: string;
  kpi_assessment: string;
  consent_read_on_show: boolean;
};

function toJobRef(n: number) {
  return `JOB-${String(n).padStart(4, '0')}`;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function generateAssignmentRef() {
  return `CIRC-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseConsent(value: string): { valid: boolean; value: boolean } {
  const normalized = value.trim().toLowerCase();
  if (['y', 'yes', 'true', '1', 'on'].includes(normalized)) return { valid: true, value: true };
  if (['n', 'no', 'false', '0', 'off'].includes(normalized)) return { valid: true, value: false };
  return { valid: false, value: false };
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const body = await req.json();
  const csv = `${body.csv || ''}`;
  const parsed = parseCsv(csv);
  if (parsed.errors.length) return badRequest(`CSV errors: ${parsed.errors.join('; ')}`);

  const [header, ...rows] = parsed.rows;
  const expected = [
    'title',
    'description',
    'full_name',
    'email',
    'q1',
    'q2',
    'q3',
    'day_to_day',
    'incidents',
    'kpi_assessment',
    'consent_read_on_show'
  ];
  const normalizedHeader = header.map((h, idx) =>
    (idx === 0 ? h.replace(/^\uFEFF/, '') : h).toLowerCase().trim()
  );
  if (normalizedHeader.join(',') !== expected.join(',')) {
    return badRequest(
      'CSV header must be: title,description,full_name,email,q1,q2,q3,day_to_day,incidents,kpi_assessment,consent_read_on_show'
    );
  }

  const data: ExistingEmployeeRow[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const title = sanitizeReplacementChars(`${row[0] || ''}`);
    const description = sanitizeReplacementChars(`${row[1] || ''}`);
    const full_name = sanitizeReplacementChars(`${row[2] || ''}`);
    const email = normalizeEmail(`${row[3] || ''}`);
    const q1 = sanitizeReplacementChars(`${row[4] || ''}`);
    const q2 = sanitizeReplacementChars(`${row[5] || ''}`);
    const q3 = sanitizeReplacementChars(`${row[6] || ''}`);
    const day_to_day = sanitizeReplacementChars(`${row[7] || ''}`);
    const incidents = sanitizeReplacementChars(`${row[8] || ''}`);
    const kpi_assessment = sanitizeReplacementChars(`${row[9] || ''}`);
    const consentRaw = `${row[10] || ''}`;
    const consent = parseConsent(consentRaw);
    const rowNumber = idx + 2;

    if (!title || !description || !full_name || !email) {
      errors.push(`Row ${rowNumber}: missing required fields`);
      return;
    }

    if (email && !isValidEmail(email)) {
      errors.push(`Row ${rowNumber}: invalid email ${email}`);
      return;
    }
    if (!consent.valid) {
      errors.push(`Row ${rowNumber}: consent_read_on_show must be Y or N`);
      return;
    }

    data.push({
      title,
      description,
      full_name,
      email,
      q1,
      q2,
      q3,
      day_to_day,
      incidents,
      kpi_assessment,
      consent_read_on_show: consent.value
    });
  });

  if (errors.length) return badRequest(`CSV validation failed: ${errors.join('; ')}`);
  if (!data.length) return badRequest('CSV has no data rows.');

  const providedEmails = data.map((row) => normalizeEmail(row.email)).filter(Boolean);
  const duplicateEmailInCsv = providedEmails.find((email, idx) => providedEmails.indexOf(email) !== idx);
  if (duplicateEmailInCsv) {
    return badRequest(`CSV validation failed: duplicate email ${duplicateEmailInCsv}`);
  }

  const filledEmails = data.map((row) => normalizeEmail(row.email));

  const supabase = createSupabaseAdminClient();
  const [reportsToOptions, salaryBenefitOptions] = await Promise.all([
    getReportsToOptions(supabase),
    getSalaryBenefitOptions(supabase)
  ]);
  if (!reportsToOptions.length) {
    return badRequest('No hiring managers configured. Add Reports To options in Admin Settings first.');
  }

  if (filledEmails.length) {
    const { data: activeByEmail, error } = await supabase
      .from('assignments')
      .select('email')
      .eq('active', true)
      .in('email', filledEmails);
    if (error) return badRequest(error.message);
    if ((activeByEmail || []).length) {
      return badRequest(`One or more filled emails already have an active role.`);
    }
  }

  const runtimeErrors: string[] = [];
  let imported = 0;

  for (let i = 0; i < data.length; i += 1) {
    const row = data[i];

    let jobId = '';
    let jobRef = '';
    let assignmentRef = '';

    let jobInserted = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const nextJobNumber = await getNextJobNumber(supabase);
      jobRef = toJobRef(nextJobNumber);

      const insertJob = await supabase
        .from('jobs')
        .insert({
          title: row.title,
          description: row.description,
          status: 'FILLED',
          job_ref: jobRef,
          salary_benefits: getDefaultSalaryBenefits(jobRef, salaryBenefitOptions),
          reports_to: pickRandom(reportsToOptions)
        })
        .select('id')
        .single();

      if (!insertJob.error && insertJob.data?.id) {
        jobId = insertJob.data.id;
        jobInserted = true;
        break;
      }

      const message = insertJob.error?.message || '';
      if (!message.toLowerCase().includes('duplicate key')) {
        runtimeErrors.push(`Row ${i + 2}: ${message || 'could not create job'}`);
        break;
      }
    }

    if (!jobInserted || !jobId) {
      if (!runtimeErrors.length || !runtimeErrors[runtimeErrors.length - 1].startsWith(`Row ${i + 2}:`)) {
        runtimeErrors.push(`Row ${i + 2}: could not allocate a unique job number`);
      }
      continue;
    }

    assignmentRef = generateAssignmentRef();
    const firstName = row.full_name.trim().split(/\s+/).filter(Boolean)[0] || row.full_name;

    const assignmentInsert = await supabase.from('assignments').insert({
      job_id: jobId,
      active: true,
      assignment_ref: assignmentRef,
      full_name: row.full_name,
      first_name: firstName,
      email: normalizeEmail(row.email),
      q1: row.q1,
      q2: row.q2,
      q3: row.q3,
      day_to_day: row.day_to_day,
      incidents: row.incidents,
      kpi_assessment: row.kpi_assessment,
      consent_read_on_show: row.consent_read_on_show
    });

    if (assignmentInsert.error) {
      await supabase.from('jobs').delete().eq('id', jobId);
      runtimeErrors.push(`Row ${i + 2}: ${assignmentInsert.error.message}`);
      continue;
    }

    const archiveInsert = await supabase.from('applications_archive').insert({
      job_id: jobId,
      assignment_ref: assignmentRef,
      full_name: row.full_name,
      email: normalizeEmail(row.email),
      q1: row.q1,
      q2: row.q2,
      q3: row.q3,
      day_to_day: row.day_to_day,
      incidents: row.incidents,
      kpi_assessment: row.kpi_assessment,
      consent_read_on_show: row.consent_read_on_show
    });

    if (archiveInsert.error) {
      await supabase.from('assignments').delete().eq('assignment_ref', assignmentRef);
      await supabase.from('jobs').delete().eq('id', jobId);
      runtimeErrors.push(`Row ${i + 2}: ${archiveInsert.error.message}`);
      continue;
    }

    imported += 1;
  }

  if (runtimeErrors.length) {
    return badRequest(`Import finished with errors. Imported ${imported}/${data.length}. ${runtimeErrors.join('; ')}`);
  }

  return ok({ message: `Uploaded ${imported} employees/roles.` }, 201);
}
