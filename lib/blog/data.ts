import { createHash, randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizePath } from '@/lib/redirects';
import {
  blogDocumentToMarkdown,
  blogDocumentToPlainText,
  buildSeoChecklist,
  collectHeadingOutline,
  createDefaultBlogDocument,
  estimateReadingTimeMinutes,
  extractToc,
  generateExcerpt,
  normalizePrimaryListenEpisodeBlocksForSave,
  normalizeBlogDocument,
  syncPrimaryListenEpisodeBlocksEpisode,
  slugifyBlogText
} from './content';
import {
  blogAnalyticsEventInputSchema,
  blogPostWriteSchema,
  BLOG_POST_STATUSES,
  type BlogAnalyticsEventInput,
  type BlogPostStatus,
  type BlogPostWriteInput,
  taxonomyTermWriteSchema
} from './schema';

export type MediaAssetRecord = {
  id: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  alt_text_default: string;
  caption_default: string;
  credit_source: string;
  focal_x: number | null;
  focal_y: number | null;
  created_at: string;
  updated_at: string;
};

export type MediaAssetUsageReference = {
  id: string;
  title: string;
  slug: string;
};

export type MediaAssetUsageSummary = {
  assetId: string;
  storagePath: string;
  canDelete: boolean;
  totalUsage: number;
  counts: {
    featuredPosts: number;
    ogPosts: number;
    authorProfiles: number;
    contentBlocks: number;
    episodeHeroImages: number;
  };
  references: {
    featuredPosts: MediaAssetUsageReference[];
    ogPosts: MediaAssetUsageReference[];
    authorProfiles: MediaAssetUsageReference[];
    contentBlocks: MediaAssetUsageReference[];
    episodeHeroImages: MediaAssetUsageReference[];
  };
};

export type MediaUsageFilter = 'all' | 'used' | 'unused';

export type BlogAuthorRecord = {
  id: string;
  name: string;
  slug: string;
  bio: string;
  image_url: string | null;
  image_asset_id: string | null;
  is_active?: boolean;
  archived_at?: string | null;
  archive_mode?: string | null;
  redirect_target?: string | null;
};

export type PodcastEpisodeRecord = {
  id: string;
  rss_guid: string;
  title: string;
  slug: string;
  episode_number: number | null;
  description_plain: string;
  description_html: string;
  published_at: string | null;
  audio_url: string;
  artwork_url: string | null;
  transcript: string;
  show_notes: string;
  is_visible: boolean;
  is_archived: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaxonomyKind = 'categories' | 'tags' | 'series' | 'topic_clusters' | 'post_labels';
export type TaxonomyItem = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string | null;
  pillar_post_id?: string | null;
  bio?: string;
  image_url?: string | null;
  image_asset_id?: string | null;
  is_active?: boolean;
  archived_at?: string | null;
  archive_mode?: string | null;
  redirect_target?: string | null;
};

type ArchiveableTaxonomyKind = TaxonomyKind | 'blog_authors';
export type TaxonomyArchiveMode = 'redirect_301' | 'merge_redirect_301' | 'gone_410';

export type BlogPostRecord = {
  id: string;
  title: string;
  slug: string;
  status: BlogPostStatus;
  excerpt: string | null;
  excerpt_auto: string | null;
  excerpt_plain: string;
  content_json: unknown;
  content_markdown: string | null;
  featured_image_id: string | null;
  author_id: string;
  published_at: string | null;
  scheduled_at: string | null;
  archived_at: string | null;
  reading_time_minutes: number | null;
  is_featured: boolean;
  primary_category_id: string | null;
  canonical_url: string | null;
  noindex: boolean;
  nofollow: boolean;
  seo_title: string | null;
  seo_description: string | null;
  social_title: string | null;
  social_description: string | null;
  og_image_id: string | null;
  focus_keyword: string | null;
  seo_score: number | null;
  schema_type: string | null;
  toc_json: unknown;
  heading_outline: unknown;
  seo_warnings: unknown;
  search_plaintext: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseClient = ReturnType<typeof createSupabaseAdminClient>;
type DiscoveryAssignmentState = BlogPostWriteInput['discovery'] & {
  termNames: string[];
};
type DiscoveryTermType = 'topic' | 'theme' | 'entity' | 'case' | 'event' | 'collection' | 'series';
type DiscoveryTermRow = {
  id: string;
  name: string;
  slug: string;
  term_type: DiscoveryTermType;
  is_active?: boolean;
};

const PATREON_URL = 'https://www.patreon.com/cw/TheCompendiumPodcast';
const SEARCH_PAGE_SIZE = 12;
const BLOG_POST_PUBLIC_LIST_SELECT = [
  'id',
  'title',
  'slug',
  'excerpt',
  'excerpt_auto',
  'featured_image_id',
  'author_id',
  'published_at',
  'reading_time_minutes',
  'is_featured',
  'created_at'
].join(',');

const BLOG_POST_PUBLIC_METADATA_SELECT = [
  BLOG_POST_PUBLIC_LIST_SELECT,
  'status',
  'excerpt_plain',
  'scheduled_at',
  'archived_at',
  'primary_category_id',
  'canonical_url',
  'noindex',
  'nofollow',
  'seo_title',
  'seo_description',
  'social_title',
  'social_description',
  'og_image_id',
  'focus_keyword',
  'seo_score',
  'schema_type',
  'deleted_at',
  'updated_at'
].join(',');

const BLOG_POST_PUBLIC_DETAIL_BASE_SELECT = BLOG_POST_PUBLIC_METADATA_SELECT;
const BLOG_POST_PUBLIC_DETAIL_SELECT = [
  BLOG_POST_PUBLIC_DETAIL_BASE_SELECT,
  'content_json',
  'content_markdown',
  'toc_json',
  'heading_outline',
  'seo_warnings',
  'search_plaintext'
].join(',');

const TAXONOMY_CONFIG: Record<TaxonomyKind, { table: string; joinTable: string; idColumn: string }> = {
  categories: { table: 'categories', joinTable: 'blog_post_categories', idColumn: 'category_id' },
  tags: { table: 'tags', joinTable: 'blog_post_tags', idColumn: 'tag_id' },
  series: { table: 'series', joinTable: 'blog_post_series', idColumn: 'series_id' },
  topic_clusters: { table: 'topic_clusters', joinTable: 'blog_post_topic_clusters', idColumn: 'topic_cluster_id' },
  post_labels: { table: 'post_labels', joinTable: 'blog_post_labels', idColumn: 'label_id' }
};

const INTERNAL_ARCHIVEABLE_TAXONOMY_LEGACY_PREFIX: Record<ArchiveableTaxonomyKind, string> = {
  categories: '/topics/',
  tags: '/blog/tag/',
  series: '/blog/series/',
  topic_clusters: '/blog/topic/',
  post_labels: '/blog',
  blog_authors: '/blog/author/'
};

function getSupabase() {
  return createSupabaseAdminClient();
}

function isMissingIsActiveColumnError(error: unknown) {
  const code = `${(error as { code?: string })?.code || ''}`;
  const message = `${(error as { message?: string })?.message || ''}`.toLowerCase();
  return code === '42703' || (message.includes('is_active') && message.includes('does not exist'));
}

function isMissingEpisodeEditorialError(error: unknown) {
  const code = `${(error as { code?: string })?.code || ''}`;
  const message = `${(error as { message?: string })?.message || ''}`.toLowerCase();
  return code === '42P01' || code === '42703' || (message.includes('podcast_episode_editorial') && message.includes('does not exist'));
}

function countAssetIdReferences(value: unknown, assetId: string): number {
  if (!value) return 0;
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + countAssetIdReferences(item, assetId), 0);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const selfReference = record.assetId === assetId ? 1 : 0;
    return Object.values(record).reduce<number>((sum, item) => sum + countAssetIdReferences(item, assetId), selfReference);
  }
  return 0;
}

function countAssetIdReferencesForSet(value: unknown, targetIds: Set<string>, counts: Map<string, number>) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => countAssetIdReferencesForSet(item, targetIds, counts));
    return;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const assetId = typeof record.assetId === 'string' ? record.assetId : '';
    if (assetId && targetIds.has(assetId)) {
      counts.set(assetId, (counts.get(assetId) || 0) + 1);
    }
    Object.values(record).forEach((item) => countAssetIdReferencesForSet(item, targetIds, counts));
  }
}

async function buildMediaUsageCountsByAssetId(
  supabase: SupabaseClient,
  assets: Pick<MediaAssetRecord, 'id' | 'storage_path'>[]
) {
  const counts = new Map<string, number>();
  const targetAssetIds = new Set(assets.map((asset) => asset.id));
  const assetIdByStoragePath = new Map<string, string>();
  for (const asset of assets) {
    counts.set(asset.id, 0);
    assetIdByStoragePath.set(asset.storage_path, asset.id);
  }

  const { data: postRows, error: postError } = await supabase
    .from('blog_posts')
    .select('featured_image_id,og_image_id,content_json')
    .is('deleted_at', null);
  if (postError) throw postError;
  for (const row of ((postRows || []) as Array<{ featured_image_id: string | null; og_image_id: string | null; content_json: unknown }>)) {
    if (row.featured_image_id && targetAssetIds.has(row.featured_image_id)) {
      counts.set(row.featured_image_id, (counts.get(row.featured_image_id) || 0) + 1);
    }
    if (row.og_image_id && targetAssetIds.has(row.og_image_id)) {
      counts.set(row.og_image_id, (counts.get(row.og_image_id) || 0) + 1);
    }
    countAssetIdReferencesForSet(row.content_json, targetAssetIds, counts);
  }

  const { data: authorRows, error: authorError } = await supabase
    .from('blog_authors')
    .select('image_asset_id');
  if (authorError) throw authorError;
  for (const row of ((authorRows || []) as Array<{ image_asset_id: string | null }>)) {
    if (row.image_asset_id && targetAssetIds.has(row.image_asset_id)) {
      counts.set(row.image_asset_id, (counts.get(row.image_asset_id) || 0) + 1);
    }
  }

  try {
    const storagePaths = assets.map((asset) => asset.storage_path).filter(Boolean);
    if (storagePaths.length) {
      const { data: editorialRows, error: editorialError } = await supabase
        .from('podcast_episode_editorial')
        .select('hero_image_storage_path')
        .in('hero_image_storage_path', storagePaths);
      if (editorialError) throw editorialError;
      for (const row of ((editorialRows || []) as Array<{ hero_image_storage_path: string | null }>)) {
        const path = row.hero_image_storage_path || '';
        const mappedAssetId = assetIdByStoragePath.get(path);
        if (mappedAssetId) {
          counts.set(mappedAssetId, (counts.get(mappedAssetId) || 0) + 1);
        }
      }
    }
  } catch (error) {
    if (!isMissingEpisodeEditorialError(error)) throw error;
  }

  return counts;
}

function getSessionHash(input: string) {
  return createHash('sha256').update(input).digest('hex').slice(0, 24);
}

