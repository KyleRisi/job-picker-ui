import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { isUuid } from '@/lib/blog/validation';
import { syncPodcastEpisodes } from '@/lib/blog/rss-sync';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid episode id.');

  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const result = await syncPodcastEpisodes({
      mode: 'metadata_without_content',
      episodeId: params.id
    });

    const supabase = createSupabaseAdminClient();
    const { data: episodeRow, error: episodeRowError } = await supabase
      .from('podcast_episodes')
      .select('slug')
      .eq('id', params.id)
      .maybeSingle();
    if (episodeRowError) throw episodeRowError;
    const slug = `${episodeRow?.slug || ''}`.trim();
    if (slug) {
      revalidatePath(`/episodes/${slug}`);
      revalidatePath(`/workspace/dashboard/episodes/${slug}`);
    }

    return ok(result);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to sync episode source from RSS.'), 500);
  }
}
