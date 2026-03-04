import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';

const schema = z.object({
  show_filled_first_names: z.boolean(),
  disable_new_signups: z.boolean(),
  reports_to_options: z.array(z.string()).default([]),
  salary_benefit_options: z.array(z.string()).default([]),
  rehiring_reasons: z.array(z.string()).default([])
});

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid settings payload.');

  const supabase = createSupabaseAdminClient();
  const normalizedReportsToOptions = parsed.data.reports_to_options.map((s) => s.trim()).filter(Boolean);
  const normalizedSalaryBenefitOptions = parsed.data.salary_benefit_options.map((s) => s.trim()).filter(Boolean);
  const normalizedRehiringReasons = parsed.data.rehiring_reasons.map((s) => s.trim()).filter(Boolean);
  const rows = [
    { key: 'show_filled_first_names', value: { enabled: parsed.data.show_filled_first_names } },
    { key: 'disable_new_signups', value: { enabled: parsed.data.disable_new_signups } },
    {
      key: 'reports_to_options',
      value: {
        options: normalizedReportsToOptions
      }
    },
    {
      key: 'salary_benefit_options',
      value: {
        options: normalizedSalaryBenefitOptions
      }
    },
    {
      key: 'rehiring_reasons',
      value: {
        options: normalizedRehiringReasons
      }
    }
  ];

  const upsert = await supabase.from('settings').upsert(rows);
  if (upsert.error) return badRequest(upsert.error.message);

  return ok({
    message: 'Settings updated.',
    reports_to_options: normalizedReportsToOptions,
    salary_benefit_options: normalizedSalaryBenefitOptions,
    rehiring_reasons: normalizedRehiringReasons
  });
}
