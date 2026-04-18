import { XMLParser } from 'fast-xml-parser';
import { unstable_cache } from 'next/cache';
import { formatEpisodeDate, hasTranscriptContent, type PodcastEpisode } from './podcast-shared';
export type { PodcastEpisode } from './podcast-shared';

const DEFAULT_PODCAST_RSS_FEED_URL = 'https://feeds.simplecast.com/Sci7Fqgp';
const FEED_ACCEPT_HEADER = 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1';
const DEFAULT_LIST_DESCRIPTION_MAX_LENGTH = 520;
const PODCAST_FEED_REVALIDATE_SECONDS = 900;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true
});

type GetPodcastEpisodesOptions = {
  includeDescriptionHtml?: boolean;
  includeEditorialMeta?: boolean;
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

function formatDurationFromSeconds(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remaining = rounded % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
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

function toIsoDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
  return parsed.toISOString();
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  const titlePart = slugify(title);
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

export function getPodcastFeedUrl(): string {
  return process.env.PODCAST_RSS_FEED_URL || DEFAULT_PODCAST_RSS_FEED_URL;
}

export { formatEpisodeDate };

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
      const duration = getNodeText(item['itunes:duration']) || null;

      // Prefer GUID because it is stable per episode; fallback to audio URL or source URL.
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

const getCachedParsedPodcastFeed = unstable_cache(fetchAndParsePodcastFeed, ['podcast-feed-v1'], {
  revalidate: PODCAST_FEED_REVALIDATE_SECONDS
});

async function loadPrimaryTopicsForEpisodes(
  supabase: ReturnType<typeof import('./supabase').createSupabaseAdminClient>,
  episodeIds: string[]
): Promise<Map<string, { name: string; slug: string; path: string | null }>> {
  const map = new Map<string, { name: string; slug: string; path: string | null }>();
  if (!episodeIds.length) return map;

  // Load ALL discovery term links (not just is_primary) ordered by sort_order,
  // matching the editor which picks the first topic-type term by sort_order.
  const { data: links, error: linksError } = await supabase
    .from('episode_discovery_terms')
    .select('episode_id, term_id')
    .in('episode_id', episodeIds)
    .order('sort_order', { ascending: true });

  if (linksError || !links?.length) return map;

  const termIds = [...new Set(links.map((l) => l.term_id as string))];
  const { data: terms, error: termsError } = await supabase
    .from('discovery_terms')
    .select('id, name, slug, term_type')
    .in('id', termIds)
    .eq('term_type', 'topic')
    .eq('is_active', true);

  if (termsError || !terms?.length) return map;

  const topicTermIds = new Set(terms.map((t) => t.id as string));
  const termsById = new Map(terms.map((t) => [t.id as string, t]));

  // For each episode, take the first link whose term is a topic (by sort_order).
  for (const link of links) {
    const eid = link.episode_id as string;
    if (map.has(eid)) continue; // already found the first topic for this episode
    if (!topicTermIds.has(link.term_id as string)) continue;
    const term = termsById.get(link.term_id as string)!;
    map.set(eid, {
      name: term.name as string,
      slug: term.slug as string,
      path: `/topics/${term.slug as string}`
    });
  }
  return map;
}

async function loadHasRelatedEpisodes(
  supabase: ReturnType<typeof import('./supabase').createSupabaseAdminClient>,
  episodeIds: string[]
): Promise<Set<string>> {
  const result = new Set<string>();
  if (!episodeIds.length) return result;

  const { data, error } = await supabase
    .from('episode_relationships')
    .select('source_episode_id')
    .in('source_episode_id', episodeIds);

  if (error || !data?.length) return result;
  for (const row of data) {
    result.add(row.source_episode_id as string);
  }
  return result;
}

async function getPodcastEpisodesFromDatabase(
  options: GetPodcastEpisodesOptions = {}
): Promise<PodcastEpisode[] | null> {
  try {
    const { createSupabaseAdminClient } = await import('./supabase');
    const supabase = createSupabaseAdminClient();

    const editorialSelect = options.includeEditorialMeta
      ? 'podcast_episode_editorial(web_title, seo_title, meta_description, body_json, excerpt, author_id, focus_keyword)'
      : 'podcast_episode_editorial(web_title, author_id)';
    const episodeSelectFields =
      'id,slug,title,season_number,episode_number,published_at,description_plain,description_html,audio_url,artwork_url,duration_seconds,source_url';

    const { data, error } = await supabase
      .from('podcast_episodes')
      .select(`${episodeSelectFields}, ${editorialSelect}`)
      .eq('is_visible', true)
      .eq('is_archived', false)
      .order('published_at', { ascending: false });
    if (error) return null;
    if (!data || data.length === 0) return null;

    const episodeEditorialRows = data
      .map((episode) => (Array.isArray(episode.podcast_episode_editorial)
        ? episode.podcast_episode_editorial[0]
        : episode.podcast_episode_editorial) as Record<string, any> | null)
      .filter(Boolean) as Record<string, any>[];
    const authorIds = [...new Set(
      episodeEditorialRows
        .map((row) => `${row.author_id || ''}`.trim())
        .filter(Boolean)
    )];
    const authorMap = new Map<string, { name: string; slug: string | null }>();
    if (authorIds.length) {
      const { data: authorRows, error: authorRowsError } = await supabase
        .from('blog_authors')
        .select('id, name, slug')
        .in('id', authorIds);
      if (!authorRowsError) {
        for (const row of (authorRows || []) as Array<{ id: string; name: string; slug: string | null }>) {
          if (!row?.id) continue;
          authorMap.set(row.id, {
            name: row.name || '',
            slug: row.slug || null
          });
        }
      }
    }

    // When editorial meta is requested, load primary topics and related episode presence in one batch.
    let primaryTopicMap = new Map<string, { name: string; slug: string; path: string | null }>();
    let hasRelatedEpisodeSet = new Set<string>();
    let blogContent: Awaited<typeof import('./blog/content')> | null = null;
    let hasAnyAuthors = false;
    if (options.includeEditorialMeta) {
      const ids = data.map((e) => e.id as string);
      const [topicMap, relatedSet, content, authorCountResult] = await Promise.all([
        loadPrimaryTopicsForEpisodes(supabase, ids),
        loadHasRelatedEpisodes(supabase, ids),
        import('./blog/content'),
        supabase.from('blog_authors').select('id', { count: 'exact', head: true }).eq('is_archived', false)
      ]);
      primaryTopicMap = topicMap;
      hasRelatedEpisodeSet = relatedSet;
      blogContent = content;
      hasAnyAuthors = (authorCountResult.count ?? 0) > 0;
    }

    const episodes: PodcastEpisode[] = data.map((episode) => {
      const editorial = (Array.isArray(episode.podcast_episode_editorial)
        ? episode.podcast_episode_editorial[0]
        : episode.podcast_episode_editorial) as Record<string, any> | null;

      const base: PodcastEpisode = {
        id: episode.id,
        slug: episode.slug,
        title: editorial?.web_title || episode.title,
        authorName: editorial?.author_id ? (authorMap.get(editorial.author_id)?.name || null) : null,
        authorSlug: editorial?.author_id ? (authorMap.get(editorial.author_id)?.slug || null) : null,
        seasonNumber: episode.season_number ?? null,
        episodeNumber: episode.episode_number ?? null,
        publishedAt: episode.published_at || new Date(0).toISOString(),
        description: truncateText(episode.description_plain, options.descriptionMaxLength ?? DEFAULT_LIST_DESCRIPTION_MAX_LENGTH),
        descriptionHtml: options.includeDescriptionHtml ? toSafeHtml(episode.description_html) : '',
        audioUrl: episode.audio_url,
        artworkUrl: episode.artwork_url,
        duration: formatDurationFromSeconds(episode.duration_seconds),
        sourceUrl: episode.source_url || null
      };

      if (options.includeEditorialMeta) {
        base.seoTitle = editorial?.seo_title ?? null;
        base.metaDescription = editorial?.meta_description ?? null;
        base.hasTranscript = hasTranscriptContent(editorial?.body_json);
        const topic = primaryTopicMap.get(episode.id as string);
        if (topic) {
          base.primaryTopicName = topic.name;
          base.primaryTopicSlug = topic.slug;
          base.primaryTopicPath = topic.path;
        }

        // Compute SEO score using the same document hydration the editor uses:
        // if the editorial body has no non-transcript blocks, fall back to a
        // document built from the source RSS description so the score matches.
        const rawBodyJson: unknown[] = Array.isArray(editorial?.body_json) ? editorial.body_json : [];
        const nonTranscriptBlocks = rawBodyJson.filter((b: any) => b?.type !== 'transcript');
        const transcriptBlocks = rawBodyJson.filter((b: any) => b?.type === 'transcript');
        let hydratedBodyJson: unknown[] = rawBodyJson;
        if (nonTranscriptBlocks.length === 0) {
          const sourcePlain = (episode.description_plain || '').trim();
          if (sourcePlain) {
            const sourceDoc = blogContent!.markdownToBlogDocument(sourcePlain);
            hydratedBodyJson = sourceDoc.length > 0
              ? [...sourceDoc, ...transcriptBlocks]
              : rawBodyJson;
          }
        }
        const document = blogContent!.normalizeBlogDocument(hydratedBodyJson);
        const seoResult = blogContent!.buildSeoChecklist({
          title: base.title,
          seoTitle: editorial?.seo_title || null,
          seoDescription: editorial?.meta_description || null,
          focusKeyword: (editorial?.focus_keyword as string) || null,
          canonicalUrl: null,
          document,
          excerpt: editorial?.excerpt || null,
          hasAuthor: Boolean(editorial?.author_id) || hasAnyAuthors,
          hasPrimaryCategory: Boolean(topic),
          hasLinkedEpisode: hasRelatedEpisodeSet.has(episode.id as string)
        });
        base.seoScore = seoResult.score;
      }

      return base;
    });

    if (typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
      return episodes.slice(0, options.limit);
    }

    return episodes;
  } catch {
    return null;
  }
}

export async function getPodcastEpisodes(options: GetPodcastEpisodesOptions = {}): Promise<PodcastEpisode[]> {
  const databaseEpisodes = await getPodcastEpisodesFromDatabase(options);
  if (databaseEpisodes) return databaseEpisodes;

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
    authorName: null,
    authorSlug: null,
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

export async function getPodcastEpisodeBySlug(
  slug: string,
  options: GetPodcastEpisodeBySlugOptions = {
    includeDescriptionHtml: true,
    descriptionMaxLength: null
  }
): Promise<PodcastEpisode | null> {
  const normalizedSlug = `${slug || ''}`.trim();
  if (!normalizedSlug) return null;

  const databaseEpisodes = await getPodcastEpisodesFromDatabase({
    includeDescriptionHtml: options.includeDescriptionHtml ?? true,
    descriptionMaxLength: options.descriptionMaxLength ?? null
  });
  if (databaseEpisodes) {
    return databaseEpisodes.find((episode) => episode.slug === normalizedSlug) ?? null;
  }

  const episodes = await getPodcastEpisodes({
    includeDescriptionHtml: options.includeDescriptionHtml ?? true,
    descriptionMaxLength: options.descriptionMaxLength ?? null
  });
  return episodes.find((episode) => episode.slug === normalizedSlug) ?? null;
}