function ensureStatus(value: string): BlogPostStatus {
  return BLOG_POST_STATUSES.includes(value as BlogPostStatus) ? (value as BlogPostStatus) : 'draft';
}

export function normalizePageNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : 1;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return 1;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  }
  return 1;
}

export function escapePostgrestIlikeLiteral(value: string): string {
  return `${value || ''}`
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/"/g, '\\"');
}

function buildOrIlikeFilter(columns: string[], rawValue: string): string {
  const normalized = `${rawValue || ''}`.trim();
  if (!normalized) return '';
  const pattern = `"%${escapePostgrestIlikeLiteral(normalized)}%"`;
  return columns.map((column) => `${column}.ilike.${pattern}`).join(',');
}

function safeRangeWindow(total: number, offset: number, limit: number): { from: number; to: number } | null {
  if (total <= 0 || limit <= 0 || offset >= total) return null;
  const from = Math.max(0, offset);
  return {
    from,
    to: Math.min(total - 1, from + limit - 1)
  };
}

async function ensureUniqueBlogSlug(
  supabase: SupabaseClient,
  rawSlug: string,
  excludePostId?: string
) {
  const baseSlug = slugifyBlogText(rawSlug);
  let candidate = baseSlug;
  let suffix = 2;

  for (;;) {
    let query = supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', candidate)
      .is('deleted_at', null)
      .limit(1);

    if (excludePostId) {
      query = query.neq('id', excludePostId);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function getMediaAssetsByIds(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, MediaAssetRecord>();
  const { data, error } = await supabase.from('media_assets').select('*').in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((item) => [item.id, item as MediaAssetRecord]));
}

export async function getMediaAssetMapByIds(ids: string[]) {
  return getMediaAssetsByIds(getSupabase(), ids);
}

async function getEpisodesByIds(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, PodcastEpisodeRecord>();
  const { data, error } = await supabase.from('podcast_episodes').select('*').in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((item) => [item.id, item as PodcastEpisodeRecord]));
}

async function getAuthorsByIds(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, BlogAuthorRecord>();
  const { data, error } = await supabase.from('blog_authors').select('*').in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((item) => [item.id, item as BlogAuthorRecord]));
}

async function getTaxonomyItemsByIds(
  supabase: SupabaseClient,
  table: string,
  ids: string[]
) {
  if (!ids.length) return new Map<string, TaxonomyItem>();
  const shouldFilterActive = table === 'categories' || table === 'tags' || table === 'series' || table === 'topic_clusters';
  if (!shouldFilterActive) {
    const { data, error } = await supabase.from(table).select('*').in('id', ids);
    if (error) throw error;
    return new Map((data || []).map((item) => [item.id, item as TaxonomyItem]));
  }
  const activeQuery = await supabase.from(table).select('*').in('id', ids).eq('is_active', true);
  if (activeQuery.error && isMissingIsActiveColumnError(activeQuery.error)) {
    const fallbackQuery = await supabase.from(table).select('*').in('id', ids);
    if (fallbackQuery.error) throw fallbackQuery.error;
    return new Map((fallbackQuery.data || []).map((item) => [item.id, item as TaxonomyItem]));
  }
  if (activeQuery.error) throw activeQuery.error;
  return new Map((activeQuery.data || []).map((item) => [item.id, item as TaxonomyItem]));
}

async function getDiscoveryTermsByIds(
  supabase: SupabaseClient,
  ids: string[]
) {
  if (!ids.length) return new Map<string, DiscoveryTermRow>();
  const { data, error } = await supabase
    .from('discovery_terms')
    .select('id, name, slug, term_type, is_active')
    .in('id', ids)
    .eq('is_active', true);
  if (error) throw error;
  return new Map((data || []).map((item) => [item.id, item as DiscoveryTermRow]));
}

async function getTaxonomyForPosts(
  supabase: SupabaseClient,
  postIds: string[]
) {
  if (!postIds.length) {
    return {
      categories: new Map<string, TaxonomyItem[]>(),
      tags: new Map<string, TaxonomyItem[]>()
    };
  }

  const categoriesPromise = supabase
    .from('blog_post_categories')
    .select('post_id, category_id')
    .in('post_id', postIds);
  const tagsPromise = supabase.from('blog_post_tags').select('post_id, tag_id').in('post_id', postIds);

  const [categoriesRows, tagRows] = await Promise.all([
    categoriesPromise,
    tagsPromise
  ]);

  if (categoriesRows.error) throw categoriesRows.error;
  if (tagRows.error) throw tagRows.error;

  const categoryItems = await getTaxonomyItemsByIds(
    supabase,
    'categories',
    [...new Set((categoriesRows.data || []).map((item) => item.category_id))]
  );
  const tagItems = await getTaxonomyItemsByIds(supabase, 'tags', [...new Set((tagRows.data || []).map((item) => item.tag_id))]);

  function group<T extends { post_id: string }>(
    rows: T[],
    idKey: keyof T,
    items: Map<string, TaxonomyItem>
  ) {
    const map = new Map<string, TaxonomyItem[]>();
    rows.forEach((row) => {
      const item = items.get(`${row[idKey]}`);
      if (!item) return;
      const list = map.get(row.post_id) || [];
      list.push(item);
      map.set(row.post_id, list);
    });
    return map;
  }

  return {
    categories: group(categoriesRows.data || [], 'category_id', categoryItems),
    tags: group(tagRows.data || [], 'tag_id', tagItems)
  };
}

function createEmptyDiscoveryAssignments(): DiscoveryAssignmentState {
  return {
    primaryTopicId: null,
    topicIds: [],
    themeIds: [],
    entityIds: [],
    caseIds: [],
    eventIds: [],
    collectionIds: [],
    seriesIds: [],
    termNames: []
  };
}

