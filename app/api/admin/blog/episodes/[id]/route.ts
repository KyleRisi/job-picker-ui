import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { updatePodcastEpisode } from '@/lib/blog/data';
import { isUuid } from '@/lib/blog/validation';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { blogDocumentToMarkdown, normalizeBlogDocument, slugifyBlogText } from '@/lib/blog/content';
import { getResolvedEpisodeById } from '@/lib/episodes';
import { revalidatePath } from 'next/cache';

const EPISODE_RELATIONSHIP_TYPES = new Set([
  'related',
  'same_case',
  'same_person',
  'same_theme',
  'part_of_series',
  'recommended_next'
]);

type EpisodeEditorialWritePayload = {
  authorId?: string | null;
  webTitle?: string | null;
  webSlug?: string | null;
  excerpt?: string | null;
  bodyJson?: unknown;
  bodyMarkdown?: string | null;
  heroImageUrl?: string | null;
  heroImageStoragePath?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrlOverride?: string | null;
  socialTitle?: string | null;
  socialDescription?: string | null;
  socialImageUrl?: string | null;
  noindex?: boolean;
  nofollow?: boolean;
  isFeatured?: boolean;
  isVisible?: boolean;
  isArchived?: boolean;
  editorialNotes?: string | null;
  discovery?: {
    primaryTopicId?: string | null;
    themeIds?: string[];
    entityIds?: string[];
    caseIds?: string[];
    eventIds?: string[];
    collectionIds?: string[];
    seriesIds?: string[];
  };
  relatedEpisodes?: Array<{
    episodeId: string;
    relationshipType?: string;
    sortOrder?: number;
  }>;
  relatedPosts?: Array<{
    postId: string;
    sortOrder?: number;
  }>;
};

function isEpisodeEditorialPayload(value: unknown): value is EpisodeEditorialWritePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    'authorId' in payload
    || 'webTitle' in payload
    || 'webSlug' in payload
    || 'excerpt' in payload
    || 'bodyJson' in payload
    || 'seoTitle' in payload
    || 'metaDescription' in payload
    || 'canonicalUrlOverride' in payload
    || 'socialTitle' in payload
    || 'socialDescription' in payload
    || 'socialImageUrl' in payload
    || 'noindex' in payload
    || 'nofollow' in payload
    || 'isFeatured' in payload
    || 'isVisible' in payload
    || 'isArchived' in payload
    || 'editorialNotes' in payload
    || 'discovery' in payload
    || 'relatedEpisodes' in payload
    || 'relatedPosts' in payload
  );
}

function uniqueIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const id = `${value || ''}`.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    output.push(id);
  }
  return output;
}

