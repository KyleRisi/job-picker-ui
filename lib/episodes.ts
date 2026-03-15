import { XMLParser } from 'fast-xml-parser';
import { unstable_cache } from 'next/cache';
import { marked } from 'marked';
import { normalizePath } from '@/lib/redirects';
import { isApprovedCollectionSlug, isApprovedTopicSlug, resolveTaxonomyPublicPath } from '@/lib/taxonomy-route-policy';
import {
  formatEpisodeDate,
  type BreadcrumbItem,
  type DiscoveryHubPage,
  type DiscoveryTerm,
  type DiscoveryTermType,
  type EpisodeEditorialSnapshot,
  type EpisodeRelationshipSummary,
  type EpisodeSlugRedirect,
  type EpisodeSourceSnapshot,
  type PodcastEpisode,
  type RelatedBlogPostSummary,
  type ResolvedPodcastEpisode
} from './podcast-shared';
import { blogDocumentToMarkdown, normalizeBlogDocument } from './blog/content';

const DEFAULT_PODCAST_RSS_FEED_URL = 'https://feeds.simplecast.com/Sci7Fqgp';
const FEED_ACCEPT_HEADER = 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1';
const DEFAULT_LIST_DESCRIPTION_MAX_LENGTH = 520;
const PODCAST_FEED_REVALIDATE_SECONDS = 900;
const HUB_PAGE_SIZE = 12;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true
});

type GetPodcastEpisodesOptions = {
  includeDescriptionHtml?: boolean;
  descriptionMaxLength?: number | null;
  limit?: number | null;
};

type GetPodcastEpisodeBySlugOptions = Omit<GetPodcastEpisodesOptions, 'limit'>;

type ParsedFeed = {
  rss?: {
    channel?: {
      item?: unknown;
      image?: { url?: string };
      'itunes:image'?: { href?: string } | string;
    };
  };
};

type CachedPodcastEpisode = Omit<PodcastEpisode, 'description' | 'descriptionHtml'> & {
  fullDescription: string;
  descriptionSource: string;
};

type PodcastEpisodeRow = {
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
  episode_number: number | null;
  season_number: number | null;
  duration_seconds: number | null;
  source_url: string | null;
  missing_from_feed_at: string | null;
};

type PodcastEpisodeEditorialRow = {
  id: string;
  episode_id: string;
  author_id: string | null;
  web_title: string | null;
  web_slug: string | null;
  excerpt: string | null;
  body_json: unknown;
  body_markdown: string | null;
  hero_image_url: string | null;
  hero_image_storage_path: string | null;
  seo_title: string | null;
  meta_description: string | null;
  canonical_url_override: string | null;
  social_title: string | null;
  social_description: string | null;
  social_image_url: string | null;
  noindex: boolean;
  nofollow: boolean;
  is_featured: boolean;
  is_visible: boolean;
  is_archived: boolean;
  editorial_notes: string | null;
  created_at: string;
  updated_at: string;
};

type DiscoveryTermRow = {
  id: string;
  term_type: DiscoveryTermType;
  entity_subtype: DiscoveryTerm['entitySubtype'];
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
  created_at: string;
  updated_at: string;
};

type EpisodeDiscoveryTermRow = {
  episode_id: string;
  term_id: string;
  is_primary: boolean;
  sort_order: number;
};

type EpisodeRelationshipRow = {
  id: string;
  source_episode_id: string;
  target_episode_id: string;
  relationship_type: EpisodeRelationshipSummary['relationshipType'];
  sort_order: number;
};

