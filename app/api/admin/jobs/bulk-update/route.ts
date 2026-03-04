import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { parseCsv, sanitizeReplacementChars } from '@/lib/utils';
import { requireAdminInApi } from '@/lib/api-auth';

type UpdateRow = {
  job_ref: string;
  title: string;
  description: string;
  status: 'AVAILABLE' | 'FILLED' | 'REHIRING';
  reports_to: string;
  salary_benefits: string;
};

const requiredColumns = ['job_ref', 'title', 'description', 'status', 'reports_to', 'salary_benefits'] as const;

const headerAliases: Record<(typeof requiredColumns)[number], string[]> = {
  job_ref: ['job_ref', 'job_reference', 'reference', 'reference_number'],
  title: ['title', 'job_title'],
  description: ['description', 'job_description'],
  status: ['status'],
  reports_to: ['reports_to', 'report_to', 'reports_to_name'],
  salary_benefits: [
    'salary_benefits',
    'salary_and_benefits',
    'salary_benefit',
    'salary_expectations_and_benefits',
    'salary_expectations_benefits',
    'salary_plus_benefits',
    'salary'
  ]
};

function normalizeHeaderCell(cell: string, idx: number) {
  const raw = idx === 0 ? cell.replace(/^\uFEFF/, '') : cell;
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\s\-+]+/g, '_')
    .replace(/[^\w]/g, '');
}

function resolveColumnIndex(
  indexByHeader: Map<string, number>,
  canonicalName: (typeof requiredColumns)[number]
) {
  const aliases = headerAliases[canonicalName] || [canonicalName];
  for (const alias of aliases) {
    const normalized = normalizeHeaderCell(alias, 0);
    const idx = indexByHeader.get(normalized);
    if (typeof idx === 'number') return idx;
  }
  return -1;
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const body = await req.json();
  const csv = `${body.csv || ''}`;
  const parsed = parseCsv(csv);
  if (parsed.errors.length) return badRequest(`CSV errors: ${parsed.errors.join('; ')}`);

  const [header = [], ...rows] = parsed.rows;
  const normalizedHeader = header.map(normalizeHeaderCell);
  const indexByHeader = new Map(normalizedHeader.map((name, idx) => [name, idx]));
  const resolvedColumnIndex = {
    job_ref: resolveColumnIndex(indexByHeader, 'job_ref'),
    title: resolveColumnIndex(indexByHeader, 'title'),
    description: resolveColumnIndex(indexByHeader, 'description'),
    status: resolveColumnIndex(indexByHeader, 'status'),
    reports_to: resolveColumnIndex(indexByHeader, 'reports_to'),
    salary_benefits: resolveColumnIndex(indexByHeader, 'salary_benefits')
  };
  const missingHeaders = requiredColumns.filter((name) => resolvedColumnIndex[name] < 0);
  if (missingHeaders.length) {
    return badRequest(`CSV is missing required columns: ${missingHeaders.join(', ')}`);
  }

  const data: UpdateRow[] = [];
  const validationErrors: string[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    if (row.length !== header.length) {
      validationErrors.push(
        `Row ${rowNumber}: column count mismatch. If a field contains commas, wrap it in double quotes.`
      );
      return;
    }
    const job_ref = `${row[resolvedColumnIndex.job_ref] || ''}`.trim().toUpperCase();
    const title = sanitizeReplacementChars(`${row[resolvedColumnIndex.title] || ''}`);
    const description = sanitizeReplacementChars(`${row[resolvedColumnIndex.description] || ''}`);
    const rawStatus = `${row[resolvedColumnIndex.status] || ''}`.trim().toUpperCase();
    const reports_to = sanitizeReplacementChars(`${row[resolvedColumnIndex.reports_to] || ''}`);
    const salary_benefits = sanitizeReplacementChars(`${row[resolvedColumnIndex.salary_benefits] || ''}`);

    if (!job_ref || !title || !description) {
      validationErrors.push(`Row ${rowNumber}: job_ref, title, and description are required`);
      return;
    }
    if (!/^JOB-\d+$/i.test(job_ref)) {
      validationErrors.push(`Row ${rowNumber}: invalid job_ref ${job_ref}`);
      return;
    }
    if (!['AVAILABLE', 'FILLED', 'REHIRING'].includes(rawStatus)) {
      validationErrors.push(`Row ${rowNumber}: status must be AVAILABLE, FILLED, or REHIRING`);
      return;
    }

    data.push({
      job_ref,
      title,
      description,
      status: rawStatus as 'AVAILABLE' | 'FILLED' | 'REHIRING',
      reports_to,
      salary_benefits
    });
  });

  if (validationErrors.length) {
    return badRequest(`CSV validation failed: ${validationErrors.join('; ')}`);
  }
  if (!data.length) return badRequest('CSV has no data rows.');

  const refs = data.map((row) => row.job_ref);
  const duplicateRef = refs.find((ref, idx) => refs.indexOf(ref) !== idx);
  if (duplicateRef) {
    return badRequest(`CSV validation failed: duplicate job_ref ${duplicateRef}`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingJobs, error: fetchError } = await supabase
    .from('jobs')
    .select('id,job_ref')
    .in('job_ref', refs);
  if (fetchError) return badRequest(fetchError.message);

  const existingByRef = new Map((existingJobs || []).map((job) => [job.job_ref, job.id]));
  const missingRefs = refs.filter((ref) => !existingByRef.has(ref));
  if (missingRefs.length) {
    return badRequest(`CSV contains unknown job_ref values: ${missingRefs.join(', ')}`);
  }

  const runtimeErrors: string[] = [];
  let updated = 0;

  for (let i = 0; i < data.length; i += 1) {
    const row = data[i];
    const update = await supabase
      .from('jobs')
      .update({
        title: row.title,
        description: row.description,
        status: row.status,
        reports_to: row.reports_to,
        salary_benefits: row.salary_benefits
      })
      .eq('job_ref', row.job_ref);

    if (update.error) {
      runtimeErrors.push(`Row ${i + 2} (${row.job_ref}): ${update.error.message}`);
      continue;
    }
    updated += 1;
  }

  if (runtimeErrors.length) {
    return badRequest(`Update finished with errors. Updated ${updated}/${data.length}. ${runtimeErrors.join('; ')}`);
  }

  return ok({ message: `Updated ${updated} job roles.` });
}
