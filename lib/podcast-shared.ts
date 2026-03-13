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

export type DiscoveryTermType = 'topic' | 'theme' | 'entity' | 'case' | 'event' | 'collection' | 'series';
export type DiscoveryEntitySubtype = 'person' | 'place' | 'organisation' | 'publication' | 'other' | null;

export type DiscoveryTerm = {
  id: string;
  termType: DiscoveryTermType;
  entitySubtype: DiscoveryEntitySubtype;
  name: string;
  slug: string;
  description: string | null;
  introJson: unknown;
  introMarkdown: string | null;
  heroImageUrl: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  socialTitle: string | null;
  socialDescription: string | null;
  socialImageUrl: string | null;
  isFeatured: boolean;
  sortOrder: number;
  isActive: boolean;
  path: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type EpisodeSourceSnapshot = {
  title: string;
  slug: string;
  descriptionPlain: string;
  descriptionHtml: string;
  transcript: string;
  showNotes: string;
  publishedAt: string;
  audioUrl: string;
  artworkUrl: string | null;
  sourceUrl: string | null;
  episodeNumber: number | null;
  seasonNumber: number | null;
  durationSeconds: number | null;
  lastSyncedAt: string | null;
  missingFromFeedAt: string | null;
};

export type EpisodeEditorialSnapshot = {
  id: string | null;
  webTitle: string | null;
  webSlug: string | null;
  excerpt: string | null;
  bodyJson: unknown;
  bodyMarkdown: string | null;
  heroImageUrl: string | null;
  heroImageStoragePath: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
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
  createdAt: string | null;
  updatedAt: string | null;
};

export type RelatedBlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  readingTimeMinutes: number | null;
  author: {
    name: string;
    slug: string;
  } | null;
  featuredImage: {
    storagePath: string;
    altText: string;
  } | null;
};

export type EpisodeRelationshipSummary = {
  id: string;
  relationshipType: 'related' | 'same_case' | 'same_person' | 'same_theme' | 'part_of_series' | 'recommended_next';
  sortOrder: number;
  episode: PodcastEpisode;
};

export type ResolvedPodcastEpisode = PodcastEpisode & {
  excerpt: string;
  bodyHtml: string;
  bodyJson: unknown;
  bodyMarkdown: string | null;
  bodySource: 'editorial' | 'source';
  transcript: string;
  showNotesHtml: string;
  heroImageUrl: string | null;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  noindex: boolean;
  nofollow: boolean;
  isFeatured: boolean;
  isVisible: boolean;
  isArchived: boolean;
  source: EpisodeSourceSnapshot;
  editorial: EpisodeEditorialSnapshot | null;
  discoveryTerms: DiscoveryTerm[];
  primaryTopic: DiscoveryTerm | null;
  relatedEpisodes: EpisodeRelationshipSummary[];
  relatedPosts: RelatedBlogPostSummary[];
};

export type EpisodeSlugRedirect = {
  currentSlug: string;
  sourcePath: string;
  targetPath: string;
};

export type DiscoveryHubPage = {
  term: DiscoveryTerm;
  featuredEpisodes: PodcastEpisode[];
  latestEpisodes: PodcastEpisode[];
  relatedPosts: RelatedBlogPostSummary[];
  relatedTerms: DiscoveryTerm[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type BreadcrumbItem = {
  name: string;
  href: string;
};

export function formatEpisodeDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(parsed);
}
