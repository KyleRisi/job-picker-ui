import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { requireAdminInApi } from '@/lib/api-auth';
import { firstNameFromFullName, normalizeEmail } from '@/lib/utils';

const patchSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  q1: z.string(),
  q2: z.string(),
  q3: z.string(),
  day_to_day: z.string(),
  incidents: z.string(),
  kpi_assessment: z.string(),
  consent_read_on_show: z.boolean(),
  profile_photo_data_url: z.string().nullable().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid application update payload.');
  const photoValue = `${parsed.data.profile_photo_data_url || ''}`.trim();
  const hasPhotoInPayload = parsed.data.profile_photo_data_url !== undefined;
  const fullName = `${parsed.data.full_name || ''}`.trim();
  const email = normalizeEmail(parsed.data.email);
  const firstName = firstNameFromFullName(fullName);
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

  const archivePayload = {
    full_name: fullName,
    email,
    q1: parsed.data.q1,
    q2: parsed.data.q2,
    q3: parsed.data.q3,
    day_to_day: parsed.data.day_to_day,
    incidents: parsed.data.incidents,
    kpi_assessment: parsed.data.kpi_assessment,
    consent_read_on_show: parsed.data.consent_read_on_show,
    ...(hasPhotoInPayload ? { profile_photo_data_url: photoValue || null } : {}),
    last_updated_at: new Date().toISOString()
  };

  const updateByRef = current.assignment_ref
    ? await supabase
        .from('applications_archive')
        .update(archivePayload)
        .eq('assignment_ref', current.assignment_ref)
        .select('id')
    : null;

  if (updateByRef?.error) return badRequest(updateByRef.error.message);

  if (!updateByRef?.data?.length) {
    const updateById = await supabase
      .from('applications_archive')
      .update(archivePayload)
      .eq('id', params.id)
      .select('id')
      .maybeSingle();
    if (updateById.error) return badRequest(updateById.error.message);
    if (!updateById.data?.id) return badRequest('Could not update archive record.', 404);
  }

  // Prefer assignment_ref when available, but fall back to the active assignment for this job.
  let assignmentUpdate = await supabase
    .from('assignments')
    .update({
      full_name: fullName,
      first_name: firstName,
      email,
      q1: parsed.data.q1,
      q2: parsed.data.q2,
      q3: parsed.data.q3,
      day_to_day: parsed.data.day_to_day,
      incidents: parsed.data.incidents,
      kpi_assessment: parsed.data.kpi_assessment,
      consent_read_on_show: parsed.data.consent_read_on_show,
      ...(hasPhotoInPayload ? { profile_photo_data_url: photoValue || null } : {})
    })
    .eq('assignment_ref', current.assignment_ref)
    .eq('active', true)
    .select('id');

  if (assignmentUpdate.error) return badRequest(assignmentUpdate.error.message);

  if (!assignmentUpdate.data?.length) {
    assignmentUpdate = await supabase
      .from('assignments')
      .update({
        full_name: fullName,
        first_name: firstName,
        email,
        q1: parsed.data.q1,
        q2: parsed.data.q2,
        q3: parsed.data.q3,
        day_to_day: parsed.data.day_to_day,
        incidents: parsed.data.incidents,
        kpi_assessment: parsed.data.kpi_assessment,
        consent_read_on_show: parsed.data.consent_read_on_show,
        ...(hasPhotoInPayload ? { profile_photo_data_url: photoValue || null } : {})
      })
      .eq('job_id', current.job_id)
      .eq('active', true)
      .select('id');
    if (assignmentUpdate.error) return badRequest(assignmentUpdate.error.message);
  }
  if (!assignmentUpdate.data?.length) return badRequest('Could not update active assignment record.', 404);

  return ok({ message: 'Application updated.' });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const supabase = createSupabaseAdminClient();
  const del = await supabase.from('applications_archive').delete().eq('id', params.id);
  if (del.error) return badRequest(del.error.message);

  return ok({ message: 'Application deleted.' });
}
