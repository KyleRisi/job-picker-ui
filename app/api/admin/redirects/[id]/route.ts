import { NextRequest } from 'next/server';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizeRedirectInput } from '@/lib/redirects';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('redirects')
    .select('id,source_path,target_url,status_code,match_type,is_active,priority,notes,source_type,source_ref,created_at,updated_at')
    .eq('id', params.id)
    .maybeSingle();

  if (error) return badRequest(error.message);
  if (!data) return badRequest('Redirect not found.', 404);
  return ok({ item: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  try {
    const body = await req.json();
    const payload = normalizeRedirectInput(body);

    const supabase = createSupabaseAdminClient();
    const update = await supabase
      .from('redirects')
      .update(payload)
      .eq('id', params.id)
      .select('id,source_path,target_url,status_code,match_type,is_active,priority,notes,source_type,source_ref,created_at,updated_at')
      .maybeSingle();

    if (update.error) return badRequest(update.error.message);
    if (!update.data) return badRequest('Redirect not found.', 404);

    return ok({ item: update.data });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Invalid redirect payload.');
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const supabase = createSupabaseAdminClient();
  const del = await supabase.from('redirects').delete().eq('id', params.id);
  if (del.error) return badRequest(del.error.message);
  return ok({ message: 'Redirect deleted.' });
}
