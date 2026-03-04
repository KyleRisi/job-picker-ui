import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { requireAdminInApi } from '@/lib/api-auth';

const patchSchema = z.object({
  status: z.enum(['new', 'read', 'archived'])
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid contact status payload.');

  const supabase = createSupabaseAdminClient();
  const update = await supabase
    .from('contact_submissions')
    .update({ status: parsed.data.status })
    .eq('id', params.id)
    .select('id,status')
    .maybeSingle();

  if (update.error) return badRequest(update.error.message);
  if (!update.data) return badRequest('Contact submission not found.', 404);

  return ok({ item: update.data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const supabase = createSupabaseAdminClient();
  const deletion = await supabase
    .from('contact_submissions')
    .delete()
    .eq('id', params.id)
    .select('id')
    .maybeSingle();

  if (deletion.error) return badRequest(deletion.error.message);
  if (!deletion.data) return badRequest('Contact submission not found.', 404);

  return ok({ deleted: true, id: deletion.data.id });
}
