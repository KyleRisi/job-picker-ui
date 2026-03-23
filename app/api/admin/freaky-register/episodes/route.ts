import { NextRequest } from 'next/server';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await requireAdminInApi();
  if (!admin) return badRequest('Forbidden.', 403);

  const query = (request.nextUrl.searchParams.get('q') || '').trim();
  const supabase = createSupabaseAdminClient();

  let dbQuery = supabase
    .from('podcast_episodes')
    .select('id,title,slug,published_at')
    .eq('is_visible', true)
    .eq('is_archived', false)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(25);

  if (query) {
    const escaped = query.replace(/,/g, ' ');
    dbQuery = dbQuery.or(`title.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  const { data, error } = await dbQuery;
  if (error) return badRequest(error.message, 500);

  return ok({ items: data || [] });
}
