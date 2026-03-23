import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';
import { WorkspaceBlogEditor } from '@/components/workspace/workspace-blog-editor';
import { WorkspaceEpisodeDraftPanel } from '@/components/workspace/workspace-episode-draft-panel';
import { getPrepublishDraftById } from '@/lib/episode-prepublish-drafts';
import { listBlogAuthors, listBlogPostsAdmin, listPodcastEpisodes } from '@/lib/blog/data';
import { listActiveDiscoveryTerms } from '@/lib/episodes';
import { isApprovedCollectionSlug, isApprovedTopicSlug } from '@/lib/taxonomy-route-policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toDateStartIso(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default async function EpisodeDraftEditorPage({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await params;

  const [draft, episodeRows, postRows, discoveryTerms, authorRows] = await Promise.all([
    getPrepublishDraftById(id),
    listPodcastEpisodes({ includeHidden: true }),
    listBlogPostsAdmin({ pageSize: 100, includeDeleted: false, sort: 'updated' }),
    listActiveDiscoveryTerms(),
    listBlogAuthors({ includeArchived: false })
  ]);

  if (!draft) notFound();

  const episodes = episodeRows.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    audioUrl: item.audio_url,
    artworkUrl: item.artwork_url,
    episodeNumber: item.episode_number,
    publishedAt: item.published_at
  }));

  const relatedPosts = (postRows.items || []).map((item) => ({ id: item.id, title: item.title }));
  const discoveryById = new Map(discoveryTerms.map((term) => [term.id, term]));

  const discoveryRows = Array.isArray(draft.editorialPayload.discovery) ? draft.editorialPayload.discovery : [];

  const primaryTopicId = discoveryRows.find((row) => {
    const term = discoveryById.get(row.termId);
    return row.isPrimary && term?.termType === 'topic';
  })?.termId || null;

  const secondaryTopicIds = discoveryRows
    .filter((row) => {
      const term = discoveryById.get(row.termId);
      return term?.termType === 'topic' && row.termId !== primaryTopicId;
    })
    .map((row) => row.termId)
    .slice(0, 1);

  const themeIds = discoveryRows
    .filter((row) => discoveryById.get(row.termId)?.termType === 'theme')
    .map((row) => row.termId);

  const entityIds = discoveryRows
    .filter((row) => discoveryById.get(row.termId)?.termType === 'entity')
    .map((row) => row.termId);

  const caseIds = discoveryRows
    .filter((row) => discoveryById.get(row.termId)?.termType === 'case')
    .map((row) => row.termId);

  const eventIds = discoveryRows
    .filter((row) => discoveryById.get(row.termId)?.termType === 'event')
    .map((row) => row.termId);

  const collectionIds = discoveryRows
    .filter((row) => discoveryById.get(row.termId)?.termType === 'collection')
    .map((row) => row.termId)
    .slice(0, 1);

  const seriesIds = discoveryRows
    .filter((row) => discoveryById.get(row.termId)?.termType === 'series')
    .map((row) => row.termId);

  const editorial = draft.editorialPayload.editorial || {};
  const rawBody = (editorial as { bodyJson?: unknown[] }).bodyJson;
  const bodyJson = Array.isArray(rawBody) ? rawBody : [];

  const relatedEpisodeIds = Array.isArray(draft.editorialPayload.relatedEpisodes)
    ? draft.editorialPayload.relatedEpisodes.map((item) => item.episodeId).filter(Boolean)
    : [];

  const relatedPostIds = Array.isArray(draft.editorialPayload.relatedPosts)
    ? draft.editorialPayload.relatedPosts.map((item) => item.postId).filter(Boolean)
    : [];

  const status = (editorial as { isArchived?: boolean; isVisible?: boolean }).isArchived
    ? 'archived'
    : (editorial as { isVisible?: boolean }).isVisible === false
      ? 'draft'
      : 'published';

  const postLike = {
    id: draft.id,
    title: (editorial as { webTitle?: string | null }).webTitle || draft.title || '',
    slug: '',
    status,
    excerpt: (editorial as { excerpt?: string | null }).excerpt || '',
    content_json: bodyJson,
    published_at: toDateStartIso(draft.expectedPublishDate),
    is_featured: (editorial as { isFeatured?: boolean }).isFeatured === true,
    author_id: (editorial as { authorId?: string | null }).authorId || null,
    author: null,
    featured_image: {
      id: null,
      url: (editorial as { heroImageUrl?: string | null }).heroImageUrl || '',
      alt_text: null
    },
    taxonomies: {
      categories: [],
      tags: []
    },
    revisions: [],
    seo_title: (editorial as { seoTitle?: string | null }).seoTitle || null,
    seo_description: (editorial as { metaDescription?: string | null }).metaDescription || null,
    focus_keyword: (editorial as { focusKeyword?: string | null }).focusKeyword || null,
    canonical_url: (editorial as { canonicalUrlOverride?: string | null }).canonicalUrlOverride || null,
    noindex: (editorial as { noindex?: boolean }).noindex === true,
    nofollow: (editorial as { nofollow?: boolean }).nofollow === true,
    social_title: (editorial as { socialTitle?: string | null }).socialTitle || null,
    social_description: (editorial as { socialDescription?: string | null }).socialDescription || null,
    og_image_id: (editorial as { socialImageUrl?: string | null }).socialImageUrl || null,
    featured_image_storage_path: (editorial as { heroImageStoragePath?: string | null }).heroImageStoragePath || null,
    discovery: {
      primaryTopicId,
      topicIds: secondaryTopicIds,
      themeIds,
      entityIds,
      caseIds,
      eventIds,
      collectionIds,
      seriesIds
    },
    linked_episodes: relatedEpisodeIds.map((episodeId) => ({
      episode: { id: episodeId },
      episode_id: episodeId
    })),
    related_override_ids: relatedPostIds,
    episode: {
      id: draft.id,
      slug: '',
      title: draft.title
    },
    source: {
      is_visible: false,
      is_archived: false,
      last_synced_at: null
    },
    editorial: {
      hero_image_storage_path: (editorial as { heroImageStoragePath?: string | null }).heroImageStoragePath || null,
      author_id: (editorial as { authorId?: string | null }).authorId || null
    }
  };

  const taxonomyOptions = {
    categories: discoveryTerms
      .filter((term) => term.termType === 'topic' && isApprovedTopicSlug(term.slug))
      .map((term) => ({ id: term.id, name: term.name })),
    topics: discoveryTerms
      .filter((term) => term.termType === 'topic' && isApprovedTopicSlug(term.slug))
      .map((term) => ({ id: term.id, name: term.name })),
    themes: discoveryTerms.filter((term) => term.termType === 'theme').map((term) => ({ id: term.id, name: term.name })),
    collections: discoveryTerms
      .filter((term) => term.termType === 'collection' && isApprovedCollectionSlug(term.slug))
      .map((term) => ({ id: term.id, name: term.name })),
    series: discoveryTerms.filter((term) => term.termType === 'series').map((term) => ({ id: term.id, name: term.name }))
  };

  return (
    <WorkspaceBlogEditor
      mode="episode-draft"
      episodeId={draft.id}
      post={postLike as any}
      episodes={episodes}
      relatedPosts={relatedPosts}
      authors={authorRows.map((author) => ({ id: author.id, name: author.name }))}
      taxonomyOptions={taxonomyOptions}
      prepublishDraftControls={(
        <WorkspaceEpisodeDraftPanel
          draft={{
            id: draft.id,
            status: draft.status,
            reviewReason: draft.reviewReason,
            candidateEpisodeIds: draft.candidateEpisodeIds,
            matchedEpisodeId: draft.matchedEpisodeId,
            manualMatchNotes: draft.manualMatchNotes,
            allowTitleCollision: draft.allowTitleCollision,
            lastMatchAttemptAt: draft.lastMatchAttemptAt,
            matchAttemptCount: draft.matchAttemptCount
          }}
          episodes={episodes.map((episode) => ({ id: episode.id, title: episode.title }))}
        />
      )}
    />
  );
}
