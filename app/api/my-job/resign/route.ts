import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { normalizeAssignmentRef, normalizeEmail } from '@/lib/utils';

const schema = z.object({
  assignmentId: z.string().uuid(),
  accessEmail: z.string().email(),
  accessRef: z.string().min(4),
  exitQ1: z.string().min(1),
  exitQ2: z.string().min(1),
  exitQ3: z.string().min(1)
});

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

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Please answer all exit interview questions.');

  const input = parsed.data;
  const accessEmail = normalizeEmail(input.accessEmail);
  const accessRef = normalizeAssignmentRef(input.accessRef);
  const admin = createSupabaseAdminClient();

  const { data: assignment } = await admin
    .from('assignments')
    .select('id,email,assignment_ref,job_id')
    .eq('id', input.assignmentId)
    .eq('active', true)
    .ilike('email', accessEmail)
    .eq('assignment_ref', accessRef)
    .single();

  if (!assignment) return badRequest('Assignment not found.', 404);

  const rpc = await admin.rpc('resign_assignment_atomic', {
    p_assignment_id: input.assignmentId,
    p_exit_q1: input.exitQ1,
    p_exit_q2: input.exitQ2,
    p_exit_q3: input.exitQ3
  });

  if (rpc.error) return badRequest(rpc.error.message);

  const rehiringReasons = await getRehiringReasons(admin);
  await admin
    .from('jobs')
    .update({ rehiring_reason: pickRandomReason(rehiringReasons) })
    .eq('id', assignment.job_id);

  return ok({ message: 'Resignation complete.' });
}