type EpisodeRelatedPostRow = {
  episode_id: string;
  blog_post_id: string;
  sort_order: number;
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

type SupabaseAdminClient = Awaited<ReturnType<typeof getSupabaseAdmin>>;

function isMissingRelationError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'PGRST205');
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function getNodeText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${value}`.trim();
  }
  if (typeof value === 'object') {
    const maybeText = (value as { '#text'?: unknown })['#text'];
    if (maybeText != null) return `${maybeText}`.trim();
  }
  return '';
}

function decodeHtmlEntities(input: string): string {
  if (!input) return '';

  const namedEntities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  };

  return input
    .replace(/&#(\d+);/g, (_m, dec) => {
      const codePoint = Number.parseInt(dec, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _m;
    })
    .replace(/&#x([\da-fA-F]+);/g, (_m, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _m;
    })
    .replace(/&([a-zA-Z]+);/g, (m, entity) => namedEntities[entity] ?? m);
}

function htmlToPlainText(html: string): string {
  const withLineBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n\n')
    .replace(/<\s*\/\s*li\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '• ');

  const noTags = withLineBreaks
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');

  return decodeHtmlEntities(noTags)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function toSafeHtml(html: string): string {
  const normalized = `${html || ''}`.trim();
  if (!normalized) return '';

  // Some feed content arrives double-encoded (for example "&amp;nbsp;").
  const decodedOnce = decodeHtmlEntities(normalized);
  const decoded = /&(?:[a-zA-Z]+|#\d+|#x[\da-fA-F]+);/.test(decodedOnce)
    ? decodeHtmlEntities(decodedOnce)
    : decodedOnce;

  const hasHtmlTags = /<[^>]+>/.test(decoded);
  const htmlContent = hasHtmlTags
    ? decoded
    : decoded
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
        .join('');

  const sanitized = htmlContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '')
    .replace(/<a\s/gi, '<a target="_blank" rel="noreferrer" ')
    .trim();

  // Convert markdown-style emphasis that may be embedded in feed HTML text nodes.
  return sanitized
    .split(/(<[^>]+>)/g)
    .map((chunk) => {
      if (!chunk || chunk.startsWith('<')) return chunk;
      return chunk
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
        .replace(/\*\*/g, '')
        .replace(/__/g, '');
    })
    .join('');
}

function truncateText(value: string, maxLength: number | null | undefined): string {
  if (!value) return '';
  if (typeof maxLength !== 'number' || !Number.isFinite(maxLength) || maxLength <= 0) return value;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function toSafeNumber(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function resolveEpisodeNumber(item: Record<string, unknown>, title: string): number | null {
  const fromTag = toSafeNumber(getNodeText(item['itunes:episode']));
  if (fromTag !== null) return fromTag;

  const match = title.match(/\b(?:episode|ep)\s*#?\s*(\d+)\b/i);
  if (!match?.[1]) return null;

  return toSafeNumber(match[1]);
}

function resolveSeasonNumber(item: Record<string, unknown>, title: string): number | null {
  const fromTag = toSafeNumber(getNodeText(item['itunes:season']));
  if (fromTag !== null) return fromTag;

  const titlesToCheck = [title, getNodeText(item['itunes:title'])].filter(Boolean);
  const titleMatch = titlesToCheck.join(' ').match(/\bseason\s*#?\s*(\d+)\b/i);
  if (titleMatch?.[1]) return toSafeNumber(titleMatch[1]);

  const categories = toArray(item.category as unknown).map((value) => getNodeText(value)).join(' ');
  const categoryMatch = categories.match(/\bseason\s*#?\s*(\d+)\b/i);
  if (categoryMatch?.[1]) return toSafeNumber(categoryMatch[1]);

  return null;
}

function resolveDurationSeconds(item: Record<string, unknown>): number | null {
  const raw = getNodeText(item['itunes:duration']);
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  const parts = raw.split(':').map((part) => Number.parseInt(part, 10)).filter((part) => Number.isFinite(part));
  if (!parts.length) return null;
  if (parts.length === 3) return (parts[0] * 60 * 60) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return parts[0] || null;
}

function toIsoDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
  return parsed.toISOString();
}

export function slugifyEpisodeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function stableToken(source: string): string {
  const compact = source.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return compact.slice(0, 10) || 'episode';
}

function resolveSlug(
  title: string,
  episodeNumber: number | null,
  uniqueSource: string,
  used: Set<string>
): string {
  const numberPrefix = episodeNumber !== null ? `episode-${episodeNumber}` : '';
  const titlePart = slugifyEpisodeText(title);
  const base = [numberPrefix, titlePart].filter(Boolean).join('-') || `episode-${stableToken(uniqueSource)}`;

  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  const withToken = `${base}-${stableToken(uniqueSource)}`;
  if (!used.has(withToken)) {
    used.add(withToken);
    return withToken;
  }

  let candidate = withToken;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${withToken}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function resolveArtworkUrl(item: Record<string, unknown>, fallback: string | null): string | null {
  const itunesImageNode = item['itunes:image'];
  if (itunesImageNode && typeof itunesImageNode === 'object') {
    const href = getNodeText((itunesImageNode as { href?: unknown }).href);
    if (href) return href;
  }

  const mediaContent = item['media:content'];
  if (mediaContent && typeof mediaContent === 'object') {
    const url = getNodeText((mediaContent as { url?: unknown }).url);
    if (url) return url;
  }

  return fallback;
}

function resolveChannelArtwork(feed: ParsedFeed): string | null {
  const channel = feed.rss?.channel;
  if (!channel) return null;

  const fromItunes = channel['itunes:image'];
  if (fromItunes && typeof fromItunes === 'object') {
    const href = getNodeText((fromItunes as { href?: unknown }).href);
    if (href) return href;
  }

  if (typeof fromItunes === 'string' && fromItunes.trim()) return fromItunes.trim();

  const fromStandard = getNodeText(channel.image?.url);
  return fromStandard || null;
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

function getResolvedExcerpt(sourceText: string, editorialExcerpt: string | null, maxLength: number | null | undefined): string {
  const base = `${editorialExcerpt || ''}`.trim() || sourceText.trim();
  return truncateText(base, maxLength);
}

function toMetaDescription(value: string): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Read full details for this podcast episode.';
  return normalized.length > 155 ? `${normalized.slice(0, 152).trimEnd()}...` : normalized;
}

function resolveTermPath(term: Pick<DiscoveryTermRow, 'term_type' | 'entity_subtype' | 'slug'>): string | null {
  return resolveTaxonomyPublicPath({
    termType: term.term_type,
    entitySubtype: term.entity_subtype,
    slug: term.slug
  });
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
    path: resolveTermPath(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEditorial(row: PodcastEpisodeEditorialRow | null | undefined): EpisodeEditorialSnapshot | null {
  if (!row) return null;
  return {
    id: row.id,
    authorId: row.author_id,
    webTitle: row.web_title,
    webSlug: row.web_slug,
    excerpt: row.excerpt,
    bodyJson: row.body_json,
    bodyMarkdown: row.body_markdown,
    heroImageUrl: row.hero_image_url,
    heroImageStoragePath: row.hero_image_storage_path,
    seoTitle: row.seo_title,
    metaDescription: row.meta_description,
    canonicalUrlOverride: row.canonical_url_override,
    socialTitle: row.social_title,
    socialDescription: row.social_description,
    socialImageUrl: row.social_image_url,
    noindex: row.noindex,
    nofollow: row.nofollow,
    isFeatured: row.is_featured,
    isVisible: row.is_visible,
    isArchived: row.is_archived,
    editorialNotes: row.editorial_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSource(row: PodcastEpisodeRow): EpisodeSourceSnapshot {
  return {
    title: row.title,
    slug: row.slug,
    descriptionPlain: row.description_plain || '',
    descriptionHtml: row.description_html || '',
    transcript: row.transcript || '',
    showNotes: row.show_notes || '',
    publishedAt: row.published_at || new Date(0).toISOString(),
    audioUrl: row.audio_url,
    artworkUrl: row.artwork_url,
    sourceUrl: row.source_url,
    episodeNumber: row.episode_number,
    seasonNumber: row.season_number,
    durationSeconds: row.duration_seconds,
    lastSyncedAt: row.last_synced_at,
    missingFromFeedAt: row.missing_from_feed_at
  };
}

function looksLikeSourceHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function pickPreferredEpisodeSourceHtml(row: PodcastEpisodeRow) {
  const descriptionHtml = `${row.description_html || ''}`.trim();
  const showNotes = `${row.show_notes || ''}`.trim();
  const descriptionPlain = `${row.description_plain || ''}`.trim();

  if (descriptionHtml && looksLikeSourceHtml(descriptionHtml)) return descriptionHtml;
  if (showNotes && looksLikeSourceHtml(showNotes)) return showNotes;
  return descriptionHtml || showNotes || descriptionPlain || '';
}

function resolveBody(row: PodcastEpisodeRow, editorial: PodcastEpisodeEditorialRow | null | undefined) {
  const bodyJson = Array.isArray(editorial?.body_json) ? normalizeBlogDocument(editorial?.body_json) : null;
  const bodyJsonMarkdown = bodyJson ? (blogDocumentToMarkdown(bodyJson) || '').trim() : '';
  if (bodyJson && bodyJson.length > 0 && bodyJsonMarkdown) {
    const effectiveBodyMarkdown = editorial?.body_markdown || bodyJsonMarkdown;
    return {
      bodyJson,
      bodyMarkdown: effectiveBodyMarkdown,
      bodyHtml: toSafeHtml(marked.parse(effectiveBodyMarkdown) as string),
      bodySource: 'editorial' as const
    };
  }

  if (editorial?.body_markdown?.trim()) {
    return {
      bodyJson: null,
      bodyMarkdown: editorial.body_markdown,
      bodyHtml: toSafeHtml(marked.parse(editorial.body_markdown) as string),
      bodySource: 'editorial' as const
    };
  }

  const sourceHtml = pickPreferredEpisodeSourceHtml(row);
  return {
    bodyJson: null,
    bodyMarkdown: null,
    bodyHtml: toSafeHtml(sourceHtml),
    bodySource: 'source' as const
  };
}

async function getSupabaseAdmin() {
  const { createSupabaseAdminClient } = await import('./supabase');
  return createSupabaseAdminClient();
}

async function fetchAndParsePodcastFeed(): Promise<CachedPodcastEpisode[]> {
  const feedUrl = getPodcastFeedUrl();
  const response = await fetch(feedUrl, {
    headers: {
      Accept: FEED_ACCEPT_HEADER
    },
    next: {
      revalidate: PODCAST_FEED_REVALIDATE_SECONDS
    }
  });

  if (!response.ok) {
    throw new Error(`Podcast feed request failed with status ${response.status}`);
  }

  const xml = await response.text();
  const parsedFeed = xmlParser.parse(xml) as ParsedFeed;
  const items = toArray(parsedFeed.rss?.channel?.item).filter(
    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
  );
  const channelArtwork = resolveChannelArtwork(parsedFeed);
  const usedSlugs = new Set<string>();

  const episodes = items
    .map((item) => {
      const title = getNodeText(item.title) || getNodeText(item['itunes:title']) || 'Untitled Episode';
      const pubDate = toIsoDate(getNodeText(item.pubDate));
      const descriptionSource =
        getNodeText(item['content:encoded']) ||
        getNodeText(item.description) ||
        getNodeText(item['itunes:summary']) ||
        getNodeText(item['itunes:subtitle']);
      const fullDescription = htmlToPlainText(descriptionSource);
      const enclosure = item.enclosure && typeof item.enclosure === 'object' ? (item.enclosure as { url?: unknown }) : null;
      const audioUrl = getNodeText(enclosure?.url);
      const guid = getNodeText(item.guid);
      const sourceUrl = getNodeText(item.link) || null;
      const seasonNumber = resolveSeasonNumber(item, title);
      const episodeNumber = resolveEpisodeNumber(item, title);
      const duration = formatDurationLabel(resolveDurationSeconds(item));

      const uniqueSource = guid || audioUrl || sourceUrl || `${title}-${pubDate}`;
      const slug = resolveSlug(title, episodeNumber, uniqueSource, usedSlugs);

      return {
        id: uniqueSource,
        slug,
        title,
        seasonNumber,
        episodeNumber,
        publishedAt: pubDate,
        fullDescription,
        descriptionSource,
        audioUrl,
        artworkUrl: resolveArtworkUrl(item, channelArtwork),
        duration,
        sourceUrl
      } satisfies CachedPodcastEpisode;
    })
    .filter((episode) => Boolean(episode.audioUrl));

  episodes.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return episodes;
}

const getCachedParsedPodcastFeed = unstable_cache(fetchAndParsePodcastFeed, ['podcast-feed-v2'], {
  revalidate: PODCAST_FEED_REVALIDATE_SECONDS
});

export function getPodcastFeedUrl(): string {
  return process.env.PODCAST_RSS_FEED_URL || DEFAULT_PODCAST_RSS_FEED_URL;
}

async function loadDiscoveryTermsForEpisodes(supabase: SupabaseAdminClient, episodeIds: string[]) {
  if (!episodeIds.length) return new Map<string, DiscoveryTerm[]>();
  const { data: links, error: linksError } = await supabase
    .from('episode_discovery_terms')
    .select('episode_id, term_id, is_primary, sort_order')
    .in('episode_id', episodeIds)
    .order('sort_order', { ascending: true });
  if (linksError) {
    if (isMissingRelationError(linksError)) return new Map();
    throw linksError;
  }

  const termIds = [...new Set((links || []).map((row) => row.term_id))];
  const termsMap = new Map<string, DiscoveryTerm>();
  if (termIds.length) {
    const { data: terms, error: termsError } = await supabase
      .from('discovery_terms')
      .select('*')
      .in('id', termIds)
      .eq('is_active', true);
    if (termsError) {
      if (isMissingRelationError(termsError)) return new Map();
      throw termsError;
    }
    (terms || []).forEach((row) => {
      termsMap.set(row.id, mapDiscoveryTerm(row as DiscoveryTermRow));
    });
  }

  const map = new Map<string, DiscoveryTerm[]>();
  ((links || []) as EpisodeDiscoveryTermRow[]).forEach((link) => {
    const term = termsMap.get(link.term_id);
    if (!term) return;
    const list = map.get(link.episode_id) || [];
    list.push(term);
    map.set(link.episode_id, list);
  });
  return map;
}

async function loadRelatedEpisodesForSources(
  supabase: SupabaseAdminClient,
  sourceEpisodeIds: string[]
): Promise<Map<string, EpisodeRelationshipRow[]>> {
  if (!sourceEpisodeIds.length) return new Map();
  const { data, error } = await supabase
    .from('episode_relationships')
    .select('id, source_episode_id, target_episode_id, relationship_type, sort_order')
    .in('source_episode_id', sourceEpisodeIds)
    .order('sort_order', { ascending: true });
  if (error) {
    if (isMissingRelationError(error)) return new Map();
    throw error;
  }
  const map = new Map<string, EpisodeRelationshipRow[]>();
  ((data || []) as EpisodeRelationshipRow[]).forEach((row) => {
    const list = map.get(row.source_episode_id) || [];
    list.push(row);
    map.set(row.source_episode_id, list);
  });
  return map;
}

async function loadRelatedPostsForEpisodes(
  supabase: SupabaseAdminClient,
  episodeIds: string[]
): Promise<Map<string, RelatedBlogPostSummary[]>> {
  if (!episodeIds.length) return new Map();
  const { data: links, error: linksError } = await supabase
    .from('episode_related_posts')
    .select('episode_id, blog_post_id, sort_order')
    .in('episode_id', episodeIds)
    .order('sort_order', { ascending: true });
  if (linksError) {
    if (isMissingRelationError(linksError)) return new Map();
    throw linksError;
  }

  const postIds = [...new Set((links || []).map((row) => row.blog_post_id))];
  const postMap = new Map<string, RelatedBlogPostSummary>();
  if (postIds.length) {
    const { data: posts, error: postsError } = await supabase
      .from('blog_posts')
      .select('id, slug, title, excerpt, excerpt_auto, published_at, reading_time_minutes, author_id, featured_image_id')
      .in('id', postIds)
      .is('deleted_at', null)
      .eq('status', 'published');
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
    ((authorsResult.data || []) as BlogAuthorSummaryRow[]).forEach((row) => {
      authorMap.set(row.id, row);
    });

    const mediaMap = new Map<string, MediaAssetSummaryRow>();
    ((mediaResult.data || []) as MediaAssetSummaryRow[]).forEach((row) => {
      mediaMap.set(row.id, row);
    });

    basePosts.forEach((row) => {
      const author = row.author_id ? authorMap.get(row.author_id) || null : null;
      const featuredImage = row.featured_image_id ? mediaMap.get(row.featured_image_id) || null : null;
      postMap.set(row.id, {
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
      });
    });
  }

  const map = new Map<string, RelatedBlogPostSummary[]>();
  ((links || []) as EpisodeRelatedPostRow[]).forEach((row) => {
    const post = postMap.get(row.blog_post_id);
    if (!post) return;
    const list = map.get(row.episode_id) || [];
    list.push(post);
    map.set(row.episode_id, list);
  });
  return map;
}

async function loadEditorialRows(supabase: SupabaseAdminClient, episodeIds: string[]) {
  if (!episodeIds.length) return new Map<string, PodcastEpisodeEditorialRow>();
  const { data, error } = await supabase
    .from('podcast_episode_editorial')
    .select('*')
    .in('episode_id', episodeIds);
  if (error) {
    if (isMissingRelationError(error)) return new Map();
    throw error;
  }
  return new Map(((data || []) as PodcastEpisodeEditorialRow[]).map((row) => [row.episode_id, row]));
}

function episodeBaseFromResolved(episode: ResolvedPodcastEpisode): PodcastEpisode {
  return {
    id: episode.id,
    slug: episode.slug,
    title: episode.title,
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
    publishedAt: episode.publishedAt,
    description: episode.description,
    descriptionHtml: episode.descriptionHtml,
    audioUrl: episode.audioUrl,
    artworkUrl: episode.artworkUrl,
    duration: episode.duration,
    sourceUrl: episode.sourceUrl
  };
}

async function resolveEpisodesFromRows(
  rows: PodcastEpisodeRow[],
  options?: {
    includeHidden?: boolean;
    descriptionMaxLength?: number | null;
  }
): Promise<ResolvedPodcastEpisode[]> {
  if (!rows.length) return [];
  const supabase = await getSupabaseAdmin();
  const episodeIds = rows.map((row) => row.id);
  const [editorialMap, discoveryTermsMap, relationshipsMap, relatedPostsMap] = await Promise.all([
    loadEditorialRows(supabase, episodeIds),
    loadDiscoveryTermsForEpisodes(supabase, episodeIds),
    loadRelatedEpisodesForSources(supabase, episodeIds),
    loadRelatedPostsForEpisodes(supabase, episodeIds)
  ]);

  const targetEpisodeIds = [...new Set(
    [...relationshipsMap.values()].flatMap((rowsForSource) => rowsForSource.map((row) => row.target_episode_id))
  )];
  const targetEpisodesMap = new Map<string, PodcastEpisode>();
  if (targetEpisodeIds.length) {
    const { data: targetRows, error: targetRowsError } = await supabase
      .from('podcast_episodes')
      .select('*')
      .in('id', targetEpisodeIds);
    if (targetRowsError) throw targetRowsError;
    const targetEditorialMap = await loadEditorialRows(supabase, targetEpisodeIds);
    ((targetRows || []) as PodcastEpisodeRow[]).forEach((row) => {
      const editorial = targetEditorialMap.get(row.id);
      const source = mapSource(row);
      targetEpisodesMap.set(row.id, {
        id: row.id,
        slug: `${editorial?.web_slug || row.slug}`.trim(),
        title: `${editorial?.web_title || row.title}`.trim(),
        seasonNumber: row.season_number,
        episodeNumber: row.episode_number,
        publishedAt: source.publishedAt,
        description: truncateText(editorial?.excerpt || row.description_plain || '', 220),
        descriptionHtml: toSafeHtml(row.description_html || row.show_notes || ''),
        audioUrl: row.audio_url,
        artworkUrl: editorial?.hero_image_url || row.artwork_url,
        duration: formatDurationLabel(row.duration_seconds),
        sourceUrl: row.source_url
      });
    });
  }

  const resolved = rows
    .map((row) => {
      const editorial = editorialMap.get(row.id) || null;
      const source = mapSource(row);
      const discoveryTerms: DiscoveryTerm[] = discoveryTermsMap.get(row.id) || [];
      const primaryTopic = discoveryTerms.find((term) => term.termType === 'topic') || null;
      const body = resolveBody(row, editorial);
      const excerpt = getResolvedExcerpt(source.descriptionPlain, editorial?.excerpt || null, options?.descriptionMaxLength ?? DEFAULT_LIST_DESCRIPTION_MAX_LENGTH);
      const slug = `${editorial?.web_slug || row.slug}`.trim();
      const title = `${editorial?.web_title || row.title}`.trim();
      const isVisible = editorial ? editorial.is_visible : row.is_visible;
      const isArchived = editorial ? editorial.is_archived : row.is_archived;
      const relationships = (relationshipsMap.get(row.id) || [])
        .map((relation) => {
          const episode = targetEpisodesMap.get(relation.target_episode_id);
          if (!episode) return null;
          return {
            id: relation.id,
            relationshipType: relation.relationship_type,
            sortOrder: relation.sort_order,
            episode
          } satisfies EpisodeRelationshipSummary;
        })
        .filter(Boolean) as EpisodeRelationshipSummary[];

      return {
        id: row.id,
        slug,
        title,
        seasonNumber: row.season_number,
        episodeNumber: row.episode_number,
        publishedAt: source.publishedAt,
        description: excerpt,
        descriptionHtml: toSafeHtml(source.descriptionHtml),
        audioUrl: row.audio_url,
        artworkUrl: editorial?.hero_image_url || row.artwork_url,
        duration: formatDurationLabel(row.duration_seconds),
        sourceUrl: row.source_url,
        excerpt,
        bodyHtml: body.bodyHtml,
        bodyJson: body.bodyJson,
        bodyMarkdown: body.bodyMarkdown,
        bodySource: body.bodySource,
        transcript: row.transcript || '',
        showNotesHtml: toSafeHtml(row.show_notes || ''),
        heroImageUrl: editorial?.hero_image_url || row.artwork_url,
        seoTitle: editorial?.seo_title || title,
        metaDescription: editorial?.meta_description || '',
        canonicalUrl: editorial?.canonical_url_override || `/episodes/${slug}`,
        noindex: editorial?.noindex || false,
        nofollow: editorial?.nofollow || false,
        isFeatured: editorial?.is_featured || false,
        isVisible,
        isArchived,
        source,
        editorial: mapEditorial(editorial),
        discoveryTerms,
        primaryTopic,
        relatedEpisodes: relationships,
        relatedPosts: relatedPostsMap.get(row.id) || []
      } satisfies ResolvedPodcastEpisode;
    })
    .filter((episode) => options?.includeHidden ? true : episode.isVisible && !episode.isArchived)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return resolved;
}

async function queryEpisodeRows(params?: {
  ids?: string[];
  q?: string;
  limit?: number;
}): Promise<PodcastEpisodeRow[]> {
  const supabase = await getSupabaseAdmin();
  let query = supabase.from('podcast_episodes').select('*').order('published_at', { ascending: false });
  if (params?.ids?.length) query = query.in('id', params.ids);
  if (params?.q?.trim()) {
    const q = params.q.trim().replace(/[%_"]/g, '');
    query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%,description_plain.ilike.%${q}%`);
  }
  if (params?.limit && params.limit > 0) query = query.limit(params.limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PodcastEpisodeRow[];
}

