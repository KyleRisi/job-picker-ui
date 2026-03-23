import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { isUuid } from '@/lib/blog/validation';
import { attachPrepublishDraft } from '@/lib/episode-prepublish-drafts';
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
    const episodeId = `${payload?.episodeId || ''}`.trim();
    if (!isUuid(episodeId)) return badRequest('Invalid episode id.');

    const method = payload?.method === 'conflict_resolution' ? 'conflict_resolution' : 'manual';
    const result = await attachPrepublishDraft({
      draftId: params.id,
      episodeId,
      actor: user.id || null,
      method,
      forceConflict: payload?.forceConflict === true
    });

    if (result.status === 'invalid' || result.status === 'not_found') {
      return badRequest(result.error || 'Attach failed.', 400);
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
    return badRequest(getErrorMessage(error, 'Failed to attach draft.'), 500);
  }
}
