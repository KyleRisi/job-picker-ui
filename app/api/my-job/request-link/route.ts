import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp, normalizeAssignmentRef, normalizeEmail } from '@/lib/utils';

const schema = z.object({
  email: z.string().email(),
  assignmentRef: z.string().min(4)
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Enter both email and reference number.');

  const email = normalizeEmail(parsed.data.email);
  const assignmentRef = normalizeAssignmentRef(parsed.data.assignmentRef);
  const ip = getClientIp(req.headers);

  const rate = await enforceRateLimit({ action: 'magic_link_send', ip, email, max: 5, windowHours: 1 });
  if (!rate.ok) return badRequest('Too many access attempts. Please wait an hour.', 429);

  const supabase = createSupabaseAdminClient();
  const { data: assignmentByRef } = await supabase
    .from('assignments')
    .select('assignment_ref,email')
    .eq('active', true)
    .eq('assignment_ref', assignmentRef)
    .ilike('email', email)
    .single();

  let assignment = assignmentByRef;
  if (!assignment) {
    const { data: assignmentByJobRef } = await supabase
      .from('assignments')
      .select('assignment_ref,email,jobs!inner(job_ref)')
      .eq('active', true)
      .ilike('email', email)
      .ilike('jobs.job_ref', assignmentRef)
      .single();
    assignment = assignmentByJobRef as { assignment_ref: string; email: string } | null;
  }

  if (!assignment) {
    return badRequest('That email and reference did not match an active circus role.');
  }

  return ok({
    message: 'Access granted.',
    redirectTo: `/my-job/file?email=${encodeURIComponent(email)}&ref=${encodeURIComponent(assignment.assignment_ref)}`
  });
}