async function getPodcastEpisodesFromDatabase(
  options: GetPodcastEpisodesOptions = {}
): Promise<PodcastEpisode[] | null> {
  try {
    const resolved = await getResolvedEpisodes({
      includeHidden: false,
      limit: options.limit ?? null,
      descriptionMaxLength: options.descriptionMaxLength ?? DEFAULT_LIST_DESCRIPTION_MAX_LENGTH
    });
    if (!resolved.length) return null;
    return resolved.map(episodeBaseFromResolved);
  } catch {
    return null;
  }
}

export async function getResolvedEpisodes(options?: {
  includeHidden?: boolean;
  limit?: number | null;
  descriptionMaxLength?: number | null;
  q?: string;
  ids?: string[];
}): Promise<ResolvedPodcastEpisode[]> {
  const rows = await queryEpisodeRows({
    ids: options?.ids,
    q: options?.q,
    limit: options?.limit ?? undefined
  });
  return resolveEpisodesFromRows(rows, {
    includeHidden: options?.includeHidden,
    descriptionMaxLength: options?.descriptionMaxLength
  });
}

export async function getResolvedEpisodeById(id: string, options?: { includeHidden?: boolean }) {
  const rows = await queryEpisodeRows({ ids: [id], limit: 1 });
  const items = await resolveEpisodesFromRows(rows, { includeHidden: options?.includeHidden, descriptionMaxLength: null });
  return items[0] || null;
}