async function getDiscoveryForPosts(
  supabase: SupabaseClient,
  postIds: string[]
) {
  if (!postIds.length) return new Map<string, DiscoveryAssignmentState>();
  const { data, error } = await supabase
    .from('blog_post_discovery_terms')
    .select('blog_post_id, term_id, is_primary, sort_order, discovery_terms!inner(term_type, name, is_active)')
    .in('blog_post_id', postIds)
    .eq('discovery_terms.is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;

  const map = new Map<string, DiscoveryAssignmentState>();
  (data || []).forEach((row: any) => {
    const state = map.get(row.blog_post_id) || createEmptyDiscoveryAssignments();
    const termId = `${row.term_id}`;
    const termName = `${row.discovery_terms?.name || ''}`.trim();
    const termType = row.discovery_terms?.term_type as DiscoveryTermType;
    if (termName && !state.termNames.includes(termName)) {
      state.termNames.push(termName);
    }
    if (termType === 'topic') {
      if (row.is_primary || !state.primaryTopicId) {
        state.primaryTopicId = termId;
      } else if (!state.topicIds.includes(termId)) {
        state.topicIds.push(termId);
      }
    } else if (termType === 'theme') {
      state.themeIds.push(termId);
    } else if (termType === 'entity') {
      state.entityIds.push(termId);
    } else if (termType === 'case') {
      state.caseIds.push(termId);
    } else if (termType === 'event') {
      state.eventIds.push(termId);
    } else if (termType === 'collection') {
      state.collectionIds.push(termId);
    } else if (termType === 'series') {
      state.seriesIds.push(termId);
    }
    map.set(row.blog_post_id, state);
  });
  return map;
}

async function getEpisodeLinksForPosts(supabase: SupabaseClient, postIds: string[]) {
  if (!postIds.length) return new Map<string, Array<{ sort_order: number; is_primary: boolean; episode: PodcastEpisodeRecord }>>();
  const { data, error } = await supabase
    .from('blog_post_episode_links')
    .select('post_id, episode_id, sort_order, is_primary')
    .in('post_id', postIds)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const episodes = await getEpisodesByIds(
    supabase,
    [...new Set((data || []).map((item) => item.episode_id))]
  );
  const map = new Map<string, Array<{ sort_order: number; is_primary: boolean; episode: PodcastEpisodeRecord }>>();
  (data || []).forEach((row) => {
    const episode = episodes.get(row.episode_id);
    if (!episode) return;
    const list = map.get(row.post_id) || [];
    list.push({
      sort_order: row.sort_order,
      is_primary: row.is_primary,
      episode
    });
    map.set(row.post_id, list);
  });
  return map;
}

function serializeSearchPlaintext(input: {
  title: string;
  excerpt: string;
  contentPlain: string;
  categories: TaxonomyItem[];
  tags: TaxonomyItem[];
  discoveryTerms: string[];
  episodes: PodcastEpisodeRecord[];
}) {
  return [
    input.title,
    input.excerpt,
    input.contentPlain,
    ...input.categories.map((item) => item.name),
    ...input.tags.map((item) => item.name),
    ...input.discoveryTerms,
    ...input.episodes.map((item) => item.title)
  ]
    .filter(Boolean)
    .join('\n');
}

async function createRevision(supabase: SupabaseClient, params: {
  postId: string;
  title: string;
  excerpt: string | null;
  contentJson: unknown;
  contentMarkdown: string;
  seoSnapshot: Record<string, unknown>;
  taxonomySnapshot: Record<string, unknown>;
  linkedEpisodesSnapshot: Array<{ episodeId: string; sortOrder: number; isPrimary: boolean }>;
}) {
  const { data: existing, error: existingError } = await supabase
    .from('blog_post_revisions')
    .select('revision_number')
    .eq('post_id', params.postId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  const revisionNumber = (existing?.revision_number || 0) + 1;
  const { error } = await supabase.from('blog_post_revisions').insert({
    post_id: params.postId,
    revision_number: revisionNumber,
    title_snapshot: params.title,
    excerpt_snapshot: params.excerpt,
    content_json_snapshot: params.contentJson,
    content_markdown_snapshot: params.contentMarkdown,
    seo_snapshot: params.seoSnapshot,
    taxonomy_snapshot: params.taxonomySnapshot,
    linked_episodes_snapshot: params.linkedEpisodesSnapshot
  });
  if (error) throw error;
}

async function syncTaxonomyLinks(
  supabase: SupabaseClient,
  postId: string,
  taxonomy: BlogPostWriteInput['taxonomy']
) {
  await Promise.all(
    Object.entries(TAXONOMY_CONFIG).map(async ([kind, config]) => {
      const ids = taxonomy[kind === 'categories' ? 'categoryIds' : 'tagIds'];
      const deleteResult = await supabase.from(config.joinTable).delete().eq('post_id', postId);
      if (deleteResult.error) throw deleteResult.error;
      if (!ids.length) return;
      const insertResult = await supabase.from(config.joinTable).insert(
        ids.map((id) => ({
          post_id: postId,
          [config.idColumn]: id
        }))
      );
      if (insertResult.error) throw insertResult.error;
    })
  );
}

async function syncBlogPostDiscovery(
  supabase: SupabaseClient,
  postId: string,
  discovery: BlogPostWriteInput['discovery']
) {
  const ids = [
    ...(discovery.primaryTopicId ? [discovery.primaryTopicId] : []),
    ...discovery.topicIds,
    ...discovery.themeIds,
    ...discovery.entityIds,
    ...discovery.caseIds,
    ...discovery.eventIds,
    ...discovery.collectionIds,
    ...discovery.seriesIds
  ];
  const uniqueIds = [...new Set(ids)];
  let terms: Array<{ id: string; term_type: DiscoveryTermType }> = [];
  if (uniqueIds.length) {
    const { data: fetchedTerms, error: termsError } = await supabase
      .from('discovery_terms')
      .select('id, term_type')
      .in('id', uniqueIds)
      .eq('is_active', true);
    if (termsError) throw termsError;
    terms = (fetchedTerms || []) as Array<{ id: string; term_type: DiscoveryTermType }>;
    if (terms.length !== uniqueIds.length) {
      throw new Error('One or more discovery terms are archived or invalid.');
    }
  }

  const termTypeById = new Map((terms || []).map((row: any) => [row.id as string, row.term_type as DiscoveryTermType]));
  if (discovery.primaryTopicId && termTypeById.get(discovery.primaryTopicId) !== 'topic') {
    throw new Error('Primary topic must reference a topic discovery term.');
  }

  const expectedTypes: Array<[string[], DiscoveryTermType]> = [
    [discovery.topicIds, 'topic'],
    [discovery.themeIds, 'theme'],
    [discovery.entityIds, 'entity'],
    [discovery.caseIds, 'case'],
    [discovery.eventIds, 'event'],
    [discovery.collectionIds, 'collection'],
    [discovery.seriesIds, 'series']
  ];
  expectedTypes.forEach(([list, expected]) => {
    list.forEach((id) => {
      if (termTypeById.get(id) !== expected) {
        throw new Error(`Discovery term assignment mismatch for ${expected}.`);
      }
    });
  });

  const deleteResult = await supabase.from('blog_post_discovery_terms').delete().eq('blog_post_id', postId);
  if (deleteResult.error) throw deleteResult.error;

  const normalizedTopicIds = [...new Set(discovery.topicIds.filter((id) => id && id !== discovery.primaryTopicId))];

  const rows = [
    ...(discovery.primaryTopicId ? [{
      blog_post_id: postId,
      term_id: discovery.primaryTopicId,
      is_primary: true,
      sort_order: 0
    }] : []),
    ...normalizedTopicIds.map((termId, index) => ({ blog_post_id: postId, term_id: termId, is_primary: false, sort_order: index })),
    ...discovery.themeIds.map((termId, index) => ({ blog_post_id: postId, term_id: termId, is_primary: false, sort_order: index })),
    ...discovery.entityIds.map((termId, index) => ({ blog_post_id: postId, term_id: termId, is_primary: false, sort_order: index })),
    ...discovery.caseIds.map((termId, index) => ({ blog_post_id: postId, term_id: termId, is_primary: false, sort_order: index })),
    ...discovery.eventIds.map((termId, index) => ({ blog_post_id: postId, term_id: termId, is_primary: false, sort_order: index })),
    ...discovery.collectionIds.map((termId, index) => ({ blog_post_id: postId, term_id: termId, is_primary: false, sort_order: index })),
    ...discovery.seriesIds.map((termId, index) => ({ blog_post_id: postId, term_id: termId, is_primary: false, sort_order: index }))
  ];
  if (!rows.length) return;

  const insertResult = await supabase.from('blog_post_discovery_terms').insert(rows);
  if (insertResult.error) throw insertResult.error;
}

async function syncEpisodeLinks(
  supabase: SupabaseClient,
  postId: string,
  linkedEpisodes: BlogPostWriteInput['linkedEpisodes']
) {
  const deleteResult = await supabase.from('blog_post_episode_links').delete().eq('post_id', postId);
  if (deleteResult.error) throw deleteResult.error;
  if (!linkedEpisodes.length) return;
  const normalized = linkedEpisodes.map((item, index) => ({
    post_id: postId,
    episode_id: item.episodeId,
    sort_order: index,
    is_primary: index === 0 ? true : item.isPrimary
  }));
  const insertResult = await supabase.from('blog_post_episode_links').insert(normalized);
  if (insertResult.error) throw insertResult.error;
}

async function syncRelatedOverrides(
  supabase: SupabaseClient,
  postId: string,
  relatedPostIds: string[]
) {
  const deleteResult = await supabase.from('blog_post_related_overrides').delete().eq('post_id', postId);
  if (deleteResult.error) throw deleteResult.error;
  if (!relatedPostIds.length) return;
  const insertResult = await supabase.from('blog_post_related_overrides').insert(
    relatedPostIds.map((relatedId, index) => ({
      post_id: postId,
      related_post_id: relatedId,
      sort_order: index
    }))
  );
  if (insertResult.error) throw insertResult.error;
}

async function createSlugRedirect(
  supabase: SupabaseClient,
  postId: string,
  fromSlug: string,
  toSlug: string
) {
  const sourcePath = normalizePath(`/blog/${fromSlug}`);
  const targetUrl = normalizePath(`/blog/${toSlug}`);
  const { data, error } = await supabase
    .from('redirects')
    .upsert(
      {
        source_path: sourcePath,
        target_url: targetUrl,
        status_code: 301,
        match_type: 'exact',
        is_active: true,
        priority: 250,
        notes: 'Auto-created from blog slug change.',
        source_type: 'blog_slug',
        source_ref: postId
      },
      { onConflict: 'source_path,match_type' }
    )
    .select('id')
    .single();
  if (error) throw error;
  const historyResult = await supabase.from('blog_post_slug_history').upsert(
    {
      post_id: postId,
      slug: fromSlug,
      redirect_id: data.id
    },
    { onConflict: 'post_id,slug' }
  );
  if (historyResult.error) throw historyResult.error;
}

async function hydratePosts(baseRows: BlogPostRecord[]) {
  const supabase = getSupabase();
  const authorMap = await getAuthorsByIds(
    supabase,
    [...new Set(baseRows.map((row) => row.author_id))]
  );
  const mediaIds = [...new Set(baseRows.flatMap((row) => [row.featured_image_id, row.og_image_id].filter(Boolean) as string[]))];
  const mediaMap = await getMediaAssetsByIds(supabase, mediaIds);
  const taxonomy = await getTaxonomyForPosts(
    supabase,
    baseRows.map((row) => row.id)
  );
  const discovery = await getDiscoveryForPosts(
    supabase,
    baseRows.map((row) => row.id)
  );
  const episodeLinks = await getEpisodeLinksForPosts(
    supabase,
    baseRows.map((row) => row.id)
  );

  return baseRows.map((row) => ({
    ...row,
    content_json: normalizeBlogDocument(row.content_json),
    toc_json: Array.isArray(row.toc_json) ? row.toc_json : [],
    heading_outline: Array.isArray(row.heading_outline) ? row.heading_outline : [],
    seo_warnings: Array.isArray(row.seo_warnings) ? row.seo_warnings : [],
    author: authorMap.get(row.author_id) || null,
    featured_image: row.featured_image_id ? mediaMap.get(row.featured_image_id) || null : null,
    og_image: row.og_image_id ? mediaMap.get(row.og_image_id) || null : null,
    taxonomies: {
      categories: taxonomy.categories.get(row.id) || [],
      tags: taxonomy.tags.get(row.id) || []
    },
    discovery: discovery.get(row.id) || createEmptyDiscoveryAssignments(),
    linked_episodes: episodeLinks.get(row.id) || []
  }));
}

// Internal-only legacy taxonomy route map used by archive/redirect safety checks.
// Do not use these paths as public canonical URL sources.
export function getInternalArchiveableTaxonomyLegacyUrlPath(kind: ArchiveableTaxonomyKind, slug: string) {
  if (kind === 'post_labels') return '/blog';
  const prefix = INTERNAL_ARCHIVEABLE_TAXONOMY_LEGACY_PREFIX[kind] || '/blog/';
  return `${prefix}${slug}`;
}

async function assertNoRedirectUrlOwnershipConflict(supabase: SupabaseClient, sourcePath: string, excludeRedirectId?: string) {
  let query = supabase
    .from('redirects')
    .select('id,status_code,is_active')
    .eq('source_path', sourcePath)
    .eq('match_type', 'exact')
    .eq('is_active', true)
    .limit(1);
  if (excludeRedirectId) query = query.neq('id', excludeRedirectId);
  const { data, error } = await query;
  if (error) throw error;
  if (data?.length) {
    throw new Error(`This URL is already owned by an active redirect rule (${data[0].status_code}). Remove that rule before reusing this slug.`);
  }
}

async function resolveRedirectDestinationChain(supabase: SupabaseClient, sourcePath: string, targetUrl: string) {
  const normalizedSource = normalizePath(sourcePath);
  let candidate = `${targetUrl || ''}`.trim();
  if (!candidate) throw new Error('Redirect target is required.');

  const seen = new Set<string>([normalizedSource]);
  for (let hop = 0; hop < 12; hop += 1) {
    if (!candidate.startsWith('/')) return candidate;
    const normalizedTarget = normalizePath(candidate);
    if (normalizedTarget === normalizedSource) {
      throw new Error('Redirect target cannot point back to the source URL.');
    }
    if (seen.has(normalizedTarget)) {
      throw new Error('Redirect target creates a redirect loop.');
    }
    seen.add(normalizedTarget);

    const { data, error } = await supabase
      .from('redirects')
      .select('target_url,status_code')
      .eq('source_path', normalizedTarget)
      .eq('match_type', 'exact')
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) return normalizedTarget;
    if (Number(data.status_code) === 410) {
      throw new Error('Redirect target currently resolves to 410 Gone. Choose a live destination.');
    }
    const next = `${data.target_url || ''}`.trim();
    if (!next) return normalizedTarget;
    candidate = next;
  }
  throw new Error('Redirect target chain is too deep.');
}

async function assertTargetIsNotArchivedTaxonomy(supabase: SupabaseClient, targetUrl: string) {
  if (!targetUrl.startsWith('/')) return;
  const normalized = normalizePath(targetUrl);
  // Internal-only legacy prefixes for archive target validation.
  const matchers = (Object.entries(INTERNAL_ARCHIVEABLE_TAXONOMY_LEGACY_PREFIX) as Array<[ArchiveableTaxonomyKind, string]>)
    .filter(([kind]) => kind !== 'post_labels')
    .map(([kind, prefix]) => ({ kind, prefix }));

  const matched = matchers.find((item) => normalized.startsWith(item.prefix));
  if (!matched) return;
  const slug = normalized.slice(matched.prefix.length).trim();
  if (!slug) return;
  const table = matched.kind === 'blog_authors' ? 'blog_authors' : TAXONOMY_CONFIG[matched.kind].table;
  const { data, error } = await supabase.from(table).select('is_active').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (data && data.is_active === false) {
    throw new Error('Redirect target points to an archived taxonomy URL. Choose an active destination.');
  }
}

export async function listBlogAuthors(options?: { includeArchived?: boolean }) {
  const supabase = getSupabase();
  if (options?.includeArchived) {
    const { data, error } = await supabase.from('blog_authors').select('*').order('name');
    if (error) throw error;
    return data as BlogAuthorRecord[];
  }

  const activeQuery = await supabase.from('blog_authors').select('*').eq('is_active', true).order('name');
  if (activeQuery.error && isMissingIsActiveColumnError(activeQuery.error)) {
    const fallbackQuery = await supabase.from('blog_authors').select('*').order('name');
    if (fallbackQuery.error) throw fallbackQuery.error;
    return fallbackQuery.data as BlogAuthorRecord[];
  }
  if (activeQuery.error) throw activeQuery.error;
  return activeQuery.data as BlogAuthorRecord[];
}

export async function listTaxonomy(kind: TaxonomyKind, options?: { includeArchived?: boolean }) {
  const supabase = getSupabase();
  const table = TAXONOMY_CONFIG[kind].table;
  if (options?.includeArchived) {
    const { data, error } = await supabase.from(table).select('*').order('name');
    if (error) throw error;
    return data as TaxonomyItem[];
  }

  const activeQuery = await supabase.from(table).select('*').eq('is_active', true).order('name');
  if (activeQuery.error && isMissingIsActiveColumnError(activeQuery.error)) {
    const fallbackQuery = await supabase.from(table).select('*').order('name');
    if (fallbackQuery.error) throw fallbackQuery.error;
    return fallbackQuery.data as TaxonomyItem[];
  }
  if (activeQuery.error) throw activeQuery.error;
  return activeQuery.data as TaxonomyItem[];
}

async function listOptionalTaxonomyTable(table: string, options?: { includeArchived?: boolean }) {
  const supabase = getSupabase();
  const shouldFilterActive = !options?.includeArchived && table !== 'post_labels';
  let data: unknown[] | null = null;
  let error: unknown = null;
  if (shouldFilterActive) {
    const activeQuery = await supabase.from(table).select('*').eq('is_active', true).order('name');
    data = activeQuery.data;
    error = activeQuery.error;
    if (activeQuery.error && isMissingIsActiveColumnError(activeQuery.error)) {
      const fallbackQuery = await supabase.from(table).select('*').order('name');
      data = fallbackQuery.data;
      error = fallbackQuery.error;
    }
  } else {
    const query = await supabase.from(table).select('*').order('name');
    data = query.data;
    error = query.error;
  }
  if (error) {
    const code = `${(error as { code?: string }).code || ''}`;
    if (code === 'PGRST205' || code === '42P01') return [] as TaxonomyItem[];
    throw error;
  }
  return (data || []) as TaxonomyItem[];
}

export async function listBlogTaxonomies(options?: { includeArchived?: boolean }) {
  const [categories, tags, series, topicClusters, labels, authors] = await Promise.all([
    listTaxonomy('categories', options),
    listTaxonomy('tags', options),
    listOptionalTaxonomyTable('series', options),
    listOptionalTaxonomyTable('topic_clusters', options),
    listOptionalTaxonomyTable('post_labels', options),
    listBlogAuthors(options).catch((error: unknown) => {
      const code = `${(error as { code?: string }).code || ''}`;
      if (code === 'PGRST205' || code === '42P01') return [] as BlogAuthorRecord[];
      throw error;
    })
  ]);

  return {
    categories,
    tags,
    series,
    topicClusters,
    labels,
    authors
  };
}

export async function upsertTaxonomy(kind: TaxonomyKind, input: unknown) {
  const supabase = getSupabase();
  const parsed = taxonomyTermWriteSchema.parse(input);
  const table = TAXONOMY_CONFIG[kind].table;
  const normalizedSlug = slugifyBlogText(parsed.slug || parsed.name);
  if (!normalizedSlug) throw new Error('Slug is required.');
  await assertNoRedirectUrlOwnershipConflict(supabase, getInternalArchiveableTaxonomyLegacyUrlPath(kind, normalizedSlug));
  const basePayload = {
    ...(parsed.id ? { id: parsed.id } : {}),
    name: parsed.name.trim(),
    slug: normalizedSlug
  };

  let payload: Record<string, unknown>;
  if (kind === 'categories') {
    payload = {
      ...basePayload,
      description: parsed.description || '',
      parent_id: parsed.parentId || null
    };
  } else if (kind === 'tags') {
    payload = {
      ...basePayload
    };
  } else {
    payload = {
      ...basePayload,
      description: parsed.description || ''
    };
  }

  const query = parsed.id
    ? supabase.from(table).update(payload).eq('id', parsed.id).select('*').single()
    : supabase.from(table).insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function deleteTaxonomy(kind: TaxonomyKind, id: string) {
  const supabase = getSupabase();
  const table = TAXONOMY_CONFIG[kind].table;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function saveBlogAuthor(input: unknown) {
  const supabase = getSupabase();
  const parsed = taxonomyTermWriteSchema.parse(input);
  const normalizedSlug = slugifyBlogText(parsed.slug || parsed.name);
  if (!normalizedSlug) throw new Error('Slug is required.');
  await assertNoRedirectUrlOwnershipConflict(supabase, getInternalArchiveableTaxonomyLegacyUrlPath('blog_authors', normalizedSlug));
  const payload = {
    ...(parsed.id ? { id: parsed.id } : {}),
    name: parsed.name.trim(),
    slug: normalizedSlug,
    bio: parsed.bio || parsed.description || '',
    image_url: parsed.imageUrl || null,
    image_asset_id: parsed.imageAssetId || null
  };
  const query = parsed.id
    ? supabase.from('blog_authors').update(payload).eq('id', parsed.id).select('*').single()
    : supabase.from('blog_authors').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data as BlogAuthorRecord;
}

export async function getTaxonomyArchiveImpact(kind: ArchiveableTaxonomyKind, id: string) {
  const supabase = getSupabase();
  if (kind === 'blog_authors') {
    const { count, error } = await supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', id)
      .is('deleted_at', null);
    if (error) throw error;
    return { assignedContentCount: count || 0, internalReferenceCount: null };
  }

  const config = TAXONOMY_CONFIG[kind];
  const { count, error } = await supabase
    .from(config.joinTable)
    .select('post_id', { count: 'exact', head: true })
    .eq(config.idColumn, id);
  if (error) throw error;
  return { assignedContentCount: count || 0, internalReferenceCount: null };
}

export async function listArchiveTargets(kind: ArchiveableTaxonomyKind, currentId: string) {
  const supabase = getSupabase();
  const table = kind === 'blog_authors' ? 'blog_authors' : TAXONOMY_CONFIG[kind].table;
  const { data, error } = await supabase
    .from(table)
    .select('id,name,slug')
    .eq('is_active', true)
    .neq('id', currentId)
    .order('name');
  if (error) throw error;
  return (data || []) as Array<{ id: string; name: string; slug: string }>;
}

export async function archiveTaxonomy(params: {
  kind: ArchiveableTaxonomyKind;
  taxonomyId: string;
  mode: TaxonomyArchiveMode;
  redirectTarget?: string | null;
  mergeTargetId?: string | null;
  actorId?: string;
  actorEmail?: string;
  allowAuthorMerge?: boolean;
}) {
  const supabase = getSupabase();
  const table = params.kind === 'blog_authors' ? 'blog_authors' : TAXONOMY_CONFIG[params.kind].table;
  const { data: row, error: rowError } = await supabase.from(table).select('*').eq('id', params.taxonomyId).maybeSingle();
  if (rowError) throw rowError;
  if (!row) throw new Error('Taxonomy not found.');
  if (row.is_active === false) throw new Error('This taxonomy is already archived.');
  if (params.kind === 'blog_authors' && params.mode !== 'merge_redirect_301') {
    throw new Error('Author archive requires reassignment/merge. Use merge_redirect_301.');
  }

  const sourcePath = getInternalArchiveableTaxonomyLegacyUrlPath(params.kind, row.slug);
  let affectedCount = 0;
  let redirectTarget: string | null = null;
  const mergeTargetId = params.mergeTargetId || null;

  if (params.mode === 'merge_redirect_301' && params.kind === 'blog_authors' && !params.allowAuthorMerge) {
    throw new Error('Author merge is currently disabled.');
  }

  if (params.mode === 'merge_redirect_301') {
    if (!mergeTargetId) throw new Error('Merge target is required.');
    if (mergeTargetId === params.taxonomyId) throw new Error('Cannot merge a taxonomy into itself.');
    const { data: mergeTarget, error: mergeTargetError } = await supabase
      .from(table)
      .select('id,slug,is_active')
      .eq('id', mergeTargetId)
      .maybeSingle();
    if (mergeTargetError) throw mergeTargetError;
    if (!mergeTarget || mergeTarget.is_active === false) {
      throw new Error('Merge target must be active.');
    }
    redirectTarget = getInternalArchiveableTaxonomyLegacyUrlPath(params.kind, mergeTarget.slug);

      if (params.kind === 'blog_authors') {
      const { data: assignedRows, error: assignedRowsError } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('author_id', params.taxonomyId)
        .is('deleted_at', null);
      if (assignedRowsError) throw assignedRowsError;
      affectedCount = (assignedRows || []).length;
      const { error: reassignError } = await supabase
        .from('blog_posts')
        .update({ author_id: mergeTargetId })
        .eq('author_id', params.taxonomyId);
      if (reassignError) throw reassignError;
      } else {
        const config = TAXONOMY_CONFIG[params.kind];
      const { data: linkedRows, error: linkedRowsError } = await supabase
        .from(config.joinTable)
        .select('post_id')
        .eq(config.idColumn, params.taxonomyId);
      if (linkedRowsError) throw linkedRowsError;
      affectedCount = (linkedRows || []).length;

      if (linkedRows?.length) {
        const mergeRows = linkedRows.map((entry: { post_id: string }) => ({
          post_id: entry.post_id,
          [config.idColumn]: mergeTargetId
        }));
        const { error: upsertError } = await supabase
          .from(config.joinTable)
          .upsert(mergeRows, { onConflict: `post_id,${config.idColumn}` });
        if (upsertError) throw upsertError;
      }
        const { error: cleanupError } = await supabase
          .from(config.joinTable)
          .delete()
          .eq(config.idColumn, params.taxonomyId);
        if (cleanupError) throw cleanupError;
        if (params.kind === 'categories') {
          const { error: primaryCategoryReassignError } = await supabase
            .from('blog_posts')
            .update({ primary_category_id: mergeTargetId })
            .eq('primary_category_id', params.taxonomyId);
          if (primaryCategoryReassignError) throw primaryCategoryReassignError;
        }
      }
  } else if (params.mode === 'redirect_301') {
    const chosen = `${params.redirectTarget || ''}`.trim();
    if (!chosen) throw new Error('Redirect target is required.');
    redirectTarget = await resolveRedirectDestinationChain(supabase, sourcePath, chosen);
    await assertTargetIsNotArchivedTaxonomy(supabase, redirectTarget);
    if (redirectTarget.startsWith('/') && normalizePath(redirectTarget) === normalizePath(sourcePath)) {
      throw new Error('Redirect target must be different to the source URL.');
    }
  }

  if (params.kind !== 'blog_authors' && params.mode !== 'merge_redirect_301') {
    const config = TAXONOMY_CONFIG[params.kind];
    const { count: linkedCount, error: linkedCountError } = await supabase
      .from(config.joinTable)
      .select('post_id', { count: 'exact', head: true })
      .eq(config.idColumn, params.taxonomyId);
    if (linkedCountError) throw linkedCountError;
    const { error: removeJoinError } = await supabase
      .from(config.joinTable)
      .delete()
      .eq(config.idColumn, params.taxonomyId);
    if (removeJoinError) throw removeJoinError;
    affectedCount = Math.max(affectedCount, linkedCount || 0);

    if (params.kind === 'categories') {
      const { count: primaryCount, error: primaryCountError } = await supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('primary_category_id', params.taxonomyId);
      if (primaryCountError) throw primaryCountError;
      const { error: primaryClearError } = await supabase
        .from('blog_posts')
        .update({ primary_category_id: null })
        .eq('primary_category_id', params.taxonomyId);
      if (primaryClearError) throw primaryClearError;
      affectedCount = Math.max(affectedCount, primaryCount || 0);
    }
  }

  if (params.mode === 'merge_redirect_301' && redirectTarget) {
    redirectTarget = await resolveRedirectDestinationChain(supabase, sourcePath, redirectTarget);
    if (redirectTarget.startsWith('/') && normalizePath(redirectTarget) === normalizePath(sourcePath)) {
      throw new Error('Redirect target must be different to the source URL.');
    }
  }

  const archivePayload = {
    is_active: false,
    archived_at: new Date().toISOString(),
    archive_mode: params.mode,
    redirect_target: params.mode === 'gone_410' ? null : redirectTarget
  };
  const { error: archiveError } = await supabase.from(table).update(archivePayload).eq('id', params.taxonomyId);
  if (archiveError) throw archiveError;

  if (params.mode === 'redirect_301' || params.mode === 'merge_redirect_301') {
    const { error: redirectError } = await supabase
      .from('redirects')
      .upsert({
        source_path: sourcePath,
        target_url: redirectTarget,
        status_code: 301,
        match_type: 'exact',
        is_active: true,
        priority: 100,
        notes: `Taxonomy archive redirect (${params.kind})`,
        source_type: 'taxonomy_archive',
        source_ref: `${params.kind}:${params.taxonomyId}`
      }, { onConflict: 'source_path,match_type' });
    if (redirectError) throw redirectError;
  } else {
    const { error: goneError } = await supabase
      .from('redirects')
      .upsert({
        source_path: sourcePath,
        target_url: null,
        status_code: 410,
        match_type: 'exact',
        is_active: true,
        priority: 100,
        notes: `Taxonomy archive 410 (${params.kind})`,
        source_type: 'taxonomy_archive',
        source_ref: `${params.kind}:${params.taxonomyId}`
      }, { onConflict: 'source_path,match_type' });
    if (goneError) throw goneError;
  }

  const impact = affectedCount || (await getTaxonomyArchiveImpact(params.kind, params.taxonomyId)).assignedContentCount;
  await supabase.from('taxonomy_archive_events').insert({
    actor_id: params.actorId || '',
    actor_email: params.actorEmail || '',
    taxonomy_kind: params.kind,
    taxonomy_id: params.taxonomyId,
    source_url: sourcePath,
    archive_mode: params.mode,
    redirect_target: redirectTarget,
    merge_target_id: mergeTargetId,
    affected_association_count: impact
  });

  return {
    sourcePath,
    mode: params.mode,
    redirectTarget: redirectTarget || null,
    affectedAssociationCount: impact
  };
}

export async function deleteBlogAuthor(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from('blog_authors').delete().eq('id', id);
  if (error) throw error;
}

export async function listMediaAssets(query = '', usageFilter: MediaUsageFilter = 'all') {
  const supabase = getSupabase();
  let request = supabase.from('media_assets').select('*').order('created_at', { ascending: false }).limit(120);
  const orFilter = buildOrIlikeFilter(['storage_path', 'alt_text_default', 'caption_default'], query);
  if (orFilter) {
    request = request.or(orFilter);
  }
  const { data, error } = await request;
  if (error) throw error;
  const assets = (data || []) as MediaAssetRecord[];
  if (usageFilter === 'all' || !assets.length) {
    return assets;
  }

  const usageCounts = await buildMediaUsageCountsByAssetId(supabase, assets.map((asset) => ({
    id: asset.id,
    storage_path: asset.storage_path
  })));
  return assets.filter((asset) => {
    const count = usageCounts.get(asset.id) || 0;
    return usageFilter === 'used' ? count > 0 : count === 0;
  });
}

export async function getMediaAssetById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('media_assets').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as MediaAssetRecord | null) || null;
}

export async function updateMediaAsset(id: string, input: Partial<MediaAssetRecord>) {
  const supabase = getSupabase();
  const payload = {
    alt_text_default: input.alt_text_default ?? '',
    caption_default: input.caption_default ?? '',
    credit_source: input.credit_source ?? '',
    focal_x: input.focal_x ?? null,
    focal_y: input.focal_y ?? null
  };
  const { data, error } = await supabase.from('media_assets').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return data as MediaAssetRecord;
}

export async function getMediaAssetUsage(id: string): Promise<MediaAssetUsageSummary | null> {
  const supabase = getSupabase();
  const asset = await getMediaAssetById(id);
  if (!asset) return null;

  const { data: postRows, error: postError } = await supabase
    .from('blog_posts')
    .select('id,title,slug,featured_image_id,og_image_id,content_json')
    .is('deleted_at', null);
  if (postError) throw postError;

  const { data: authorRows, error: authorError } = await supabase
    .from('blog_authors')
    .select('id,name,slug,image_asset_id');
  if (authorError) throw authorError;

  const posts = (postRows || []) as Array<{
    id: string;
    title: string;
    slug: string;
    featured_image_id: string | null;
    og_image_id: string | null;
    content_json: unknown;
  }>;
  const authors = (authorRows || []) as Array<{
    id: string;
    name: string;
    slug: string;
    image_asset_id: string | null;
  }>;

  const featuredRefs = posts
    .filter((post) => post.featured_image_id === id)
    .map((post) => ({ id: post.id, title: post.title, slug: post.slug }));
  const ogRefs = posts
    .filter((post) => post.og_image_id === id)
    .map((post) => ({ id: post.id, title: post.title, slug: post.slug }));
  const authorRefs = authors
    .filter((author) => author.image_asset_id === id)
    .map((author) => ({ id: author.id, title: author.name, slug: author.slug }));

  const contentBlockRefs = posts
    .filter((post) => countAssetIdReferences(post.content_json, id) > 0)
    .map((post) => ({ id: post.id, title: post.title, slug: post.slug }));
  const contentBlockCount = posts.reduce((sum, post) => sum + countAssetIdReferences(post.content_json, id), 0);

  let episodeHeroRefs: MediaAssetUsageReference[] = [];
  try {
    const { data: episodeEditorialRows, error: episodeEditorialError } = await supabase
      .from('podcast_episode_editorial')
      .select('episode_id')
      .eq('hero_image_storage_path', asset.storage_path);
    if (episodeEditorialError) throw episodeEditorialError;

    const episodeIds = [...new Set((episodeEditorialRows || []).map((row) => row.episode_id).filter(Boolean))];
    if (episodeIds.length) {
      const { data: episodeRows, error: episodesError } = await supabase
        .from('podcast_episodes')
        .select('id,title,slug')
        .in('id', episodeIds);
      if (episodesError) throw episodesError;
      episodeHeroRefs = ((episodeRows || []) as Array<{ id: string; title: string; slug: string }>)
        .map((row) => ({ id: row.id, title: row.title, slug: row.slug }));
    }
  } catch (error) {
    if (!isMissingEpisodeEditorialError(error)) throw error;
  }

  const counts = {
    featuredPosts: featuredRefs.length,
    ogPosts: ogRefs.length,
    authorProfiles: authorRefs.length,
    contentBlocks: contentBlockCount,
    episodeHeroImages: episodeHeroRefs.length
  };
  const totalUsage = counts.featuredPosts + counts.ogPosts + counts.authorProfiles + counts.contentBlocks + counts.episodeHeroImages;

  return {
    assetId: id,
    storagePath: asset.storage_path,
    canDelete: totalUsage === 0,
    totalUsage,
    counts,
    references: {
      featuredPosts: featuredRefs.slice(0, 20),
      ogPosts: ogRefs.slice(0, 20),
      authorProfiles: authorRefs.slice(0, 20),
      contentBlocks: contentBlockRefs.slice(0, 20),
      episodeHeroImages: episodeHeroRefs.slice(0, 20)
    }
  };
}

export async function deleteMediaAssetById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('media_assets').delete().eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return (data as MediaAssetRecord | null) || null;
}

