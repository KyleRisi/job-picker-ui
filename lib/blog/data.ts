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

export type BlogAuthorRecord = {
  id: string;
  name: string;
  slug: string;
  bio: string;
  image_url: string | null;
  image_asset_id: string | null;
};

export type PodcastEpisodeRecord = {
  id: string;
  rss_guid: string;
  title: string;
  slug: string;
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

export type TaxonomyKind = 'categories' | 'tags' | 'series' | 'topic_clusters' | 'post_labels' | 'blog_authors';
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
};

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

const PATREON_URL = 'https://www.patreon.com/cw/TheCompendiumPodcast';
const SEARCH_PAGE_SIZE = 12;

const TAXONOMY_CONFIG: Record<Exclude<TaxonomyKind, 'blog_authors'>, { table: string; joinTable: string; idColumn: string }> = {
  categories: { table: 'categories', joinTable: 'blog_post_categories', idColumn: 'category_id' },
  tags: { table: 'tags', joinTable: 'blog_post_tags', idColumn: 'tag_id' },
  series: { table: 'series', joinTable: 'blog_post_series', idColumn: 'series_id' },
  topic_clusters: { table: 'topic_clusters', joinTable: 'blog_post_topic_clusters', idColumn: 'topic_cluster_id' },
  post_labels: { table: 'post_labels', joinTable: 'blog_post_labels', idColumn: 'label_id' }
};

function getSupabase() {
  return createSupabaseAdminClient();
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
  const { data, error } = await supabase.from(table).select('*').in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((item) => [item.id, item as TaxonomyItem]));
}

async function getTaxonomyForPosts(
  supabase: SupabaseClient,
  postIds: string[]
) {
  if (!postIds.length) {
    return {
      categories: new Map<string, TaxonomyItem[]>(),
      tags: new Map<string, TaxonomyItem[]>(),
      series: new Map<string, TaxonomyItem[]>(),
      topicClusters: new Map<string, TaxonomyItem[]>(),
      labels: new Map<string, TaxonomyItem[]>()
    };
  }

  const categoriesPromise = supabase
    .from('blog_post_categories')
    .select('post_id, category_id')
    .in('post_id', postIds);
  const tagsPromise = supabase.from('blog_post_tags').select('post_id, tag_id').in('post_id', postIds);
  const seriesPromise = supabase.from('blog_post_series').select('post_id, series_id').in('post_id', postIds);
  const topicsPromise = supabase
    .from('blog_post_topic_clusters')
    .select('post_id, topic_cluster_id')
    .in('post_id', postIds);
  const labelsPromise = supabase.from('blog_post_labels').select('post_id, label_id').in('post_id', postIds);

  const [categoriesRows, tagRows, seriesRows, topicRows, labelRows] = await Promise.all([
    categoriesPromise,
    tagsPromise,
    seriesPromise,
    topicsPromise,
    labelsPromise
  ]);

  if (categoriesRows.error) throw categoriesRows.error;
  if (tagRows.error) throw tagRows.error;
  if (seriesRows.error) throw seriesRows.error;
  if (topicRows.error) throw topicRows.error;
  if (labelRows.error) throw labelRows.error;

  const categoryItems = await getTaxonomyItemsByIds(
    supabase,
    'categories',
    [...new Set((categoriesRows.data || []).map((item) => item.category_id))]
  );
  const tagItems = await getTaxonomyItemsByIds(supabase, 'tags', [...new Set((tagRows.data || []).map((item) => item.tag_id))]);
  const seriesItems = await getTaxonomyItemsByIds(supabase, 'series', [...new Set((seriesRows.data || []).map((item) => item.series_id))]);
  const topicItems = await getTaxonomyItemsByIds(
    supabase,
    'topic_clusters',
    [...new Set((topicRows.data || []).map((item) => item.topic_cluster_id))]
  );
  const labelItems = await getTaxonomyItemsByIds(
    supabase,
    'post_labels',
    [...new Set((labelRows.data || []).map((item) => item.label_id))]
  );

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
    tags: group(tagRows.data || [], 'tag_id', tagItems),
    series: group(seriesRows.data || [], 'series_id', seriesItems),
    topicClusters: group(topicRows.data || [], 'topic_cluster_id', topicItems),
    labels: group(labelRows.data || [], 'label_id', labelItems)
  };
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
  series: TaxonomyItem[];
  topics: TaxonomyItem[];
  labels: TaxonomyItem[];
  episodes: PodcastEpisodeRecord[];
}) {
  return [
    input.title,
    input.excerpt,
    input.contentPlain,
    ...input.categories.map((item) => item.name),
    ...input.tags.map((item) => item.name),
    ...input.series.map((item) => item.name),
    ...input.topics.map((item) => item.name),
    ...input.labels.map((item) => item.name),
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
      const ids = taxonomy[
        kind === 'categories'
          ? 'categoryIds'
          : kind === 'tags'
            ? 'tagIds'
            : kind === 'series'
              ? 'seriesIds'
              : kind === 'topic_clusters'
                ? 'topicClusterIds'
                : 'labelIds'
      ];
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
      tags: taxonomy.tags.get(row.id) || [],
      series: taxonomy.series.get(row.id) || [],
      topicClusters: taxonomy.topicClusters.get(row.id) || [],
      labels: taxonomy.labels.get(row.id) || []
    },
    linked_episodes: episodeLinks.get(row.id) || []
  }));
}