export async function resolveEpisodeSlugRedirect(slug: string): Promise<EpisodeSlugRedirect | null> {
  const normalizedSlug = slugifyEpisodeText(slug);
  if (!normalizedSlug) return null;
  const supabase = await getSupabaseAdmin();
  const sourcePath = normalizePath(`/episodes/${normalizedSlug}`);
  const { data, error } = await supabase.rpc('resolve_redirect', { p_path: sourcePath });
  if (error) {
    console.error('[episode redirect] failed to resolve old slug:', error);
    return null;
  }

  const row = ((data || [])[0] || null) as
    | {
        source_path: string;
        target_url: string;
        match_type: 'exact' | 'prefix';
      }
    | null;
  if (!row || row.match_type !== 'exact') return null;
  const targetPath = normalizePath(row.target_url || '');
  if (!targetPath.startsWith('/episodes/')) return null;
  if (targetPath === sourcePath) return null;
  return {
    currentSlug: targetPath.replace(/^\/episodes\//, ''),
    sourcePath,
    targetPath
  };
}

export async function getResolvedEpisodeBySlug(slug: string, options?: { includeHidden?: boolean }) {
  const normalizedSlug = slugifyEpisodeText(slug);
  if (!normalizedSlug) return null;
  const supabase = await getSupabaseAdmin();

  try {
    const { data: editorialMatch, error: editorialError } = await supabase
      .from('podcast_episode_editorial')
      .select('episode_id')
      .ilike('web_slug', normalizedSlug)
      .limit(1)
      .maybeSingle();
    if (editorialError) throw editorialError;

    if (editorialMatch?.episode_id) {
      return getResolvedEpisodeById(editorialMatch.episode_id, options);
    }
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  const { data: sourceMatch, error: sourceError } = await supabase
    .from('podcast_episodes')
    .select('id')
    .ilike('slug', normalizedSlug)
    .limit(1)
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!sourceMatch?.id) return null;
  return getResolvedEpisodeById(sourceMatch.id, options);
}

async function getFallbackEpisodes(options: GetPodcastEpisodesOptions = {}): Promise<PodcastEpisode[]> {
  const {
    includeDescriptionHtml = false,
    descriptionMaxLength = DEFAULT_LIST_DESCRIPTION_MAX_LENGTH,
    limit = null
  } = options;
  const cachedEpisodes = await getCachedParsedPodcastFeed();

  const episodes = cachedEpisodes.map((episode) => ({
    id: episode.id,
    slug: episode.slug,
    title: episode.title,
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
    publishedAt: episode.publishedAt,
    description: truncateText(episode.fullDescription, descriptionMaxLength),
    descriptionHtml: includeDescriptionHtml ? toSafeHtml(episode.descriptionSource) : '',
    audioUrl: episode.audioUrl,
    artworkUrl: episode.artworkUrl,
    duration: episode.duration,
    sourceUrl: episode.sourceUrl
  }));

  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    return episodes.slice(0, limit);
  }

  return episodes;
}