export async function createMediaAsset(input: {
  storagePath: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  altTextDefault?: string;
  captionDefault?: string;
  creditSource?: string;
}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('media_assets')
    .insert({
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      width: input.width || null,
      height: input.height || null,
      alt_text_default: input.altTextDefault || '',
      caption_default: input.captionDefault || '',
      credit_source: input.creditSource || ''
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MediaAssetRecord;
}

export async function listBlogPostsAdmin(params?: {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  sort?: 'published' | 'updated';
  includeDeleted?: boolean;
}) {
  const supabase = getSupabase();
  const page = normalizePageNumber(params?.page);
  const pageSizeRaw = typeof params?.pageSize === 'number' && Number.isInteger(params.pageSize) ? params.pageSize : 20;
  const pageSize = Math.max(5, Math.min(100, pageSizeRaw));
  let filteredPostIds: string[] | null = null;

  if (params?.categoryId) {
    const { data: categoryRows, error: categoryError } = await supabase
      .from('blog_post_categories')
      .select('post_id')
      .eq('category_id', params.categoryId);
    if (categoryError) throw categoryError;
    filteredPostIds = (categoryRows || []).map((row) => row.post_id);
    if (!filteredPostIds.length) {
      return {
        items: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 1
        }
      };
    }
  }

  const offset = (page - 1) * pageSize;

  const applyCommonFilters = (request: any) => {
    let scoped = request;
    if (!params?.includeDeleted) {
      scoped = scoped.is('deleted_at', null);
    }
    if (params?.status && BLOG_POST_STATUSES.includes(params.status as BlogPostStatus)) {
      scoped = scoped.eq('status', params.status);
    }
    if (filteredPostIds) {
      scoped = scoped.in('id', filteredPostIds);
    }
    const orFilter = buildOrIlikeFilter(['title', 'slug'], params?.q || '');
    if (orFilter) {
      scoped = scoped.or(orFilter);
    }
    return scoped;
  };

  const { count, error: countError } = await applyCommonFilters(
    supabase.from('blog_posts').select('id', { count: 'exact', head: true })
  );
  if (countError) throw countError;

  const total = count || 0;
  const pagination = {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
  const range = safeRangeWindow(total, offset, pageSize);
  if (!range) {
    return {
      items: [],
      pagination
    };
  }

  let request = applyCommonFilters(
    supabase.from('blog_posts').select('*').range(range.from, range.to)
  );
  if (params?.sort === 'updated') {
    request = request.order('updated_at', { ascending: false });
  } else {
    request = request.order('published_at', { ascending: false, nullsFirst: false }).order('updated_at', { ascending: false });
  }

  const { data, error } = await request;
  if (error) throw error;
  const items = await hydratePosts((data || []) as unknown as BlogPostRecord[]);
  return {
    items,
    pagination
  };
}

export async function getBlogPostAdminById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await hydratePosts([data as unknown as BlogPostRecord]);
  const { data: revisions, error: revisionsError } = await supabase
    .from('blog_post_revisions')
    .select('*')
    .eq('post_id', id)
    .order('revision_number', { ascending: false });
  if (revisionsError) throw revisionsError;
  const { data: overrides, error: overridesError } = await supabase
    .from('blog_post_related_overrides')
    .select('related_post_id, sort_order')
    .eq('post_id', id)
    .order('sort_order', { ascending: true });
  if (overridesError) throw overridesError;
  return {
    ...post,
    revisions: revisions || [],
    related_override_ids: (overrides || []).map((item) => item.related_post_id)
  };
}

export async function createBlogPost(initial?: Partial<BlogPostWriteInput>) {
  const supabase = getSupabase();
  const authors = await listBlogAuthors();
  const authorId = initial?.authorId || authors[0]?.id;
  if (!authorId) {
    throw new Error('At least one blog author is required before creating a post.');
  }
  const title = initial?.title?.trim() || 'Untitled post';
  const slug = await ensureUniqueBlogSlug(supabase, initial?.slug || title);
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      title,
      slug,
      status: initial?.status || 'draft',
      content_json: initial?.contentJson || createDefaultBlogDocument(),
      author_id: authorId,
      excerpt_plain: '',
      search_plaintext: ''
    })
    .select('*')
    .single();
  if (error) throw error;
  return (await hydratePosts([data as BlogPostRecord]))[0];
}

