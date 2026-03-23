import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';

const schema = z.object({
  action: z.enum(['hide', 'unhide', 'spam', 'remove', 'mark_duplicate', 'mark_covered', 'clear_covered', 'set_votes']),
  duplicateOfSuggestionId: z.string().uuid().optional(),
  episodeId: z.string().uuid().optional(),
  upvoteCount: z.coerce.number().int().min(0).max(1_000_000).optional()
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminInApi();
  if (!admin) return badRequest('Forbidden.', 403);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return badRequest('Invalid moderation payload.');

  const supabase = createSupabaseAdminClient();

  const update: Record<string, unknown> = {};
  if (parsed.data.action === 'hide') {
    update.status = 'hidden';
    update.is_visible = false;
  } else if (parsed.data.action === 'unhide') {
    update.status = 'published';
    update.is_visible = true;
  } else if (parsed.data.action === 'spam') {
    update.status = 'spam';
    update.is_visible = false;
  } else if (parsed.data.action === 'remove') {
    update.status = 'removed';
    update.is_visible = false;
  } else if (parsed.data.action === 'mark_covered') {
    if (!parsed.data.episodeId) {
      return badRequest('Episode ID is required.');
    }

    const episodeLookup = await supabase
      .from('podcast_episodes')
      .select('id,is_visible,is_archived')
      .eq('id', parsed.data.episodeId)
      .maybeSingle();
    if (episodeLookup.error) return badRequest(episodeLookup.error.message, 500);
    if (!episodeLookup.data || !episodeLookup.data.is_visible || episodeLookup.data.is_archived) {
      return badRequest('Please select a valid public episode.');
    }

    update.covered_episode_id = parsed.data.episodeId;
    update.covered_at = new Date().toISOString();
  } else if (parsed.data.action === 'clear_covered') {
    update.covered_episode_id = null;
    update.covered_at = null;
  } else if (parsed.data.action === 'set_votes') {
    if (typeof parsed.data.upvoteCount !== 'number' || !Number.isInteger(parsed.data.upvoteCount)) {
      return badRequest('Valid vote count is required.');
    }
    update.upvote_count = parsed.data.upvoteCount;
  } else {
    if (!parsed.data.duplicateOfSuggestionId) {
      return badRequest('Duplicate target suggestion is required.');
    }
    if (parsed.data.duplicateOfSuggestionId === params.id) {
      return badRequest('Suggestion cannot be marked duplicate of itself.');
    }
    update.status = 'duplicate';
    update.is_visible = false;
    update.duplicate_of_suggestion_id = parsed.data.duplicateOfSuggestionId;
  }

  const { data, error } = await supabase
    .from('freaky_suggestions')
    .update(update)
    .eq('id', params.id)
    .select('id,status,is_visible,duplicate_of_suggestion_id,covered_episode_id,covered_at')
    .maybeSingle();

  if (error) return badRequest(error.message, 500);
  if (!data) return badRequest('Suggestion not found.', 404);

  return ok({ item: data });
}