export async function getPodcastEpisodes(options: GetPodcastEpisodesOptions = {}): Promise<PodcastEpisode[]> {
  const databaseEpisodes = await getPodcastEpisodesFromDatabase(options);
  if (databaseEpisodes) return databaseEpisodes;
  return getFallbackEpisodes(options);
}

export async function getPodcastEpisodeBySlug(
  slug: string,
  options: GetPodcastEpisodeBySlugOptions = {
    includeDescriptionHtml: true,
    descriptionMaxLength: null
  }
): Promise<PodcastEpisode | null> {
  const normalizedSlug = slugifyEpisodeText(slug);
  if (!normalizedSlug) return null;

  try {
    const resolved = await getResolvedEpisodeBySlug(normalizedSlug, { includeHidden: false });
    if (resolved) return episodeBaseFromResolved(resolved);
  } catch {
    // Emergency fallback only.
  }

  const episodes = await getFallbackEpisodes({
    includeDescriptionHtml: options.includeDescriptionHtml ?? true,
    descriptionMaxLength: options.descriptionMaxLength ?? null
  });
  return episodes.find((episode) => episode.slug === normalizedSlug) ?? null;
}

export async function listActiveDiscoveryTerms() {
  try {
    const supabase = await getSupabaseAdmin();
    const { data, error } = await supabase
      .from('discovery_terms')
      .select('*')
      .eq('is_active', true)
      .order('term_type', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return ((data || []) as DiscoveryTermRow[]).map(mapDiscoveryTerm);
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

export type EpisodeLandingRail = {
  key: string;
  title: string;
  href: string;
  episodes: ResolvedPodcastEpisode[];
};

const EPISODE_LANDING_TAXONOMY_RAILS: Array<{
  key: string;
  title: string;
  termType: DiscoveryTermType;
  slug: string;
}> = [
  { key: 'true-crime', title: 'True Crime', termType: 'topic', slug: 'true-crime' },
  { key: 'history', title: 'History', termType: 'topic', slug: 'history' },
  { key: 'incredible-people', title: 'Incredible People', termType: 'topic', slug: 'incredible-people' },
  { key: 'scandals', title: 'Scandals', termType: 'theme', slug: 'scandals' }
];

async function getEpisodesLandingPageDataUncached() {
  const [resolvedEpisodes, activeTerms] = await Promise.all([
    getResolvedEpisodes({ descriptionMaxLength: 520 }),
    listActiveDiscoveryTerms()
  ]);

  const featuredEpisode = resolvedEpisodes[0] || null;
  const recentEpisodes = resolvedEpisodes.slice(0, 8);

  const rails: EpisodeLandingRail[] = [];

  if (recentEpisodes.length) {
    rails.push({
      key: 'recent',
      title: 'Recent Episodes',
      href: '#catalogue',
      episodes: recentEpisodes
    });
  }

  for (const config of EPISODE_LANDING_TAXONOMY_RAILS) {
    const term = activeTerms.find((candidate) => candidate.termType === config.termType && candidate.slug === config.slug);
    if (!term?.path) continue;

    const railEpisodes = resolvedEpisodes
      .filter((episode) => episode.discoveryTerms.some((candidate) => candidate.id === term.id))
      .slice(0, 8);

    if (!railEpisodes.length) continue;

    rails.push({
      key: config.key,
      title: config.title,
      href: term.path,
      episodes: railEpisodes
    });
  }

  return {
    episodes: resolvedEpisodes.map(episodeBaseFromResolved),
    featuredEpisode: featuredEpisode ? episodeBaseFromResolved(featuredEpisode) : null,
    rails: rails.map((rail) => ({
      ...rail,
      episodes: rail.episodes.map(episodeBaseFromResolved)
    }))
  };
}

const getCachedEpisodesLandingPageData = unstable_cache(getEpisodesLandingPageDataUncached, ['episodes-landing-v1'], {
  revalidate: 300,
  tags: ['episodes', 'discovery-terms']
});

export async function getEpisodesLandingPageData() {
  return getCachedEpisodesLandingPageData();
}

function getDiscoveryTermRouteFilter(routeKey: string): { termType: DiscoveryTermType; entitySubtype?: DiscoveryTerm['entitySubtype'] } | null {
  if (routeKey === 'topics') return { termType: 'topic' };
  if (routeKey === 'themes') return { termType: 'theme' };
  if (routeKey === 'people') return { termType: 'entity', entitySubtype: 'person' };
  if (routeKey === 'cases') return { termType: 'case' };
  if (routeKey === 'events') return { termType: 'event' };
  if (routeKey === 'collections') return { termType: 'collection' };
  if (routeKey === 'series') return { termType: 'series' };
  return null;
}

async function getDiscoveryHubPageUncached(routeKey: string, slug: string, page = 1): Promise<DiscoveryHubPage | null> {
  const filter = getDiscoveryTermRouteFilter(routeKey);
  if (!filter) return null;
  const normalizedSlug = slugifyEpisodeText(slug);
  if (routeKey === 'topics' && !isApprovedTopicSlug(normalizedSlug)) return null;
  if (routeKey === 'collections' && !isApprovedCollectionSlug(normalizedSlug)) return null;

  const supabase = await getSupabaseAdmin();
  let termRow: DiscoveryTermRow | null = null;
  try {
    let termQuery = supabase
      .from('discovery_terms')
      .select('*')
      .eq('term_type', filter.termType)
      .eq('slug', normalizedSlug)
      .eq('is_active', true)
      .limit(1);
    if (filter.entitySubtype) termQuery = termQuery.eq('entity_subtype', filter.entitySubtype);
    const { data, error } = await termQuery.maybeSingle();
    if (error) throw error;
    termRow = (data as DiscoveryTermRow | null) || null;
  } catch (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
  if (!termRow) return null;
  const term = mapDiscoveryTerm(termRow);

  const [{ data: episodeLinks, error: episodeLinksError }, { data: blogLinks, error: blogLinksError }] = await Promise.all([
    supabase.from('episode_discovery_terms').select('episode_id').eq('term_id', term.id).order('sort_order', { ascending: true }),
    supabase.from('blog_post_discovery_terms').select('blog_post_id').eq('term_id', term.id).order('sort_order', { ascending: true })
  ]);
  if (episodeLinksError) throw episodeLinksError;
  if (blogLinksError) throw blogLinksError;

  const episodeIds = [...new Set((episodeLinks || []).map((row) => row.episode_id))];
  const blogIds = [...new Set((blogLinks || []).map((row) => row.blog_post_id))];
  const allEpisodes = episodeIds.length
    ? await getResolvedEpisodes({ ids: episodeIds, includeHidden: false, descriptionMaxLength: DEFAULT_LIST_DESCRIPTION_MAX_LENGTH })
    : [];
  const featuredEpisodes = allEpisodes.filter((item) => item.isFeatured).slice(0, 4);
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const start = (normalizedPage - 1) * HUB_PAGE_SIZE;
  const latestEpisodes = allEpisodes.slice(start, start + HUB_PAGE_SIZE);

  let relatedPosts: RelatedBlogPostSummary[] = [];
  if (blogIds.length) {
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
    ((authorsResult.data || []) as BlogAuthorSummaryRow[]).forEach((row) => {
      authorMap.set(row.id, row);
    });

    const mediaMap = new Map<string, MediaAssetSummaryRow>();
    ((mediaResult.data || []) as MediaAssetSummaryRow[]).forEach((row) => {
      mediaMap.set(row.id, row);
    });

    relatedPosts = basePosts.map((row) => {
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
      };
    });
  }

  let relatedTerms: DiscoveryTerm[] = [];
  if (episodeIds.length) {
    const { data: coTerms, error: coTermsError } = await supabase
      .from('episode_discovery_terms')
      .select('term_id')
      .in('episode_id', episodeIds)
      .neq('term_id', term.id);
    if (coTermsError) throw coTermsError;
    const relatedIds = [...new Set((coTerms || []).map((row) => row.term_id))].slice(0, 8);
    if (relatedIds.length) {
      const { data: relatedTermRows, error: relatedTermsError } = await supabase
        .from('discovery_terms')
        .select('*')
        .in('id', relatedIds)
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('sort_order', { ascending: true });
      if (relatedTermsError) throw relatedTermsError;
      relatedTerms = ((relatedTermRows || []) as DiscoveryTermRow[])
        .map(mapDiscoveryTerm)
        .filter((item) => Boolean(item.path));
    }
  }

  return {
    term,
    featuredEpisodes: featuredEpisodes.map(episodeBaseFromResolved),
    latestEpisodes: latestEpisodes.map(episodeBaseFromResolved),
    relatedPosts,
    relatedTerms,
    pagination: {
      page: normalizedPage,
      pageSize: HUB_PAGE_SIZE,
      total: allEpisodes.length,
      totalPages: Math.max(1, Math.ceil(allEpisodes.length / HUB_PAGE_SIZE))
    }
  };
}

const getCachedDiscoveryHubPage = unstable_cache(getDiscoveryHubPageUncached, ['discovery-hub-page-v1'], {
  revalidate: 300,
  tags: ['episodes', 'discovery-terms']
});

export async function getDiscoveryHubPage(routeKey: string, slug: string, page = 1): Promise<DiscoveryHubPage | null> {
  return getCachedDiscoveryHubPage(routeKey, slug, page);
}

export function buildEpisodeBreadcrumbs(episode: ResolvedPodcastEpisode): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ name: 'Home', href: '/' }];
  if (episode.primaryTopic?.path) {
    const hubLabel = episode.primaryTopic.termType === 'topic' ? 'Topics' : 'People';
    items.push({ name: hubLabel, href: `/${hubLabel.toLowerCase()}` });
    items.push({ name: episode.primaryTopic.name, href: episode.primaryTopic.path });
  } else {
    items.push({ name: 'Episodes', href: '/episodes' });
  }
  items.push({ name: episode.title, href: `/episodes/${episode.slug}` });
  return items;
}

export function buildHubBreadcrumbs(routeKey: string, term: DiscoveryTerm): BreadcrumbItem[] {
  const labelMap: Record<string, string> = {
    topics: 'Topics',
    themes: 'Themes',
    people: 'People',
    cases: 'Cases',
    events: 'Events',
    collections: 'Collections',
    series: 'Series'
  };
  const indexPath = `/${routeKey}`;
  return [
    { name: 'Home', href: '/' },
    { name: labelMap[routeKey] || 'Discover', href: indexPath },
    { name: term.name, href: term.path || indexPath }
  ];
}

export function buildBlogPostBreadcrumbs(post: {
  slug: string;
  title: string;
  taxonomies?: { categories?: Array<{ name: string; slug: string }> };
}): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: 'Blog', href: '/blog' }
  ];
  const category = post.taxonomies?.categories?.[0];
  if (category) {
    items.push({ name: category.name, href: `/topics/${category.slug}` });
  }
  items.push({ name: post.title, href: `/blog/${post.slug}` });
  return items;
}

export { formatEpisodeDate };
