import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { requireAdminInApi } from '@/lib/api-auth';

const patchSchema = z.object({
  status: z.enum(['visible', 'hidden'])
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('reviews')
    .select('id,title,body,rating,author,country,source,status,received_at,created_at,updated_at')
    .eq('id', params.id)
    .maybeSingle();

  if (error) return badRequest(error.message);
  if (!data) return badRequest('Review not found.', 404);

  return ok({ item: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid review status payload.');

  const supabase = createSupabaseAdminClient();
  const update = await supabase
    .from('reviews')
    .update({ status: parsed.data.status })
    .eq('id', params.id)
    .select('id,status')
    .maybeSingle();

  if (update.error) return badRequest(update.error.message);
  if (!update.data) return badRequest('Review not found.', 404);

  return ok({ item: update.data });
}
