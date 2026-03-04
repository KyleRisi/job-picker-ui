import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { firstNameFromFullName, normalizeAssignmentRef, normalizeEmail } from '@/lib/utils';

const schema = z.object({
  assignmentId: z.string().uuid(),
  accessEmail: z.string().email(),
  accessRef: z.string().min(4),
  fullName: z.string().min(2),
  email: z.string().email(),
  q1: z.string().min(1),
  q2: z.string().min(1),
  q3: z.string().min(1),
  consentReadOnShow: z.union([z.string(), z.boolean()]).optional(),
  dayToDay: z.string().optional(),
  incidents: z.string().optional(),
  kpiAssessment: z.string().optional()
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Please complete all required fields.');

  const input = parsed.data;
  const accessEmail = normalizeEmail(input.accessEmail);
  const accessRef = normalizeAssignmentRef(input.accessRef);
  const admin = createSupabaseAdminClient();

  const { data: assignment } = await admin
    .from('assignments')
    .select('id,assignment_ref,email')
    .eq('id', input.assignmentId)
    .eq('active', true)
    .ilike('email', accessEmail)
    .eq('assignment_ref', accessRef)
    .single();

  if (!assignment) return badRequest('Assignment not found for your account.', 404);

  const updatedEmail = normalizeEmail(input.email);
  const dayToDay = `${input.dayToDay || ''}`;
  const incidents = `${input.incidents || ''}`;
  const kpiAssessment = `${input.kpiAssessment || ''}`;
  const assignUpdate = await admin
    .from('assignments')
    .update({
      full_name: input.fullName,
      first_name: firstNameFromFullName(input.fullName),
      q1: input.q1,
      q2: input.q2,
      q3: input.q3,
      consent_read_on_show: input.consentReadOnShow === true || input.consentReadOnShow === 'on',
      day_to_day: dayToDay,
      incidents,
      kpi_assessment: kpiAssessment,
      email: updatedEmail
    })
    .eq('id', assignment.id);
  if (assignUpdate.error) return badRequest(assignUpdate.error.message);

  const archiveUpdate = await admin
    .from('applications_archive')
    .update({
      full_name: input.fullName,
      email: updatedEmail,
      q1: input.q1,
      q2: input.q2,
      q3: input.q3,
      consent_read_on_show: input.consentReadOnShow === true || input.consentReadOnShow === 'on',
      day_to_day: dayToDay,
      incidents,
      kpi_assessment: kpiAssessment,
      last_updated_at: new Date().toISOString()
    })
    .eq('assignment_ref', assignment.assignment_ref);
  if (archiveUpdate.error) return badRequest(archiveUpdate.error.message);

  return ok({ message: 'HR file updated.' });
}
