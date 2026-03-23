import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { isUuid } from '@/lib/blog/validation';
import {
  attachPrepublishDraft,
  getPrepublishDraftById,
  updatePrepublishDraftWorkflow
} from '@/lib/episode-prepublish-drafts';
import { createSupabaseAdminClient } from '@/lib/supabase';

function revalidateEpisodePaths(slug: string) {
  const value = `${slug || ''}`.trim();
  if (!value) return;
  revalidatePath(`/episodes/${value}`);
  revalidatePath(`/workspace/dashboard/episodes/${value}`);
  revalidatePath('/workspace/dashboard/episodes');
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid draft id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const payload = await req.json().catch(() => ({}));
    const decision = `${payload?.decision || ''}`.trim();
    if (decision !== 'apply_planned' && decision !== 'keep_live') {
      return badRequest('Invalid conflict decision.');
    }

    const draft = await getPrepublishDraftById(params.id);
    if (!draft) return badRequest('Draft not found.', 404);

    const episodeId = `${payload?.episodeId || draft.matchedEpisodeId || draft.candidateEpisodeIds[0] || ''}`.trim();
    if (!isUuid(episodeId)) {
      return badRequest('Valid episodeId is required to resolve conflict.');
    }

    if (decision === 'keep_live') {
      const note = `${payload?.note || ''}`.trim();
      const nextNotes = [draft.manualMatchNotes, `[${new Date().toISOString()}] Conflict resolved by ${user.id || 'unknown'}: kept live editorial${note ? ` (${note})` : ''}`]
        .filter(Boolean)
        .join('\n');

      const item = await updatePrepublishDraftWorkflow({
        id: draft.id,
        actor: user.id || null,
        status: 'archived',
        reviewReason: 'Conflict resolved by keeping existing live editorial.',
        manualMatchNotes: nextNotes,
        archive: true
      });
      return ok({ result: { status: 'kept_live' }, item });
    }

    const result = await attachPrepublishDraft({
      draftId: draft.id,
      episodeId,
      actor: user.id || null,
      method: 'conflict_resolution',
      forceConflict: true
    });

    if (result.status !== 'attached') {
      return badRequest(result.error || `Conflict apply failed with status ${result.status}.`, 400);
    }

    const supabase = createSupabaseAdminClient();
    const { data: episodeRow, error: episodeError } = await supabase
      .from('podcast_episodes')
      .select('slug')
      .eq('id', episodeId)
      .maybeSingle();
    if (episodeError) throw episodeError;
    if (episodeRow?.slug) {
      revalidateEpisodePaths(episodeRow.slug);
    }

    return ok({ result });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to resolve conflict.'), 500);
  }
}
