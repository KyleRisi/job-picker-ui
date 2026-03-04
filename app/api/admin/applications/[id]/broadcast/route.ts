import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { requireAdminInApi } from '@/lib/api-auth';

const schema = z.object({
  broadcasted: z.boolean()
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid broadcast payload.');

  const supabase = createSupabaseAdminClient();
  let update = await supabase
    .from('applications_archive')
    .update({
      broadcasted_on_show: parsed.data.broadcasted,
      broadcasted_at: parsed.data.broadcasted ? new Date().toISOString() : null,
      last_updated_at: new Date().toISOString()
    })
    .eq('id', params.id);

  // Backward compatibility for databases that do not yet have broadcasted_at.
  if (update.error?.message?.includes('broadcasted_at')) {
    update = await supabase
      .from('applications_archive')
      .update({
        broadcasted_on_show: parsed.data.broadcasted,
        last_updated_at: new Date().toISOString()
      })
      .eq('id', params.id);
  }

  if (update.error?.message?.includes('broadcasted_on_show')) {
    return badRequest(
      'Broadcast tracking columns are missing in your database. Run migration 0005_add_broadcast_fields_to_applications_archive.sql, then try again.'
    );
  }

  if (update.error) return badRequest(update.error.message);
  return ok({ message: parsed.data.broadcasted ? 'Marked as broadcasted.' : 'Marked as not broadcasted.' });
}
