import { slugifyBlogText } from '@/lib/blog/content';
import { isApprovedCollectionSlug, isApprovedTopicSlug } from '@/lib/taxonomy-route-policy';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const EPISODE_RELATIONSHIP_TYPES = new Set([
  'related',
  'same_case',
  'same_person',
  'same_theme',
  'part_of_series',
  'recommended_next'
]);

export type EpisodeEditorialWritePayload = {
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
  focusKeyword?: string | null;
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
    topicIds?: string[];
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

export type EpisodeEditorialApplyInput = {
  editorial: {
    authorId: string | null;
    webTitle: string | null;
    webSlug: string | null;
    excerpt: string | null;
    bodyJson: unknown[];
    bodyMarkdown: string | null;
    heroImageUrl: string | null;
    heroImageStoragePath: string | null;
    seoTitle: string | null;
    metaDescription: string | null;
    focusKeyword: string | null;
    canonicalUrlOverride: string | null;
    socialTitle: string | null;
    socialDescription: string | null;
    socialImageUrl: string | null;
    noindex: boolean;
    nofollow: boolean;
    isFeatured: boolean;
    isVisible: boolean;
    isArchived: boolean;
    editorialNotes: string | null;
  };
  discoveryRows: Array<{ termId: string; isPrimary: boolean; sortOrder: number }>;
  relatedEpisodeRows: Array<{ episodeId: string; relationshipType: string; sortOrder: number }>;
  relatedPostRows: Array<{ postId: string; sortOrder: number }>;
};

type SupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export function asNullableText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function uniqueIds(values: unknown): string[] {
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

function normalizeDashLike(value: string) {
  return value.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');
}

function normalizeQuoteLike(value: string) {
  return value
    .replace(/[\u2018\u2019\u201B\u2032\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"');
}

export function normalizeEpisodeDraftTitle(value: string) {
  return normalizeDashLike(normalizeQuoteLike(`${value || ''}`))
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export async function hasMeaningfulEpisodeConflict(supabase: SupabaseClient, episodeId: string) {
  const { data, error } = await supabase.rpc('episode_has_meaningful_editorial_conflict', {
    p_episode_id: episodeId
  });
  if (error) throw error;
  return Boolean(data);
}

export async function prepareEpisodeEditorialApplyInput(input: {
  supabase: SupabaseClient;
  episodeId: string;
  payload: EpisodeEditorialWritePayload;
}) {
  const { supabase, payload, episodeId } = input;

  const normalizedBodyJson = Array.isArray(payload.bodyJson) ? payload.bodyJson : [];
  const normalizedSlug = payload.webSlug ? slugifyBlogText(payload.webSlug) : null;

  const discovery = payload.discovery || {};
  const primaryTopicId = asNullableText(discovery.primaryTopicId);
  if (!primaryTopicId) {
    throw new Error('Episodes must include exactly one primary topic.');
  }

  const rawSecondaryTopicIds = uniqueIds(discovery.topicIds).filter((id) => id !== primaryTopicId);
  if (rawSecondaryTopicIds.length > 1) {
    throw new Error('Episodes can include at most one secondary topic.');
  }

  const rawCollectionIds = uniqueIds(discovery.collectionIds);
  if (rawCollectionIds.length > 1) {
    throw new Error('Episodes can include at most one collection.');
  }

  const rawThemeIds = uniqueIds(discovery.themeIds);
  const rawEntityIds = uniqueIds(discovery.entityIds);
  const rawCaseIds = uniqueIds(discovery.caseIds);
  const rawEventIds = uniqueIds(discovery.eventIds);
  const rawSeriesIds = uniqueIds(discovery.seriesIds);

  const requestedDiscoveryIds = uniqueIds([
    primaryTopicId,
    ...rawSecondaryTopicIds,
    ...rawThemeIds,
    ...rawEntityIds,
    ...rawCaseIds,
    ...rawEventIds,
    ...rawCollectionIds,
    ...rawSeriesIds
  ]);

  const { data: validDiscoveryRows, error: validDiscoveryError } = requestedDiscoveryIds.length
    ? await supabase
        .from('discovery_terms')
        .select('id,term_type,slug,is_active')
        .in('id', requestedDiscoveryIds)
        .eq('is_active', true)
    : { data: [], error: null };
  if (validDiscoveryError) throw validDiscoveryError;

  const validRows = (validDiscoveryRows || []) as Array<{ id: string; term_type: string; slug: string; is_active: boolean }>;
  const validRowById = new Map(validRows.map((row) => [row.id, row]));

  const primaryTopicRow = validRowById.get(primaryTopicId);
  if (!primaryTopicRow || primaryTopicRow.term_type !== 'topic' || !isApprovedTopicSlug(primaryTopicRow.slug)) {
    throw new Error('Primary topic must be one active approved topic.');
  }

  const secondaryTopicIds = rawSecondaryTopicIds.filter((id) => {
    const row = validRowById.get(id);
    return Boolean(row && row.term_type === 'topic' && isApprovedTopicSlug(row.slug));
  });
  if (secondaryTopicIds.length !== rawSecondaryTopicIds.length) {
    throw new Error('Secondary topic must be an active approved topic.');
  }

  const collectionIds = rawCollectionIds.filter((id) => {
    const row = validRowById.get(id);
    return Boolean(row && row.term_type === 'collection' && isApprovedCollectionSlug(row.slug));
  });
  if (collectionIds.length !== rawCollectionIds.length) {
    throw new Error('Collection must be an active approved collection.');
  }

  const themeIds = rawThemeIds.filter((id) => validRowById.get(id)?.term_type === 'theme');
  const entityIds = rawEntityIds.filter((id) => validRowById.get(id)?.term_type === 'entity');
  const caseIds = rawCaseIds.filter((id) => validRowById.get(id)?.term_type === 'case');
  const eventIds = rawEventIds.filter((id) => validRowById.get(id)?.term_type === 'event');
  const seriesIds = rawSeriesIds.filter((id) => validRowById.get(id)?.term_type === 'series');

  const dedupedDiscoveryIds = uniqueIds([
    primaryTopicId,
    ...secondaryTopicIds,
    ...themeIds,
    ...entityIds,
    ...caseIds,
    ...eventIds,
    ...collectionIds,
    ...seriesIds
  ]);

  const relatedEpisodes = Array.isArray(payload.relatedEpisodes) ? payload.relatedEpisodes : [];
  const dedupedRelatedEpisodeRows = uniqueIds(relatedEpisodes.map((item) => item?.episodeId))
    .filter((relatedEpisodeId) => relatedEpisodeId !== episodeId)
    .map((relatedEpisodeId, index) => {
      const source = relatedEpisodes.find((item) => item?.episodeId === relatedEpisodeId);
      const relationshipType = `${source?.relationshipType || 'related'}`.trim();
      return {
        episodeId: relatedEpisodeId,
        relationshipType: EPISODE_RELATIONSHIP_TYPES.has(relationshipType) ? relationshipType : 'related',
        sortOrder: typeof source?.sortOrder === 'number' ? source.sortOrder : index
      };
    });

  const relatedPosts = Array.isArray(payload.relatedPosts) ? payload.relatedPosts : [];
  const dedupedRelatedPostRows = uniqueIds(relatedPosts.map((item) => item?.postId))
    .map((postId, index) => {
      const source = relatedPosts.find((item) => item?.postId === postId);
      return {
        postId,
        sortOrder: typeof source?.sortOrder === 'number' ? source.sortOrder : index
      };
    });

  return {
    editorial: {
      authorId: asNullableText(payload.authorId),
      webTitle: asNullableText(payload.webTitle),
      webSlug: normalizedSlug,
      excerpt: asNullableText(payload.excerpt),
      bodyJson: normalizedBodyJson,
      bodyMarkdown: asNullableText(payload.bodyMarkdown),
      heroImageUrl: asNullableText(payload.heroImageUrl),
      heroImageStoragePath: asNullableText(payload.heroImageStoragePath),
      seoTitle: asNullableText(payload.seoTitle),
      metaDescription: asNullableText(payload.metaDescription),
      focusKeyword: asNullableText(payload.focusKeyword),
      canonicalUrlOverride: asNullableText(payload.canonicalUrlOverride),
      socialTitle: asNullableText(payload.socialTitle),
      socialDescription: asNullableText(payload.socialDescription),
      socialImageUrl: asNullableText(payload.socialImageUrl),
      noindex: payload.noindex === true,
      nofollow: payload.nofollow === true,
      isFeatured: payload.isFeatured === true,
      isVisible: payload.isVisible !== false,
      isArchived: payload.isArchived === true,
      editorialNotes: asNullableText(payload.editorialNotes)
    },
    discoveryRows: dedupedDiscoveryIds.map((termId, index) => ({
      termId,
      isPrimary: termId === primaryTopicId,
      sortOrder: index
    })),
    relatedEpisodeRows: dedupedRelatedEpisodeRows,
    relatedPostRows: dedupedRelatedPostRows
  } satisfies EpisodeEditorialApplyInput;
}

export async function applyEpisodeEditorialState(input: {
  supabase: SupabaseClient;
  episodeId: string;
  applyInput: EpisodeEditorialApplyInput;
}) {
  const { supabase, episodeId, applyInput } = input;
  const { error } = await supabase.rpc('apply_episode_editorial_state', {
    p_episode_id: episodeId,
    p_editorial: applyInput.editorial,
    p_discovery: applyInput.discoveryRows,
    p_related_episodes: applyInput.relatedEpisodeRows,
    p_related_posts: applyInput.relatedPostRows
  });
  if (error) throw error;
}

export function isEpisodeEditorialPayload(value: unknown): value is EpisodeEditorialWritePayload {
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
