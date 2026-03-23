import { NextRequest } from 'next/server';
import { badRequest, ok } from '@/lib/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-freaky-cleanup-secret') || '';
  if (!env.freakyCleanupSecret || secret !== env.freakyCleanupSecret) {
    return badRequest('Forbidden.', 403);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc('freaky_register_cleanup');
    if (error) return badRequest(error.message, 500);
    return ok({ ok: true, result: data || null });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Cleanup failed.', 500);
  }
}
