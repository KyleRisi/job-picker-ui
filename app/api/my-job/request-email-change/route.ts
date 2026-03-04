import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { normalizeEmail } from '@/lib/utils';
import { sendEmailChangeConfirmation } from '@/lib/email';
import { env } from '@/lib/env';

const schema = z.object({
  assignmentId: z.string().uuid(),
  newEmail: z.string().email()
});

export async function POST(req: NextRequest) {
  const auth = createSupabaseServerClient();
  const {
    data: { user }
  } = await auth.auth.getUser();
  if (!user?.email) return badRequest('Not signed in.', 401);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Enter a valid new email.');

  const newEmail = normalizeEmail(parsed.data.newEmail);
  if (newEmail === normalizeEmail(user.email)) return badRequest('That is already your current email.');

  const admin = createSupabaseAdminClient();
  const { data: assignment } = await admin
    .from('assignments')
    .select('id,full_name,email')
    .eq('id', parsed.data.assignmentId)
    .eq('active', true)
    .ilike('email', user.email)
    .single();

  if (!assignment) return badRequest('Active assignment not found.', 404);

  const token = randomBytes(24).toString('hex');
  await admin.from('email_change_requests').insert({
    assignment_id: assignment.id,
    user_id: user.id,
    old_email: normalizeEmail(user.email),
    new_email: newEmail,
    token
  });

  const confirmLink = `${env.appBaseUrl}/api/my-job/confirm-email-change?token=${encodeURIComponent(token)}`;
  await sendEmailChangeConfirmation({
    to: newEmail,
    fullName: assignment.full_name,
    confirmLink
  });

  return ok({ message: 'Confirmation link sent to your new email.' });
}
