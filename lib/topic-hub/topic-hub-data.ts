import type {
  DiscoveryEntitySubtype,
  DiscoveryHubPage,
  DiscoveryTerm,
  DiscoveryTermType,
  RelatedBlogPostSummary,
  ResolvedPodcastEpisode
} from '@/lib/podcast-shared';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { isApprovedTopicSlug, resolveTaxonomyPublicPath } from '@/lib/taxonomy-route-policy';

type DiscoveryTermRow = {
  id: string;
  term_type: DiscoveryTermType;
  entity_subtype: DiscoveryEntitySubtype;
  name: string;
  slug: string;
  description: string | null;
  intro_json: unknown;
  intro_markdown: string | null;
  hero_image_url: string | null;
  seo_title: string | null;
  meta_description: string | null;
  social_title: string | null;
  social_description: string | null;
  social_image_url: string | null;
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
};

type EpisodeLinkRow = {
  episode_id: string;
};

type EpisodeTermLinkRow = {
  episode_id: string;
  term_id: string;
  sort_order: number;
};

type PodcastEpisodeRow = {
  id: string;
  slug: string;
  title: string;
  description_plain: string | null;
  published_at: string | null;
  audio_url: string;
  artwork_url: string | null;
  transcript: string | null;
  show_notes: string | null;
  source_url: string | null;
  episode_number: number | null;
  season_number: number | null;
  duration_seconds: number | null;
  is_visible: boolean;
  is_archived: boolean;
  last_synced_at: string | null;
  missing_from_feed_at: string | null;
};

type EpisodeEditorialRow = {
  episode_id: string;
  web_title: string | null;
  web_slug: string | null;
  excerpt: string | null;
  hero_image_url: string | null;
  seo_title: string | null;
  meta_description: string | null;
  is_featured: boolean;
  is_visible: boolean;
  is_archived: boolean;
};

type BlogPostLinkRow = {
  blog_post_id: string;
};

type BlogPostSummaryRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  excerpt_auto: string | null;
  published_at: string | null;
  reading_time_minutes: number | null;
  author_id: string | null;
  featured_image_id: string | null;
};

type BlogAuthorSummaryRow = {
  id: string;
  name: string;
  slug: string;
};

type MediaAssetSummaryRow = {
  id: string;
  storage_path: string;
  alt_text_default: string;
};

type ConfiguredTopicHubData = {
  hub: DiscoveryHubPage;
  topicEpisodes: ResolvedPodcastEpisode[];
};

