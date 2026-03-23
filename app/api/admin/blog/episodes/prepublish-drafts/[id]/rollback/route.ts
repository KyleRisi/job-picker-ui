import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { isUuid } from '@/lib/blog/validation';
import { restoreEpisodeStateFromSnapshot } from '@/lib/episode-prepublish-drafts';
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
    const snapshotId = `${payload?.snapshotId || ''}`.trim();
    if (!isUuid(snapshotId)) {
      return badRequest('Valid snapshotId is required.');
    }

    const result = await restoreEpisodeStateFromSnapshot({
      snapshotId,
      actor: user.id || null,
      force: payload?.force === true,
      restoreNote: typeof payload?.restoreNote === 'string' ? payload.restoreNote : null
    });

    if (result.status === 'stale') {
      return ok({ result, requiresConfirmation: true }, 409);
    }
    if (result.status === 'not_found') {
      return badRequest(result.error || 'Snapshot not found.', 404);
    }

    const episodeId = `${result.episodeId || ''}`.trim();
    if (isUuid(episodeId)) {
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
    }

    return ok({ result });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to rollback draft attach.'), 500);
  }
}
