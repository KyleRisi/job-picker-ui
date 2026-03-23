import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { updatePodcastEpisode } from '@/lib/blog/data';
import { isUuid } from '@/lib/blog/validation';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { getResolvedEpisodeById } from '@/lib/episodes';
import { revalidatePath } from 'next/cache';
import {
  applyEpisodeEditorialState,
  isEpisodeEditorialPayload,
  prepareEpisodeEditorialApplyInput
} from '@/lib/episode-editorial';

function revalidateEpisodePaths(slug: string) {
  const value = `${slug || ''}`.trim();
  if (!value) return;
  revalidatePath(`/episodes/${value}`);
  revalidatePath(`/workspace/dashboard/episodes/${value}`);
  revalidatePath('/workspace/dashboard/episodes');
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid episode id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const payload = await req.json();
    if (isEpisodeEditorialPayload(payload)) {
      const supabase = createSupabaseAdminClient();

      const { data: sourceEpisode, error: sourceEpisodeError } = await supabase
        .from('podcast_episodes')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();
      if (sourceEpisodeError) throw sourceEpisodeError;
      if (!sourceEpisode) return badRequest('Episode not found.', 404);

      const applyInput = await prepareEpisodeEditorialApplyInput({
        supabase,
        episodeId: params.id,
        payload
      });
      await applyEpisodeEditorialState({
        supabase,
        episodeId: params.id,
        applyInput
      });

      const resolved = await getResolvedEpisodeById(params.id, { includeHidden: true });
      if (!resolved) return badRequest('Episode not found after save.', 404);
      revalidateEpisodePaths(resolved.slug);

      const discoveryAssignments = {
        primaryTopicId: resolved.primaryTopic?.id || null,
        topicIds: resolved.discoveryTerms
          .filter((term) => term.termType === 'topic' && term.id !== resolved.primaryTopic?.id)
          .map((term) => term.id),
        themeIds: resolved.discoveryTerms.filter((term) => term.termType === 'theme').map((term) => term.id),
        entityIds: resolved.discoveryTerms.filter((term) => term.termType === 'entity').map((term) => term.id),
        caseIds: resolved.discoveryTerms.filter((term) => term.termType === 'case').map((term) => term.id),
        eventIds: resolved.discoveryTerms.filter((term) => term.termType === 'event').map((term) => term.id),
        collectionIds: resolved.discoveryTerms.filter((term) => term.termType === 'collection').map((term) => term.id),
        seriesIds: resolved.discoveryTerms.filter((term) => term.termType === 'series').map((term) => term.id)
      };

      return ok({
        episode: {
          id: resolved.id,
          title: resolved.title,
          slug: resolved.slug,
          excerpt: resolved.excerpt,
          isFeatured: resolved.isFeatured,
          seoTitle: resolved.seoTitle,
          metaDescription: resolved.metaDescription,
          canonicalUrl: resolved.canonicalUrl,
          noindex: resolved.noindex,
          nofollow: resolved.nofollow,
          heroImageUrl: resolved.heroImageUrl,
          artworkUrl: resolved.artworkUrl
        },
        source: {
          title: resolved.source.title,
          slug: resolved.source.slug,
          description_plain: resolved.source.descriptionPlain,
          description_html: resolved.source.descriptionHtml,
          transcript: resolved.source.transcript,
          show_notes: resolved.source.showNotes,
          published_at: resolved.source.publishedAt,
          audio_url: resolved.source.audioUrl,
          artwork_url: resolved.source.artworkUrl,
          source_url: resolved.source.sourceUrl,
          episode_number: resolved.source.episodeNumber,
          season_number: resolved.source.seasonNumber,
          duration_seconds: resolved.source.durationSeconds,
          last_synced_at: resolved.source.lastSyncedAt,
          missing_from_feed_at: resolved.source.missingFromFeedAt,
          is_visible: resolved.isVisible,
          is_archived: resolved.isArchived
        },
        editorial: resolved.editorial
          ? {
              id: resolved.editorial.id,
              web_title: resolved.editorial.webTitle,
              web_slug: resolved.editorial.webSlug,
              excerpt: resolved.editorial.excerpt,
              body_json: resolved.editorial.bodyJson,
              body_markdown: resolved.editorial.bodyMarkdown,
              hero_image_url: resolved.editorial.heroImageUrl,
              hero_image_storage_path: resolved.editorial.heroImageStoragePath,
              seo_title: resolved.editorial.seoTitle,
              meta_description: resolved.editorial.metaDescription,
              canonical_url_override: resolved.editorial.canonicalUrlOverride,
              social_title: resolved.editorial.socialTitle,
              social_description: resolved.editorial.socialDescription,
              social_image_url: resolved.editorial.socialImageUrl,
              noindex: resolved.editorial.noindex,
              nofollow: resolved.editorial.nofollow,
              is_featured: resolved.editorial.isFeatured,
              is_visible: resolved.editorial.isVisible,
              is_archived: resolved.editorial.isArchived,
              editorial_notes: resolved.editorial.editorialNotes
            }
          : null,
        revisions: [],
        assignments: {
          discovery: discoveryAssignments,
          taxonomy: discoveryAssignments,
          relatedEpisodes: resolved.relatedEpisodes.map((item, index) => ({
            episodeId: item.episode.id,
            relationshipType: item.relationshipType,
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index
          })),
          relatedPosts: resolved.relatedPosts.map((item, index) => ({
            postId: item.id,
            sortOrder: index
          }))
        }
      });
    }

    const episode = await updatePodcastEpisode(params.id, payload);
    if (!episode) return badRequest('Episode not found.', 404);
    revalidateEpisodePaths(episode.slug);
    return ok(episode);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to update episode.'), 500);
  }
}
