import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { badRequest, ok } from '@/lib/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { requireAdminInApi } from '@/lib/api-auth';

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

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const supabase = createSupabaseAdminClient();
  const { data: application } = await supabase
    .from('applications_archive')
    .select('id,job_id,assignment_ref')
    .eq('id', params.id)
    .single();

  if (!application) return badRequest('Application not found.', 404);

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id')
    .eq('assignment_ref', application.assignment_ref)
    .eq('active', true)
    .maybeSingle();

  if (assignment) {
    const clear = await supabase
      .from('assignments')
      .update({
        active: false,
        day_to_day: '',
        incidents: '',
        kpi_assessment: '',
        full_name: '[fired]',
        first_name: '[fired]',
        email: `fired+${randomUUID()}@example.invalid`
      })
      .eq('id', assignment.id);

    if (clear.error) return badRequest(clear.error.message);
  }

  const rehiringReasons = await getRehiringReasons(supabase);
  const jobUpdate = await supabase
    .from('jobs')
    .update({ status: 'REHIRING', rehiring_reason: pickRandomReason(rehiringReasons) })
    .eq('id', application.job_id);

  if (jobUpdate.error) return badRequest(jobUpdate.error.message);

  const archiveDelete = await supabase.from('applications_archive').delete().eq('id', params.id);
  if (archiveDelete.error) return badRequest(archiveDelete.error.message);

  return ok({ message: 'Applicant fired. Application removed and role moved to REHIRING.' });
}
