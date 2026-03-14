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
      mode: 'full',
      episodeId: params.id
    });

    const supabase = createSupabaseAdminClient();
    const clearEditorial = await supabase
      .from('podcast_episode_editorial')
      .update({
        web_title: null,
        web_slug: null,
        excerpt: null,
        body_json: [],
        body_markdown: null,
        hero_image_url: null,
        hero_image_storage_path: null,
        seo_title: null,
        meta_description: null,
        canonical_url_override: null,
        social_title: null,
        social_description: null,
        social_image_url: null,
        noindex: false,
        nofollow: false,
        is_featured: false,
        is_visible: true,
        is_archived: false,
        editorial_notes: null
      })
      .eq('episode_id', params.id);
    if (clearEditorial.error) throw clearEditorial.error;

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

    return ok({
      ...result,
      editorialCleared: true
    });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to fully reset episode from RSS.'), 500);
  }
}
