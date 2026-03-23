import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';

const schema = z.object({
  action: z.enum(['block', 'unblock']),
  reason: z.string().max(500).optional()
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminInApi();
  if (!admin) return badRequest('Forbidden.', 403);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return badRequest('Invalid identity moderation payload.');

  const supabase = createSupabaseAdminClient();

  const update = parsed.data.action === 'block'
    ? {
      is_blocked: true,
      blocked_at: new Date().toISOString(),
      block_reason: `${parsed.data.reason || ''}`.trim()
    }
    : {
      is_blocked: false,
      blocked_at: null,
      block_reason: ''
    };

  const { data, error } = await supabase
    .from('freaky_identities')
    .update(update)
    .eq('id', params.id)
    .select('id,email,is_blocked,blocked_at,block_reason')
    .maybeSingle();

  if (error) return badRequest(error.message, 500);
  if (!data) return badRequest('Identity not found.', 404);

  return ok({ item: data });
}
