import { XMLParser } from 'fast-xml-parser';

const DEFAULT_PODCAST_RSS_FEED_URL = 'https://feeds.simplecast.com/Sci7Fqgp';
const FEED_ACCEPT_HEADER = 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1';
const REVALIDATE_FLOOR_SECONDS = 60;
const DEFAULT_LIST_DESCRIPTION_MAX_LENGTH = 520;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true
});

export type PodcastEpisode = {
  id: string;
  slug: string;
  title: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  publishedAt: string;
  description: string;
  descriptionHtml: string;
  audioUrl: string;
  artworkUrl: string | null;
  duration: string | null;
  sourceUrl: string | null;
};

type GetPodcastEpisodesOptions = {
  includeDescriptionHtml?: boolean;
  descriptionMaxLength?: number | null;
  limit?: number | null;
};

type ParsedFeed = {
  rss?: {
    channel?: {
      item?: unknown;
      image?: { url?: string };
      'itunes:image'?: { href?: string } | string;
    };
  };
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

  const hasHtmlTags = /<[^>]+>/.test(normalized);
  const htmlContent = hasHtmlTags
    ? normalized
    : normalized
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
        .join('');

  return htmlContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '')
    .replace(/<a\s/gi, '<a target="_blank" rel="noreferrer" ')
    .trim();
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

function secondsUntilNextFivePast(now = new Date()): number {
  const next = new Date(now);
  next.setUTCMinutes(5, 0, 0);

  while (next.getTime() <= now.getTime()) {
    next.setUTCHours(next.getUTCHours() + 1);
  }

  const seconds = Math.floor((next.getTime() - now.getTime()) / 1000);
  return Math.max(seconds, REVALIDATE_FLOOR_SECONDS);
}

export function getPodcastFeedUrl(): string {
  return process.env.PODCAST_RSS_FEED_URL || DEFAULT_PODCAST_RSS_FEED_URL;
}

export function formatEpisodeDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(parsed);
}

export async function getPodcastEpisodes(options: GetPodcastEpisodesOptions = {}): Promise<PodcastEpisode[]> {
  const {
    includeDescriptionHtml = false,
    descriptionMaxLength = DEFAULT_LIST_DESCRIPTION_MAX_LENGTH,
    limit = null
  } = options;

  const feedUrl = getPodcastFeedUrl();
  const response = await fetch(feedUrl, {
    headers: {
      Accept: FEED_ACCEPT_HEADER
    },
    next: {
      revalidate: secondsUntilNextFivePast()
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
      const description = truncateText(fullDescription, descriptionMaxLength);
      const descriptionHtml = includeDescriptionHtml ? toSafeHtml(descriptionSource) : '';
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
        description,
        descriptionHtml,
        audioUrl,
        artworkUrl: resolveArtworkUrl(item, channelArtwork),
        duration,
        sourceUrl
      } satisfies PodcastEpisode;
    })
    .filter((episode) => Boolean(episode.audioUrl));

  episodes.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    return episodes.slice(0, limit);
  }

  return episodes;
}