function truncateText(value: string, maxLength: number): string {
  const normalized = `${value || ''}`.trim();
  if (!normalized) return '';
  if (!Number.isFinite(maxLength) || maxLength <= 0 || normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function formatDurationLabel(totalSeconds: number | null): string | null {
  if (!totalSeconds || totalSeconds <= 0) return null;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function mapDiscoveryTerm(row: DiscoveryTermRow): DiscoveryTerm {
  return {
    id: row.id,
    termType: row.term_type,
    entitySubtype: row.entity_subtype || null,
    name: row.name,
    slug: row.slug,
    description: row.description,
    introJson: row.intro_json,
    introMarkdown: row.intro_markdown,
    heroImageUrl: row.hero_image_url,
    seoTitle: row.seo_title,
    metaDescription: row.meta_description,
    socialTitle: row.social_title,
    socialDescription: row.social_description,
    socialImageUrl: row.social_image_url,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    path: resolveTaxonomyPublicPath({
      termType: row.term_type,
      entitySubtype: row.entity_subtype,
      slug: row.slug
    })
  };
}

async function loadRelatedPosts(supabase: ReturnType<typeof createSupabaseAdminClient>, termId: string) {
  const { data: blogLinks, error: blogLinksError } = await supabase
    .from('blog_post_discovery_terms')
    .select('blog_post_id')
    .eq('term_id', termId)
    .order('sort_order', { ascending: true });
  if (blogLinksError) throw blogLinksError;

  const blogIds = [...new Set(((blogLinks || []) as BlogPostLinkRow[]).map((row) => row.blog_post_id))];
  if (!blogIds.length) return [] as RelatedBlogPostSummary[];

  const { data: posts, error: postsError } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, excerpt_auto, published_at, reading_time_minutes, author_id, featured_image_id')
    .in('id', blogIds)
    .is('deleted_at', null)
    .eq('status', 'published')
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(12);
  if (postsError) throw postsError;

  const basePosts = (posts || []) as BlogPostSummaryRow[];
  const authorIds = [...new Set(basePosts.map((row) => row.author_id).filter(Boolean) as string[])];
  const featuredImageIds = [...new Set(basePosts.map((row) => row.featured_image_id).filter(Boolean) as string[])];

  const [authorsResult, mediaResult] = await Promise.all([
    authorIds.length
      ? supabase
          .from('blog_authors')
          .select('id, name, slug')
          .in('id', authorIds)
      : Promise.resolve({ data: [], error: null }),
    featuredImageIds.length
      ? supabase
          .from('media_assets')
          .select('id, storage_path, alt_text_default')
          .in('id', featuredImageIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (authorsResult.error) throw authorsResult.error;
  if (mediaResult.error) throw mediaResult.error;

  const authorMap = new Map<string, BlogAuthorSummaryRow>();
  ((authorsResult.data || []) as BlogAuthorSummaryRow[]).forEach((row) => authorMap.set(row.id, row));

  const mediaMap = new Map<string, MediaAssetSummaryRow>();
  ((mediaResult.data || []) as MediaAssetSummaryRow[]).forEach((row) => mediaMap.set(row.id, row));

  return basePosts.map((row) => {
    const author = row.author_id ? authorMap.get(row.author_id) || null : null;
    const featuredImage = row.featured_image_id ? mediaMap.get(row.featured_image_id) || null : null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt || row.excerpt_auto || null,
      publishedAt: row.published_at,
      readingTimeMinutes: row.reading_time_minutes,
      author: author
        ? {
            name: author.name,
            slug: author.slug
          }
        : null,
      featuredImage: featuredImage
        ? {
            storagePath: featuredImage.storage_path,
            altText: featuredImage.alt_text_default
          }
        : null
    } satisfies RelatedBlogPostSummary;
  });
}

export async function getConfiguredTopicHubData(slug: string): Promise<ConfiguredTopicHubData | null> {
  const normalizedSlug = `${slug || ''}`.trim().toLowerCase();
  if (!normalizedSlug || !isApprovedTopicSlug(normalizedSlug)) return null;

  const supabase = createSupabaseAdminClient();

  const { data: termRowRaw, error: termError } = await supabase
    .from('discovery_terms')
    .select('*')
    .eq('term_type', 'topic')
    .eq('slug', normalizedSlug)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (termError) throw termError;
  if (!termRowRaw) return null;

  const term = mapDiscoveryTerm(termRowRaw as DiscoveryTermRow);

  const [{ data: episodeLinksRaw, error: episodeLinksError }, relatedPosts] = await Promise.all([
    supabase
      .from('episode_discovery_terms')
      .select('episode_id')
      .eq('term_id', term.id)
      .order('sort_order', { ascending: true }),
    loadRelatedPosts(supabase, term.id)
  ]);
  if (episodeLinksError) throw episodeLinksError;

  const episodeIds = [...new Set(((episodeLinksRaw || []) as EpisodeLinkRow[]).map((row) => row.episode_id))];

  let topicEpisodes: ResolvedPodcastEpisode[] = [];
  if (episodeIds.length) {
    const [
      episodesResult,
      editorialResult,
      episodeTermLinksResult
    ] = await Promise.all([
      supabase
        .from('podcast_episodes')
        .select('id, slug, title, description_plain, published_at, audio_url, artwork_url, transcript, show_notes, source_url, episode_number, season_number, duration_seconds, is_visible, is_archived, last_synced_at, missing_from_feed_at')
        .in('id', episodeIds)
        .eq('is_visible', true)
        .eq('is_archived', false)
        .order('published_at', { ascending: false }),
      supabase
        .from('podcast_episode_editorial')
        .select('episode_id, web_title, web_slug, excerpt, hero_image_url, seo_title, meta_description, is_featured, is_visible, is_archived')
        .in('episode_id', episodeIds),
      supabase
        .from('episode_discovery_terms')
        .select('episode_id, term_id, sort_order')
        .in('episode_id', episodeIds)
        .order('sort_order', { ascending: true })
    ]);

    if (episodesResult.error) throw episodesResult.error;
    if (editorialResult.error) throw editorialResult.error;
    if (episodeTermLinksResult.error) throw episodeTermLinksResult.error;

    const episodeRows = (episodesResult.data || []) as PodcastEpisodeRow[];
    const editorialMap = new Map<string, EpisodeEditorialRow>();
    ((editorialResult.data || []) as EpisodeEditorialRow[]).forEach((row) => editorialMap.set(row.episode_id, row));

    const episodeTermLinks = (episodeTermLinksResult.data || []) as EpisodeTermLinkRow[];
    const termIds = [...new Set(episodeTermLinks.map((row) => row.term_id))];
    const { data: termsRaw, error: termsError } = await supabase
      .from('discovery_terms')
      .select('*')
      .in('id', termIds)
      .eq('is_active', true);
    if (termsError) throw termsError;

    const termMap = new Map<string, DiscoveryTerm>();
    ((termsRaw || []) as DiscoveryTermRow[]).forEach((row) => termMap.set(row.id, mapDiscoveryTerm(row)));

    const termsByEpisode = new Map<string, DiscoveryTerm[]>();
    episodeTermLinks.forEach((link) => {
      const mappedTerm = termMap.get(link.term_id);
      if (!mappedTerm) return;
      const list = termsByEpisode.get(link.episode_id) || [];
      list.push(mappedTerm);
      termsByEpisode.set(link.episode_id, list);
    });

    topicEpisodes = episodeRows
      .flatMap((row): ResolvedPodcastEpisode[] => {
        const editorial = editorialMap.get(row.id) || null;
        const isVisible = editorial ? editorial.is_visible : row.is_visible;
        const isArchived = editorial ? editorial.is_archived : row.is_archived;
        if (!isVisible || isArchived) return [];

        const baseDescription = `${editorial?.excerpt || row.description_plain || ''}`.trim();
        const description = truncateText(baseDescription, 220);
        const title = `${editorial?.web_title || row.title}`.trim();
        const episodeSlug = `${editorial?.web_slug || row.slug}`.trim();
        const publishedAt = row.published_at || new Date(0).toISOString();
        const discoveryTerms = termsByEpisode.get(row.id) || [];
        const primaryTopic = discoveryTerms.find((candidate) => candidate.termType === 'topic') || null;

        return [
          {
            id: row.id,
            slug: episodeSlug,
            title,
            primaryTopicName: primaryTopic?.name || null,
            primaryTopicPath: primaryTopic?.path || null,
            primaryTopicSlug: primaryTopic?.slug || null,
            seasonNumber: row.season_number,
            episodeNumber: row.episode_number,
            publishedAt,
            description,
            descriptionHtml: '',
            audioUrl: row.audio_url,
            artworkUrl: editorial?.hero_image_url || row.artwork_url,
            duration: formatDurationLabel(row.duration_seconds),
            sourceUrl: row.source_url,
            excerpt: description,
            bodyHtml: '',
            bodyJson: null,
            bodyMarkdown: null,
            bodySource: 'source',
            transcript: '',
            showNotesHtml: '',
            heroImageUrl: editorial?.hero_image_url || row.artwork_url,
            seoTitle: editorial?.seo_title || title,
            metaDescription: editorial?.meta_description || '',
            canonicalUrl: `/episodes/${episodeSlug}`,
            noindex: false,
            nofollow: false,
            isFeatured: editorial?.is_featured || false,
            isVisible,
            isArchived,
            source: {
              title: row.title,
              slug: row.slug,
              descriptionPlain: `${row.description_plain || ''}`.trim(),
              descriptionHtml: '',
              transcript: '',
              showNotes: '',
              publishedAt,
              audioUrl: row.audio_url,
              artworkUrl: row.artwork_url,
              sourceUrl: row.source_url,
              episodeNumber: row.episode_number,
              seasonNumber: row.season_number,
              durationSeconds: row.duration_seconds,
              lastSyncedAt: row.last_synced_at,
              missingFromFeedAt: row.missing_from_feed_at
            },
            editorial: null,
            discoveryTerms,
            primaryTopic,
            relatedEpisodes: [],
            relatedPosts: []
          }
        ];
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  return {
    hub: {
      term,
      featuredEpisodes: [],
      latestEpisodes: [],
      relatedPosts,
      relatedTerms: [],
      pagination: {
        page: 1,
        pageSize: topicEpisodes.length,
        total: topicEpisodes.length,
        totalPages: 1
      }
    },
    topicEpisodes
  };
}
