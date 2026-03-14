import { revalidatePath } from 'next/cache';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { syncPodcastEpisodes } from '@/lib/blog/rss-sync';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function POST() {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const supabase = createSupabaseAdminClient();

    const result = await syncPodcastEpisodes({ mode: 'full' });

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
      .not('episode_id', 'is', null);
    if (clearEditorial.error) throw clearEditorial.error;

    const { data: rows, error: rowsError } = await supabase
      .from('podcast_episodes')
      .select('slug')
      .not('slug', 'is', null);
    if (rowsError) throw rowsError;

    const slugs = Array.from(
      new Set(
        (rows || [])
          .map((row) => `${row.slug || ''}`.trim())
          .filter(Boolean)
      )
    );

    revalidatePath('/episodes');
    revalidatePath('/workspace/dashboard/episodes');
    slugs.forEach((slug) => {
      revalidatePath(`/episodes/${slug}`);
      revalidatePath(`/workspace/dashboard/episodes/${slug}`);
    });

    return ok({
      ...result,
      editorialCleared: true,
      revalidatedEpisodePages: slugs.length
    });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to reset all episodes from RSS.'), 500);
  }
}