export async function saveBlogPost(postId: string | null, input: unknown, options?: { autosave?: boolean }) {
  const payload = blogPostWriteSchema.parse(input);
  const supabase = getSupabase();
  const uniqueCategoryIds = [...new Set(payload.taxonomy.categoryIds)];
  const uniqueTagIds = [...new Set(payload.taxonomy.tagIds)];
  const linkedEpisodeIds = payload.linkedEpisodes.map((item) => item.episodeId);
  const document = normalizePrimaryListenEpisodeBlocksForSave(
    syncPrimaryListenEpisodeBlocksEpisode(normalizeBlogDocument(payload.contentJson), linkedEpisodeIds[0]),
    linkedEpisodeIds
  );

  const categoriesMap = await getTaxonomyItemsByIds(supabase, 'categories', uniqueCategoryIds);
  const tagsMap = await getTaxonomyItemsByIds(supabase, 'tags', uniqueTagIds);
  if (categoriesMap.size !== uniqueCategoryIds.length) {
    throw new Error('One or more categories are archived or invalid.');
  }
  if (tagsMap.size !== uniqueTagIds.length) {
    throw new Error('One or more tags are archived or invalid.');
  }
  if (payload.primaryCategoryId) {
    const primaryCategoryMap = await getTaxonomyItemsByIds(supabase, 'categories', [payload.primaryCategoryId]);
    if (!primaryCategoryMap.has(payload.primaryCategoryId)) {
      throw new Error('Primary category must reference an active category.');
    }
  }
  const discoveryIds = [
    ...(payload.discovery.primaryTopicId ? [payload.discovery.primaryTopicId] : []),
    ...payload.discovery.topicIds,
    ...payload.discovery.themeIds,
    ...payload.discovery.entityIds,
    ...payload.discovery.caseIds,
    ...payload.discovery.eventIds,
    ...payload.discovery.collectionIds,
    ...payload.discovery.seriesIds
  ];
  const uniqueDiscoveryIds = [...new Set(discoveryIds)];
  const discoveryTermsMap = await getDiscoveryTermsByIds(supabase, uniqueDiscoveryIds);
  if (discoveryTermsMap.size !== uniqueDiscoveryIds.length) {
    throw new Error('One or more discovery terms are archived or invalid.');
  }
  const episodesMap = await getEpisodesByIds(
    supabase,
    payload.linkedEpisodes.map((item) => item.episodeId)
  );

  const plainText = blogDocumentToPlainText(document);
  const excerptAuto = generateExcerpt(document);
  const excerptPlain = (payload.excerpt || excerptAuto || '').replace(/\s+/g, ' ').trim();
  const markdown = blogDocumentToMarkdown(document);
  const readingTime = estimateReadingTimeMinutes(document);
  const toc = extractToc(document);
  const headingOutline = collectHeadingOutline(document);
  const seo = buildSeoChecklist({
    title: payload.title,
    seoTitle: payload.seo.seoTitle,
    seoDescription: payload.seo.seoDescription,
    focusKeyword: payload.seo.focusKeyword,
    canonicalUrl: payload.seo.canonicalUrl,
    document,
    excerpt: payload.excerpt,
    hasAuthor: Boolean(payload.authorId),
    hasPrimaryCategory: Boolean(payload.discovery.primaryTopicId),
    hasLinkedEpisode: payload.linkedEpisodes.length > 0
  });

  const searchPlaintext = serializeSearchPlaintext({
    title: payload.title,
    excerpt: excerptPlain,
    contentPlain: plainText,
    categories: uniqueCategoryIds.map((id) => categoriesMap.get(id)).filter(Boolean) as TaxonomyItem[],
    tags: uniqueTagIds.map((id) => tagsMap.get(id)).filter(Boolean) as TaxonomyItem[],
    discoveryTerms: discoveryIds
      .map((id) => discoveryTermsMap.get(id)?.name || '')
      .filter(Boolean),
    episodes: payload.linkedEpisodes.map((item) => episodesMap.get(item.episodeId)).filter(Boolean) as PodcastEpisodeRecord[]
  });

  const publishNow = payload.status === 'published' && !payload.publishedAt;
  const nowIso = new Date().toISOString();
  const uniqueSlug = await ensureUniqueBlogSlug(supabase, payload.slug || payload.title, postId || undefined);
  const postValues = {
    title: payload.title.trim(),
    slug: uniqueSlug,
    status: ensureStatus(payload.status),
    excerpt: payload.excerpt,
    excerpt_auto: excerptAuto,
    excerpt_plain: excerptPlain,
    content_json: document,
    content_markdown: markdown,
    featured_image_id: payload.featuredImageId,
    author_id: payload.authorId,
    published_at: publishNow ? nowIso : payload.publishedAt,
    scheduled_at: payload.status === 'scheduled' ? payload.scheduledAt : null,
    archived_at: payload.status === 'archived' ? payload.archivedAt || nowIso : null,
    reading_time_minutes: readingTime,
    is_featured: payload.isFeatured,
    primary_category_id: payload.primaryCategoryId,
    canonical_url: payload.seo.canonicalUrl,
    noindex: payload.seo.noindex,
    nofollow: payload.seo.nofollow,
    seo_title: payload.seo.seoTitle,
    seo_description: payload.seo.seoDescription,
    social_title: payload.seo.socialTitle,
    social_description: payload.seo.socialDescription,
    og_image_id: payload.seo.ogImageId,
    focus_keyword: payload.seo.focusKeyword,
    seo_score: seo.score,
    schema_type: payload.seo.schemaType,
    toc_json: toc,
    heading_outline: headingOutline,
    seo_warnings: seo.warnings,
    search_plaintext: searchPlaintext
  };

  let previousPost: BlogPostRecord | null = null;
  if (postId) {
    const { data: existing, error: existingError } = await supabase.from('blog_posts').select('*').eq('id', postId).single();
    if (existingError) throw existingError;
    previousPost = existing as BlogPostRecord;
  }

  const basePayload = postValues;

  const upsert = postId
    ? await supabase.from('blog_posts').update(basePayload).eq('id', postId).select('*').single()
    : await supabase.from('blog_posts').insert(basePayload).select('*').single();
  if (upsert.error) throw upsert.error;
  const savedId = upsert.data.id as string;

  await syncTaxonomyLinks(supabase, savedId, payload.taxonomy);
  await syncBlogPostDiscovery(supabase, savedId, payload.discovery);
  await syncEpisodeLinks(supabase, savedId, payload.linkedEpisodes);
  await syncRelatedOverrides(supabase, savedId, payload.relatedPostIds);

  if (
    previousPost &&
    previousPost.slug !== basePayload.slug &&
    previousPost.status === 'published' &&
    previousPost.deleted_at === null
  ) {
    await createSlugRedirect(supabase, savedId, previousPost.slug, basePayload.slug);
  }

  if (!options?.autosave) {
    await createRevision(supabase, {
      postId: savedId,
      title: basePayload.title,
      excerpt: basePayload.excerpt,
      contentJson: document,
      contentMarkdown: markdown,
      seoSnapshot: payload.seo,
      taxonomySnapshot: {
        taxonomy: payload.taxonomy,
        discovery: payload.discovery
      },
      linkedEpisodesSnapshot: payload.linkedEpisodes
    });
  }

  return getBlogPostAdminById(savedId);
}