export async function listBlogAuthors() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('blog_authors').select('*').order('name');
  if (error) throw error;
  return data as BlogAuthorRecord[];
}

export async function listTaxonomy(kind: TaxonomyKind) {
  const supabase = getSupabase();
  const table = kind === 'blog_authors' ? 'blog_authors' : TAXONOMY_CONFIG[kind].table;
  const { data, error } = await supabase.from(table).select('*').order('name');
  if (error) throw error;
  return data as TaxonomyItem[];
}

export async function listBlogTaxonomies() {
  const [categories, tags, series, topicClusters, labels, authors] = await Promise.all([
    listTaxonomy('categories'),
    listTaxonomy('tags'),
    listTaxonomy('series'),
    listTaxonomy('topic_clusters'),
    listTaxonomy('post_labels'),
    listBlogAuthors()
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
  const table = kind === 'blog_authors' ? 'blog_authors' : TAXONOMY_CONFIG[kind].table;
  const normalizedSlug = slugifyBlogText(parsed.slug || parsed.name);
  if (!normalizedSlug) throw new Error('Slug is required.');
  const basePayload = {
    ...(parsed.id ? { id: parsed.id } : {}),
    name: parsed.name.trim(),
    slug: normalizedSlug
  };

  let payload: Record<string, unknown>;
  if (kind === 'blog_authors') {
    payload = {
      ...basePayload,
      bio: parsed.bio || '',
      image_url: parsed.imageUrl || null,
      image_asset_id: parsed.imageAssetId || null
    };
  } else if (kind === 'categories') {
    payload = {
      ...basePayload,
      description: parsed.description || '',
      parent_id: parsed.parentId || null
    };
  } else if (kind === 'tags') {
    payload = {
      ...basePayload
    };
  } else if (kind === 'series') {
    payload = {
      ...basePayload,
      description: parsed.description || ''
    };
  } else if (kind === 'topic_clusters') {
    payload = {
      ...basePayload,
      description: parsed.description || '',
      pillar_post_id: parsed.pillarPostId || null
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
  const table = kind === 'blog_authors' ? 'blog_authors' : TAXONOMY_CONFIG[kind].table;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function listMediaAssets(query = '') {
  const supabase = getSupabase();
  let request = supabase.from('media_assets').select('*').order('created_at', { ascending: false }).limit(120);
  const orFilter = buildOrIlikeFilter(['storage_path', 'alt_text_default', 'caption_default'], query);
  if (orFilter) {
    request = request.or(orFilter);
  }
  const { data, error } = await request;
  if (error) throw error;
  return data as MediaAssetRecord[];
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
  const items = await hydratePosts((data || []) as BlogPostRecord[]);
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
  const [post] = await hydratePosts([data as BlogPostRecord]);
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
  const linkedEpisodeIds = payload.linkedEpisodes.map((item) => item.episodeId);
  const document = normalizePrimaryListenEpisodeBlocksForSave(
    syncPrimaryListenEpisodeBlocksEpisode(normalizeBlogDocument(payload.contentJson), linkedEpisodeIds[0]),
    linkedEpisodeIds
  );

  const categoriesMap = await getTaxonomyItemsByIds(supabase, 'categories', payload.taxonomy.categoryIds);
  const tagsMap = await getTaxonomyItemsByIds(supabase, 'tags', payload.taxonomy.tagIds);
  const seriesMap = await getTaxonomyItemsByIds(supabase, 'series', payload.taxonomy.seriesIds);
  const topicsMap = await getTaxonomyItemsByIds(supabase, 'topic_clusters', payload.taxonomy.topicClusterIds);
  const labelsMap = await getTaxonomyItemsByIds(supabase, 'post_labels', payload.taxonomy.labelIds);
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
    excerpt: payload.excerpt
  });

  const searchPlaintext = serializeSearchPlaintext({
    title: payload.title,
    excerpt: excerptPlain,
    contentPlain: plainText,
    categories: payload.taxonomy.categoryIds.map((id) => categoriesMap.get(id)).filter(Boolean) as TaxonomyItem[],
    tags: payload.taxonomy.tagIds.map((id) => tagsMap.get(id)).filter(Boolean) as TaxonomyItem[],
    series: payload.taxonomy.seriesIds.map((id) => seriesMap.get(id)).filter(Boolean) as TaxonomyItem[],
    topics: payload.taxonomy.topicClusterIds.map((id) => topicsMap.get(id)).filter(Boolean) as TaxonomyItem[],
    labels: payload.taxonomy.labelIds.map((id) => labelsMap.get(id)).filter(Boolean) as TaxonomyItem[],
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
      taxonomySnapshot: payload.taxonomy,
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
      seriesIds: post.taxonomies.series.map((item: TaxonomyItem) => item.id),
      topicClusterIds: post.taxonomies.topicClusters.map((item: TaxonomyItem) => item.id),
      labelIds: post.taxonomies.labels.map((item: TaxonomyItem) => item.id)
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
  return saveBlogPost(postId, {
    ...current,
    title: data.title_snapshot,
    excerpt: data.excerpt_snapshot,
    contentJson: normalizedSnapshot,
    taxonomy: {
      categoryIds: data.taxonomy_snapshot?.categoryIds || [],
      tagIds: data.taxonomy_snapshot?.tagIds || [],
      seriesIds: data.taxonomy_snapshot?.seriesIds || [],
      topicClusterIds: data.taxonomy_snapshot?.topicClusterIds || [],
      labelIds: data.taxonomy_snapshot?.labelIds || []
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
    .select('*')
    .is('deleted_at', null)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })
    .range(range.from, range.to);
  if (error) throw error;

  const items = await hydratePosts((data || []) as BlogPostRecord[]);
  return {
    items,
    pagination
  };
}

export async function listFeaturedBlogPosts(params?: { limit?: number }) {
  const supabase = getSupabase();
  const limit = Math.max(1, Math.min(12, params?.limit || 6));
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .is('deleted_at', null)
    .eq('status', 'published')
    .eq('is_featured', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydratePosts((data || []) as BlogPostRecord[]);
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
    .select('*')
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

  const items = await hydratePosts((data || []) as BlogPostRecord[]);
  const nextOffset = Math.min(total, offset + items.length);

  return {
    items,
    nextOffset,
    hasMore: nextOffset < total,
    total
  };
}

export async function getBlogPostBySlug(slug: string, options?: { includeDraft?: boolean }) {
  const supabase = getSupabase();
  let query = supabase.from('blog_posts').select('*').eq('slug', slug).is('deleted_at', null);
  if (!options?.includeDraft) {
    query = query.eq('status', 'published').lte('published_at', new Date().toISOString());
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await hydratePosts([data as BlogPostRecord]);
  const related = await getRelatedPostsForPost(post.id);
  return {
    ...post,
    related_posts: related
  };
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
      .select('*')
      .in('id', overrideIds)
      .eq('status', 'published')
      .is('deleted_at', null);
    if (error) throw error;
    return hydratePosts((posts || []) as BlogPostRecord[]);
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
    .select('*')
    .in('id', [...candidateIds])
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(3);
  if (error) throw error;
  return hydratePosts((posts || []) as BlogPostRecord[]);
}

export async function listTaxonomyArchive(kind: Exclude<TaxonomyKind, 'blog_authors'>, slug: string, page = 1) {
  const supabase = getSupabase();
  const normalizedPage = normalizePageNumber(page);
  const config = TAXONOMY_CONFIG[kind];
  const { data: term, error: termError } = await supabase.from(config.table).select('*').eq('slug', slug).maybeSingle();
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
    .select('*')
    .in('id', postIds)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .range(range.from, range.to);
  if (error) throw error;
  return {
    term,
    items: await hydratePosts((data || []) as BlogPostRecord[]),
    pagination
  };
}

export async function listAuthorArchive(slug: string, page = 1) {
  const supabase = getSupabase();
  const normalizedPage = normalizePageNumber(page);
  const { data: author, error: authorError } = await supabase.from('blog_authors').select('*').eq('slug', slug).maybeSingle();
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
    .select('*')
    .eq('author_id', author.id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .range(range.from, range.to);
  if (error) throw error;
  return {
    author,
    items: await hydratePosts((data || []) as BlogPostRecord[]),
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
  const { data: posts, error: postsError } = await supabase.from('blog_posts').select('*').in('id', ids);
  if (postsError) throw postsError;
  const hydrated = await hydratePosts((posts || []) as BlogPostRecord[]);
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