function asNullableText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function revalidateEpisodePaths(slug: string) {
  const value = `${slug || ''}`.trim();
  if (!value) return;
  revalidatePath(`/episodes/${value}`);
  revalidatePath(`/workspace/dashboard/episodes/${value}`);
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

      const normalizedBodyJson = Array.isArray(payload.bodyJson) ? normalizeBlogDocument(payload.bodyJson) : [];
      const bodyMarkdown =
        typeof payload.bodyMarkdown === 'string'
          ? (payload.bodyMarkdown.trim() || null)
          : (blogDocumentToMarkdown(normalizedBodyJson) || null);
      const normalizedSlug = payload.webSlug ? slugifyBlogText(payload.webSlug) : null;

      const upsertEditorial = await supabase
        .from('podcast_episode_editorial')
        .upsert({
          episode_id: params.id,
          author_id: isUuid(`${payload.authorId || ''}`.trim()) ? `${payload.authorId || ''}`.trim() : null,
          web_title: asNullableText(payload.webTitle),
          web_slug: normalizedSlug,
          excerpt: asNullableText(payload.excerpt),
          body_json: normalizedBodyJson,
          body_markdown: bodyMarkdown,
          hero_image_url: asNullableText(payload.heroImageUrl),
          hero_image_storage_path: asNullableText(payload.heroImageStoragePath),
          seo_title: asNullableText(payload.seoTitle),
          meta_description: asNullableText(payload.metaDescription),
          canonical_url_override: asNullableText(payload.canonicalUrlOverride),
          social_title: asNullableText(payload.socialTitle),
          social_description: asNullableText(payload.socialDescription),
          social_image_url: asNullableText(payload.socialImageUrl),
          noindex: payload.noindex === true,
          nofollow: payload.nofollow === true,
          is_featured: payload.isFeatured === true,
          is_visible: payload.isVisible !== false,
          is_archived: payload.isArchived === true,
          editorial_notes: asNullableText(payload.editorialNotes)
        }, { onConflict: 'episode_id' });
      if (upsertEditorial.error) throw upsertEditorial.error;

      const discovery = payload.discovery || {};
      const primaryTopicId = asNullableText(discovery.primaryTopicId);
      const discoveryIds = [
        ...(primaryTopicId ? [primaryTopicId] : []),
        ...uniqueIds(discovery.themeIds),
        ...uniqueIds(discovery.entityIds),
        ...uniqueIds(discovery.caseIds),
        ...uniqueIds(discovery.eventIds),
        ...uniqueIds(discovery.collectionIds),
        ...uniqueIds(discovery.seriesIds)
      ];
      const dedupedDiscoveryIds = uniqueIds(discoveryIds);

      const clearDiscovery = await supabase
        .from('episode_discovery_terms')
        .delete()
        .eq('episode_id', params.id);
      if (clearDiscovery.error) throw clearDiscovery.error;

      if (dedupedDiscoveryIds.length) {
        const { data: validDiscoveryRows, error: validDiscoveryError } = await supabase
          .from('discovery_terms')
          .select('id')
          .in('id', dedupedDiscoveryIds)
          .eq('is_active', true);
        if (validDiscoveryError) throw validDiscoveryError;
        const validIds = new Set((validDiscoveryRows || []).map((row) => row.id));
        const insertDiscoveryRows = dedupedDiscoveryIds
          .filter((id) => validIds.has(id))
          .map((termId, index) => ({
            episode_id: params.id,
            term_id: termId,
            is_primary: primaryTopicId ? termId === primaryTopicId : index === 0,
            sort_order: index
          }));
        if (insertDiscoveryRows.length) {
          const insertDiscovery = await supabase.from('episode_discovery_terms').insert(insertDiscoveryRows);
          if (insertDiscovery.error) throw insertDiscovery.error;
        }
      }

      const clearRelatedEpisodes = await supabase
        .from('episode_relationships')
        .delete()
        .eq('source_episode_id', params.id);
      if (clearRelatedEpisodes.error) throw clearRelatedEpisodes.error;

      const relatedEpisodes = Array.isArray(payload.relatedEpisodes) ? payload.relatedEpisodes : [];
      const dedupedRelatedEpisodeRows = uniqueIds(relatedEpisodes.map((item) => item?.episodeId))
        .filter((episodeId) => episodeId !== params.id)
        .map((episodeId, index) => {
          const source = relatedEpisodes.find((item) => item?.episodeId === episodeId);
          const relationshipType = `${source?.relationshipType || 'related'}`.trim();
          return {
            source_episode_id: params.id,
            target_episode_id: episodeId,
            relationship_type: EPISODE_RELATIONSHIP_TYPES.has(relationshipType) ? relationshipType : 'related',
            sort_order: typeof source?.sortOrder === 'number' ? source.sortOrder : index
          };
        });

      if (dedupedRelatedEpisodeRows.length) {
        const insertRelatedEpisodes = await supabase.from('episode_relationships').insert(dedupedRelatedEpisodeRows);
        if (insertRelatedEpisodes.error) throw insertRelatedEpisodes.error;
      }

      const clearRelatedPosts = await supabase
        .from('episode_related_posts')
        .delete()
        .eq('episode_id', params.id);
      if (clearRelatedPosts.error) throw clearRelatedPosts.error;

      const relatedPosts = Array.isArray(payload.relatedPosts) ? payload.relatedPosts : [];
      const dedupedRelatedPostRows = uniqueIds(relatedPosts.map((item) => item?.postId))
        .map((postId, index) => {
          const source = relatedPosts.find((item) => item?.postId === postId);
          return {
            episode_id: params.id,
            blog_post_id: postId,
            sort_order: typeof source?.sortOrder === 'number' ? source.sortOrder : index
          };
        });

      if (dedupedRelatedPostRows.length) {
        const insertRelatedPosts = await supabase.from('episode_related_posts').insert(dedupedRelatedPostRows);
        if (insertRelatedPosts.error) throw insertRelatedPosts.error;
      }

      const resolved = await getResolvedEpisodeById(params.id, { includeHidden: true });
      if (!resolved) return badRequest('Episode not found after save.', 404);
      revalidateEpisodePaths(resolved.slug);

      const discoveryAssignments = {
        primaryTopicId: resolved.primaryTopic?.id || null,
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
