import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp, normalizeEmail } from '@/lib/utils';
import { sendApplicationConfirmationEmail, isEmailEnabled } from '@/lib/email';

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Enter a valid email.');

  const email = normalizeEmail(parsed.data.email);
  const ip = getClientIp(req.headers);

  const rate = await enforceRateLimit({ action: 'reference_recovery', ip, email, max: 3, windowHours: 1 });
  if (!rate.ok) return badRequest('Too many recovery requests. Please wait before trying again.', 429);

  const supabase = createSupabaseAdminClient();
  const { data: assignment } = await supabase
    .from('assignments')
    .select(
      'assignment_ref,email,full_name,day_to_day,incidents,kpi_assessment,consent_read_on_show,jobs(title,job_ref,description,reports_to,salary_benefits)'
    )
    .eq('active', true)
    .ilike('email', email)
    .single();

  if (!assignment) {
    return ok({ message: 'No active record found for that email. Please apply for a role first.' });
  }

  if (!isEmailEnabled()) {
    return badRequest('Email is temporarily unavailable. Please try again later.');
  }

  const jobsRel = assignment.jobs as
    | {
        title?: string;
        job_ref?: string;
        description?: string;
        reports_to?: string;
        salary_benefits?: string;
      }[]
    | {
        title?: string;
        job_ref?: string;
        description?: string;
        reports_to?: string;
        salary_benefits?: string;
      }
    | null
    | undefined;
  const job = Array.isArray(jobsRel) ? jobsRel[0] : jobsRel;
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const directEditLink =
    `${appBaseUrl}/my-job/file?email=${encodeURIComponent(email)}&ref=${encodeURIComponent(assignment.assignment_ref)}`;

  await sendApplicationConfirmationEmail({
    to: email,
    emailAddress: email,
    fullName: assignment.full_name || 'Performer',
    jobTitle: job?.title || 'Circus Role',
    jobReference: job?.job_ref || assignment.assignment_ref,
    assignmentRef: assignment.assignment_ref,
    jobShortDescription: job?.description || '',
    reportsTo: job?.reports_to || '',
    salaryText: job?.salary_benefits || '',
    applicationDayToDay: assignment.day_to_day || '',
    applicationIncidents: assignment.incidents || '',
    applicationKpiAssessment: assignment.kpi_assessment || '',
    consentReadOnShow: Boolean(assignment.consent_read_on_show),
    editApplicationUrl: directEditLink,
    myJobUrl: `${appBaseUrl}/my-job`
  });

  return ok({ message: 'If we found your role, we have emailed your existing job details and reference number.' });
}
