import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { normalizeAssignmentRef, normalizeEmail } from '@/lib/utils';

const schema = z.object({
  assignmentId: z.string().uuid(),
  accessEmail: z.string().email(),
  accessRef: z.string().min(4),
  profile_photo_data_url: z.string().nullable()
});

export async function PATCH(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid photo payload.');

  const input = parsed.data;
  const accessEmail = normalizeEmail(input.accessEmail);
  const accessRef = normalizeAssignmentRef(input.accessRef);
  const photoValue = `${input.profile_photo_data_url || ''}`.trim();

  if (photoValue && !/^data:image\/(png|jpe?g|webp);base64,/i.test(photoValue)) {
    return badRequest('Profile photo must be PNG, JPG, or WEBP.');
  }

  const admin = createSupabaseAdminClient();
  const { data: assignment } = await admin
    .from('assignments')
    .select('id,assignment_ref')
    .eq('id', input.assignmentId)
    .eq('active', true)
    .ilike('email', accessEmail)
    .eq('assignment_ref', accessRef)
    .single();

  if (!assignment) return badRequest('Assignment not found for your account.', 404);

  const assignUpdate = await admin
    .from('assignments')
    .update({ profile_photo_data_url: photoValue || null })
    .eq('id', assignment.id);
  if (assignUpdate.error) {
    if (assignUpdate.error.message.includes('profile_photo_data_url')) {
      return badRequest(
        "Profile photo column is missing in assignments. Run migration 0006_add_profile_photo_to_assignments_and_archive.sql."
      );
    }
    return badRequest(assignUpdate.error.message);
  }

  const archiveUpdate = await admin
    .from('applications_archive')
    .update({ profile_photo_data_url: photoValue || null, last_updated_at: new Date().toISOString() })
    .eq('assignment_ref', assignment.assignment_ref);

  if (archiveUpdate.error && !archiveUpdate.error.message.includes('profile_photo_data_url')) {
    return badRequest(archiveUpdate.error.message);
  }

  return ok({
    message: archiveUpdate.error?.message?.includes('profile_photo_data_url')
      ? 'Photo updated (archive photo column is not available in this database).'
      : 'Photo updated.'
  });
}