export async function archiveBlogPost(id: string) {
  return saveBlogPost(id, {
    ...(await getBlogPostForMutation(id)),
    status: 'archived',
    archivedAt: new Date().toISOString()
  });
}

async function getBlogPostForMutation(id: string): Promise<BlogPostWriteInput> {
  const post = await getBlogPostAdminById(id);
  if (!post) throw new Error('Post not found.');
  return {
    title: post.title,
    slug: post.slug,
    status: post.status,
    excerpt: post.excerpt,
    contentJson: post.content_json,
    featuredImageId: post.featured_image_id,
    authorId: post.author_id,
    publishedAt: post.published_at,
    scheduledAt: post.scheduled_at,
    archivedAt: post.archived_at,
    isFeatured: post.is_featured,
    primaryCategoryId: post.primary_category_id,
    taxonomy: {
      categoryIds: post.taxonomies.categories.map((item: TaxonomyItem) => item.id),
      tagIds: post.taxonomies.tags.map((item: TaxonomyItem) => item.id),
      seriesIds: [],
      topicClusterIds: [],
      labelIds: []
    },
    discovery: {
      primaryTopicId: post.discovery.primaryTopicId,
      topicIds: post.discovery.topicIds,
      themeIds: post.discovery.themeIds,
      entityIds: post.discovery.entityIds,
      caseIds: post.discovery.caseIds,
      eventIds: post.discovery.eventIds,
      collectionIds: post.discovery.collectionIds,
      seriesIds: post.discovery.seriesIds
    },
    linkedEpisodes: post.linked_episodes.map((item: { episode: PodcastEpisodeRecord; sort_order: number; is_primary: boolean }) => ({
      episodeId: item.episode.id,
      sortOrder: item.sort_order,
      isPrimary: item.is_primary
    })),
    relatedPostIds: post.related_override_ids,
    seo: {
      seoTitle: post.seo_title,
      seoDescription: post.seo_description,
      socialTitle: post.social_title,
      socialDescription: post.social_description,
      canonicalUrl: post.canonical_url,
      noindex: post.noindex,
      nofollow: post.nofollow,
      focusKeyword: post.focus_keyword,
      schemaType: post.schema_type,
      ogImageId: post.og_image_id
    },
    revisionReason: ''
  };
}

