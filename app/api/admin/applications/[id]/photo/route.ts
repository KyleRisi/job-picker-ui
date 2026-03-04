import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { requireAdminInApi } from '@/lib/api-auth';

const schema = z.object({
  profile_photo_data_url: z.string().nullable()
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid photo payload.');

  const photoValue = `${parsed.data.profile_photo_data_url || ''}`.trim();
  if (photoValue && !/^data:image\/(png|jpe?g|webp);base64,/i.test(photoValue)) {
    return badRequest('Profile photo must be PNG, JPG, or WEBP.');
  }

  const supabase = createSupabaseAdminClient();
  const { data: current } = await supabase
    .from('applications_archive')
    .select('id,assignment_ref,job_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!current?.job_id) return badRequest('Application not found.', 404);

  // Update active assignment first (source of truth for filled role profile details).
  let assignmentUpdate = await supabase
    .from('assignments')
    .update({ profile_photo_data_url: photoValue || null })
    .eq('assignment_ref', current.assignment_ref)
    .eq('active', true)
    .select('id');

  if (assignmentUpdate.error) {
    // If DB hasn't migrated profile photo column yet, surface a clear message.
    if (assignmentUpdate.error.message.includes('profile_photo_data_url')) {
      return badRequest(
        "Profile photo column is missing in assignments. Run migration 0006_add_profile_photo_to_assignments_and_archive.sql."
      );
    }
    return badRequest(assignmentUpdate.error.message);
  }

  if (!assignmentUpdate.data?.length) {
    assignmentUpdate = await supabase
      .from('assignments')
      .update({ profile_photo_data_url: photoValue || null })
      .eq('job_id', current.job_id)
      .eq('active', true)
      .select('id');
    if (assignmentUpdate.error) return badRequest(assignmentUpdate.error.message);
  }

  // Best-effort update archive (some DBs may not have this column yet).
  const archiveByRef = current.assignment_ref
    ? await supabase
        .from('applications_archive')
        .update({ profile_photo_data_url: photoValue || null })
        .eq('assignment_ref', current.assignment_ref)
        .select('id')
    : null;

  if (archiveByRef?.error && !archiveByRef.error.message.includes('profile_photo_data_url')) {
    return badRequest(archiveByRef.error.message);
  }

  return ok({
    message: archiveByRef?.error?.message?.includes('profile_photo_data_url')
      ? 'Photo updated (archive photo column is not available in this database).'
      : 'Photo updated.'
  });
}
