import { NextRequest } from 'next/server';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await requireAdminInApi();
  if (!admin) return badRequest('Forbidden.', 403);

  const statusFilter = (request.nextUrl.searchParams.get('status') || '').trim();
  const query = (request.nextUrl.searchParams.get('query') || '').trim();

  const supabase = createSupabaseAdminClient();
  let dbQuery = supabase
    .from('freaky_suggestions')
    .select('id,title,description,status,is_visible,upvote_count,created_at,verification_completed_at,duplicate_of_suggestion_id,submitted_by_identity_id,submitted_name,submitted_full_name,submitted_country,topic_term_id,topic_slug,topic_name,covered_episode_id,covered_at,covered_episode:covered_episode_id(id,title,slug,published_at),freaky_identities!freaky_suggestions_submitted_by_identity_id_fkey(id,email,email_verified_at,is_blocked,blocked_at,block_reason)')
    .order('created_at', { ascending: false })
    .limit(250);

  if (statusFilter) dbQuery = dbQuery.eq('status', statusFilter);
  if (query) dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);

  const { data, error } = await dbQuery;
  if (error) return badRequest(error.message, 500);

  return ok({ items: data || [] });
}