export async function softDeleteBlogPost(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from('blog_posts').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function duplicateBlogPost(id: string) {
  const existing = await getBlogPostForMutation(id);
  const supabase = getSupabase();
  const duplicateTitle = `${existing.title} Copy`;
  const duplicateSlug = await ensureUniqueBlogSlug(supabase, `${existing.slug}-copy`);

  return saveBlogPost(null, {
    ...existing,
    title: duplicateTitle,
    slug: duplicateSlug,
    status: 'draft',
    publishedAt: null,
    scheduledAt: null,
    archivedAt: null,
    isFeatured: false,
    revisionReason: 'Duplicated from existing post'
  });
}

export async function restoreBlogPost(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('blog_posts')
    .update({ deleted_at: null, status: 'draft', archived_at: null })
    .eq('id', id);
  if (error) throw error;
}

export async function restoreBlogRevision(postId: string, revisionId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('blog_post_revisions')
    .select('*')
    .eq('post_id', postId)
    .eq('id', revisionId)
    .single();
  if (error) throw error;
  const current = await getBlogPostForMutation(postId);
  const normalizedSnapshot = normalizeBlogDocument(data.content_json_snapshot);
  const legacySnapshot = (data.taxonomy_snapshot || {}) as Record<string, any>;
  const taxonomySnapshot = legacySnapshot.taxonomy || legacySnapshot;
  const discoverySnapshot = legacySnapshot.discovery || {
    primaryTopicId: Array.isArray(legacySnapshot.topicClusterIds) ? legacySnapshot.topicClusterIds[0] || null : null,
    topicIds: Array.isArray(legacySnapshot.topicClusterIds) ? legacySnapshot.topicClusterIds.slice(1) : [],
    themeIds: [],
    entityIds: [],
    caseIds: [],
    eventIds: [],
    collectionIds: [],
    seriesIds: Array.isArray(legacySnapshot.seriesIds) ? legacySnapshot.seriesIds : []
  };
  return saveBlogPost(postId, {
    ...current,
    title: data.title_snapshot,
    excerpt: data.excerpt_snapshot,
    contentJson: normalizedSnapshot,
    taxonomy: {
      categoryIds: taxonomySnapshot?.categoryIds || [],
      tagIds: taxonomySnapshot?.tagIds || [],
      seriesIds: taxonomySnapshot?.seriesIds || [],
      topicClusterIds: taxonomySnapshot?.topicClusterIds || [],
      labelIds: taxonomySnapshot?.labelIds || []
    },
    discovery: {
      primaryTopicId: discoverySnapshot?.primaryTopicId || null,
      topicIds: discoverySnapshot?.topicIds || [],
      themeIds: discoverySnapshot?.themeIds || [],
      entityIds: discoverySnapshot?.entityIds || [],
      caseIds: discoverySnapshot?.caseIds || [],
      eventIds: discoverySnapshot?.eventIds || [],
      collectionIds: discoverySnapshot?.collectionIds || [],
      seriesIds: discoverySnapshot?.seriesIds || []
    },
    linkedEpisodes: data.linked_episodes_snapshot || [],
    seo: {
      ...current.seo,
      ...(data.seo_snapshot || {})
    },
    revisionReason: 'Restored from revision'
  });
}

export async function listPublishedBlogPosts(params?: { page?: number; limit?: number }) {
  const supabase = getSupabase();
  const page = normalizePageNumber(params?.page);
  const limitRaw = typeof params?.limit === 'number' && Number.isInteger(params.limit) ? params.limit : SEARCH_PAGE_SIZE;
  const limit = Math.max(1, Math.min(24, limitRaw));
  const offset = (page - 1) * limit;

  const { count, error: countError } = await supabase
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString());
  if (countError) throw countError;

  const total = count || 0;
  const pagination = {
    page,
    pageSize: limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
  const range = safeRangeWindow(total, offset, limit);
  if (!range) {
    return {
      items: [],
      pagination
    };
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .select(BLOG_POST_PUBLIC_LIST_SELECT)
    .is('deleted_at', null)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })
    .range(range.from, range.to);
  if (error) throw error;

  const items = await hydratePosts((data || []) as unknown as BlogPostRecord[]);
  return {
    items,
    pagination
  };
}

export type BlogPostSitemapRecord = {
  slug: string;
  author_id: string;
  canonical_url: string | null;
  noindex: boolean;
  published_at: string | null;
  updated_at: string;
};

export async function listPublishedBlogPostsForSitemap() {
  const supabase = getSupabase();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug, author_id, canonical_url, noindex, published_at, updated_at')
    .is('deleted_at', null)
    .eq('status', 'published')
    .lte('published_at', nowIso)
    .order('published_at', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as BlogPostSitemapRecord[];
}

export async function listFeaturedBlogPosts(params?: { limit?: number }) {
  const supabase = getSupabase();
  const limit = Math.max(1, Math.min(12, params?.limit || 6));
  const { data, error } = await supabase
    .from('blog_posts')
    .select(BLOG_POST_PUBLIC_LIST_SELECT)
    .is('deleted_at', null)
    .eq('status', 'published')
    .eq('is_featured', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydratePosts((data || []) as unknown as BlogPostRecord[]);
}

export async function listPublishedBlogPostsFeed(params?: {
  offset?: number;
  limit?: number;
  categorySlug?: string | null;
}) {
  const supabase = getSupabase();
  const offsetRaw = typeof params?.offset === 'number' && Number.isInteger(params.offset) ? params.offset : 0;
  const offset = Math.max(0, offsetRaw);
  const limitRaw = typeof params?.limit === 'number' && Number.isInteger(params.limit) ? params.limit : 6;
  const limit = Math.max(1, Math.min(24, limitRaw));
  const nowIso = new Date().toISOString();

  let filteredPostIds: string[] | null = null;
  if (params?.categorySlug) {
    const normalizedCategorySlug = slugifyBlogText(params.categorySlug);
    if (!normalizedCategorySlug) {
      return { items: [], nextOffset: offset, hasMore: false, total: 0 };
    }

    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', normalizedCategorySlug)
      .maybeSingle();
    if (categoryError) throw categoryError;
    if (!category) {
      return { items: [], nextOffset: offset, hasMore: false, total: 0 };
    }

    const { data: categoryLinks, error: categoryLinksError } = await supabase
      .from('blog_post_categories')
      .select('post_id')
      .eq('category_id', category.id);
    if (categoryLinksError) throw categoryLinksError;

    filteredPostIds = Array.from(new Set((categoryLinks || []).map((item) => item.post_id)));
    if (!filteredPostIds.length) {
      return { items: [], nextOffset: offset, hasMore: false, total: 0 };
    }
  }

  let countQuery = supabase
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('status', 'published')
    .lte('published_at', nowIso);

  if (filteredPostIds) {
    countQuery = countQuery.in('id', filteredPostIds);
  }

  const { count, error: countError } = await countQuery;
  if (countError) throw countError;

  const total = count || 0;
  const range = safeRangeWindow(total, offset, limit);
  if (!range) {
    return {
      items: [],
      nextOffset: Math.min(offset, total),
      hasMore: false,
      total
    };
  }

  let query = supabase
    .from('blog_posts')
    .select(BLOG_POST_PUBLIC_LIST_SELECT)
    .is('deleted_at', null)
    .eq('status', 'published')
    .lte('published_at', nowIso)
    .order('published_at', { ascending: false })
    .range(range.from, range.to);
  if (filteredPostIds) {
    query = query.in('id', filteredPostIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const items = await hydratePosts((data || []) as unknown as BlogPostRecord[]);
  const nextOffset = Math.min(total, offset + items.length);

  return {
    items,
    nextOffset,
    hasMore: nextOffset < total,
    total
  };
}

export async function getBlogPostBySlug(slug: string, options?: {
  includeDraft?: boolean;
  includeHeavyFields?: boolean;
  includeRelatedPosts?: boolean;
}) {
  const supabase = getSupabase();
  const includeHeavyFields = options?.includeHeavyFields ?? true;
  const includeRelatedPosts = options?.includeRelatedPosts ?? true;
  let query = supabase
    .from('blog_posts')
    .select(includeHeavyFields ? BLOG_POST_PUBLIC_DETAIL_SELECT : BLOG_POST_PUBLIC_METADATA_SELECT)
    .eq('slug', slug)
    .is('deleted_at', null);
  if (!options?.includeDraft) {
    query = query.eq('status', 'published').lte('published_at', new Date().toISOString());
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await hydratePosts([data as unknown as BlogPostRecord]);
  const related = includeRelatedPosts ? await getRelatedPostsForPost(post.id) : [];
  return {
    ...post,
    related_posts: related
  };
}

export async function resolveBlogSlugRedirect(slug: string): Promise<string | null> {
  const supabase = getSupabase();
  const sourcePath = normalizePath(`/blog/${slug}`);
  const { data, error } = await supabase.rpc('resolve_redirect', { p_path: sourcePath });
  if (error) {
    console.error('[blog redirect] failed to resolve old slug:', error);
    return null;
  }

  const row = ((data || [])[0] || null) as
    | {
        source_path: string;
        target_url: string;
        match_type: 'exact' | 'prefix';
      }
    | null;
  if (!row) return null;
  if (row.match_type !== 'exact') return null;

  const targetPath = normalizePath(row.target_url || '');
  if (!targetPath.startsWith('/blog/')) return null;
  if (targetPath === sourcePath) return null;
  return targetPath;
}

async function getRelatedPostsForPost(postId: string) {
  const supabase = getSupabase();
  const { data: overrides, error: overridesError } = await supabase
    .from('blog_post_related_overrides')
    .select('related_post_id, sort_order')
    .eq('post_id', postId)
    .order('sort_order', { ascending: true });
  if (overridesError) throw overridesError;
  const overrideIds = (overrides || []).map((item) => item.related_post_id);
  if (overrideIds.length) {
    const { data: posts, error } = await supabase
      .from('blog_posts')
      .select(BLOG_POST_PUBLIC_LIST_SELECT)
      .in('id', overrideIds)
      .eq('status', 'published')
      .is('deleted_at', null);
    if (error) throw error;
    return hydratePosts((posts || []) as unknown as BlogPostRecord[]);
  }

  const current = await getBlogPostAdminById(postId);
  if (!current) return [];
  const tagIds = current.taxonomies.tags.map((item: TaxonomyItem) => item.id);
  const categoryIds = current.taxonomies.categories.map((item: TaxonomyItem) => item.id);

  const candidateIds = new Set<string>();
  if (tagIds.length) {
    const { data } = await supabase.from('blog_post_tags').select('post_id').in('tag_id', tagIds);
    (data || []).forEach((item) => candidateIds.add(item.post_id));
  }
  if (categoryIds.length) {
    const { data } = await supabase.from('blog_post_categories').select('post_id').in('category_id', categoryIds);
    (data || []).forEach((item) => candidateIds.add(item.post_id));
  }
  candidateIds.delete(postId);
  if (!candidateIds.size) return [];

  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select(BLOG_POST_PUBLIC_LIST_SELECT)
    .in('id', [...candidateIds])
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(3);
  if (error) throw error;
  return hydratePosts((posts || []) as unknown as BlogPostRecord[]);
}

export async function listTaxonomyArchive(kind: TaxonomyKind, slug: string, page = 1) {
  const supabase = getSupabase();
  const normalizedPage = normalizePageNumber(page);
  const config = TAXONOMY_CONFIG[kind];
  const { data: term, error: termError } = await supabase.from(config.table).select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (termError) throw termError;
  if (!term) return null;
  const { data: joinData, error: joinError } = await supabase
    .from(config.joinTable)
    .select('post_id')
    .eq(config.idColumn, term.id)
    .order('created_at', { ascending: false });
  if (joinError) throw joinError;
  const postIds = (joinData || []).map((row) => row.post_id);
  if (!postIds.length) {
    return {
      term,
      items: [],
      pagination: { page: normalizedPage, pageSize: SEARCH_PAGE_SIZE, total: 0, totalPages: 1 }
    };
  }
  const offset = (normalizedPage - 1) * SEARCH_PAGE_SIZE;

  const { count, error: countError } = await supabase
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .in('id', postIds)
    .eq('status', 'published')
    .is('deleted_at', null);
  if (countError) throw countError;

  const total = count || 0;
  const pagination = {
    page: normalizedPage,
    pageSize: SEARCH_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE))
  };
  const range = safeRangeWindow(total, offset, SEARCH_PAGE_SIZE);
  if (!range) {
    return {
      term,
      items: [],
      pagination
    };
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .select(BLOG_POST_PUBLIC_LIST_SELECT)
    .in('id', postIds)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .range(range.from, range.to);
  if (error) throw error;
  return {
    term,
    items: await hydratePosts((data || []) as unknown as BlogPostRecord[]),
    pagination
  };
}

export async function resolveLegacyBlogTaxonomyRedirect(kind: 'series' | 'topic', slug: string) {
  const supabase = getSupabase();
  const normalizedSlug = slugifyBlogText(slug);
  if (!normalizedSlug) return null;

  const { data, error } = await supabase
    .from('discovery_terms')
    .select('slug')
    .eq('term_type', kind === 'series' ? 'series' : 'topic')
    .eq('slug', normalizedSlug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return kind === 'series' ? `/collections/${data.slug}` : `/topics/${data.slug}`;
}

export async function listAuthorArchive(slug: string, page = 1) {
  const supabase = getSupabase();
  const normalizedPage = normalizePageNumber(page);
  const { data: author, error: authorError } = await supabase.from('blog_authors').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (authorError) throw authorError;
  if (!author) return null;
  const offset = (normalizedPage - 1) * SEARCH_PAGE_SIZE;

  const { count, error: countError } = await supabase
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', author.id)
    .eq('status', 'published')
    .is('deleted_at', null);
  if (countError) throw countError;

  const total = count || 0;
  const pagination = {
    page: normalizedPage,
    pageSize: SEARCH_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE))
  };
  const range = safeRangeWindow(total, offset, SEARCH_PAGE_SIZE);
  if (!range) {
    return {
      author,
      items: [],
      pagination
    };
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .select(BLOG_POST_PUBLIC_LIST_SELECT)
    .eq('author_id', author.id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .range(range.from, range.to);
  if (error) throw error;
  return {
    author,
    items: await hydratePosts((data || []) as unknown as BlogPostRecord[]),
    pagination
  };
}

export async function searchBlogPosts(query: string, page = 1) {
  const supabase = getSupabase();
  const normalizedPage = normalizePageNumber(page);
  const limit = SEARCH_PAGE_SIZE;
  const { data, error } = await supabase.rpc('search_blog_posts', {
    p_query: query,
    p_limit: limit,
    p_offset: (normalizedPage - 1) * limit
  });
  if (error) throw error;
  const rows = data || [];
  const ids = rows.map((row: { id: string }) => row.id);
  if (!ids.length) {
    return { items: [], pagination: { page: normalizedPage, pageSize: limit, total: 0, totalPages: 1 } };
  }
  const { data: posts, error: postsError } = await supabase
    .from('blog_posts')
    .select(BLOG_POST_PUBLIC_LIST_SELECT)
    .in('id', ids);
  if (postsError) throw postsError;
  const hydrated = await hydratePosts((posts || []) as unknown as BlogPostRecord[]);
  const byId = new Map(hydrated.map((item) => [item.id, item]));
  const items = rows.map((row: { id: string; rank: number; similarity: number }) => ({
    ...byId.get(row.id),
    ranking: {
      rank: row.rank,
      similarity: row.similarity
    }
  }));
  return {
    items,
    pagination: {
      page: normalizedPage,
      pageSize: limit,
      total: items.length + (normalizedPage - 1) * limit,
      totalPages: normalizedPage + (items.length === limit ? 1 : 0)
    }
  };
}

export async function listPodcastEpisodes(params?: { q?: string; includeHidden?: boolean }) {
  const supabase = getSupabase();
  let query = supabase
    .from('podcast_episodes')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(200);
  if (!params?.includeHidden) query = query.eq('is_archived', false).eq('is_visible', true);
  const orFilter = buildOrIlikeFilter(['title', 'slug'], params?.q || '');
  if (orFilter) {
    query = query.or(orFilter);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as PodcastEpisodeRecord[];
}

export async function updatePodcastEpisode(id: string, input: Partial<PodcastEpisodeRecord>) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('podcast_episodes')
    .update({
      transcript: input.transcript,
      show_notes: input.show_notes,
      is_visible: input.is_visible,
      is_archived: input.is_archived
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return (data as PodcastEpisodeRecord | null) || null;
}

export async function listEpisodeSyncLogs() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('episode_sync_logs').select('*').order('started_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
}

export async function publishDueScheduledPosts() {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('publish_due_blog_posts');
  if (error) throw error;
  return Number(data || 0);
}

export async function recordBlogAnalyticsEvent(sessionSeed: string, input: BlogAnalyticsEventInput) {
  const supabase = getSupabase();
  const payload = blogAnalyticsEventInputSchema.parse(input);
  const sessionId = getSessionHash(sessionSeed);
  const dedupeKey =
    payload.eventType === 'pageview'
      ? `${sessionId}:${payload.postId || payload.path}:${new Date().toISOString().slice(0, 10)}`
      : null;

  if (dedupeKey) {
    const { data: existing, error: existingError } = await supabase
      .from('blog_analytics_events')
      .select('id')
      .eq('event_type', payload.eventType)
      .eq('session_id', sessionId)
      .eq('path', payload.path)
      .gte('occurred_at', `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
      .limit(1);
    if (existingError) throw existingError;
    if ((existing || []).length > 0) return { deduped: true };
  }

  const { error } = await supabase.from('blog_analytics_events').insert({
    event_type: payload.eventType,
    post_id: payload.postId || null,
    episode_id: payload.episodeId || null,
    session_id: sessionId,
    path: payload.path,
    referrer: payload.referrer,
    search_query: payload.searchQuery,
    metadata: payload.metadata
  });
  if (error) throw error;
  return { deduped: false };
}

export async function getBlogAnalyticsSummary() {
  const supabase = getSupabase();
  const [postTotals, episodeTotals, events] = await Promise.all([
    supabase.from('blog_analytics_post_totals').select('*').order('pageviews', { ascending: false }).limit(10),
    supabase.from('blog_analytics_episode_totals').select('*').order('platform_clicks', { ascending: false }).limit(10),
    supabase
      .from('blog_analytics_events')
      .select('event_type')
      .gte('occurred_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString())
  ]);
  if (postTotals.error) throw postTotals.error;
  if (episodeTotals.error) throw episodeTotals.error;
  if (events.error) throw events.error;

  const totals = {
    pageviews: 0,
    ctaClicks: 0,
    platformClicks: 0,
    patreonClicks: 0,
    listensStarted: 0
  };
  (events.data || []).forEach((item) => {
    if (item.event_type === 'pageview') totals.pageviews += 1;
    if (item.event_type === 'cta_click') totals.ctaClicks += 1;
    if (item.event_type === 'platform_click') totals.platformClicks += 1;
    if (item.event_type === 'patreon_click') totals.patreonClicks += 1;
    if (item.event_type === 'listen_start') totals.listensStarted += 1;
  });

  return {
    totals,
    topPosts: postTotals.data || [],
    topEpisodes: episodeTotals.data || []
  };
}

export async function createImportJob(sourceType: string, payload: Record<string, unknown>) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('import_jobs')
    .insert({
      source_type: sourceType,
      status: 'pending',
      payload
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateImportJob(id: string, input: Record<string, unknown>) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('import_jobs').update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function replaceImportJobRecords(jobId: string, records: Array<Record<string, unknown>>) {
  const supabase = getSupabase();
  const clearResult = await supabase.from('import_job_records').delete().eq('import_job_id', jobId);
  if (clearResult.error) throw clearResult.error;
  if (!records.length) return [];
  const { data, error } = await supabase
    .from('import_job_records')
    .insert(records.map((record) => ({ ...record, import_job_id: jobId })))
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function listImportJobs() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('import_jobs').select('*').order('started_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
}

export async function getImportJob(jobId: string) {
  const supabase = getSupabase();
  const { data: job, error: jobError } = await supabase.from('import_jobs').select('*').eq('id', jobId).maybeSingle();
  if (jobError) throw jobError;
  if (!job) return null;
  const { data: records, error: recordsError } = await supabase
    .from('import_job_records')
    .select('*')
    .eq('import_job_id', jobId)
    .order('created_at', { ascending: true });
  if (recordsError) throw recordsError;
  return {
    ...job,
    records: records || []
  };
}

export function getPatreonUrl() {
  return PATREON_URL;
}

export function createAnonymousSessionSeed() {
  return randomUUID();
}
