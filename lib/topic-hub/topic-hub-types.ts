import type { DiscoveryHubPage, ResolvedPodcastEpisode } from '@/lib/podcast-shared';

export type TopicHubSectionStyleVariant =
  | 'full-bleed-gold'
  | 'mobile-full-bleed-panel'
  | 'plain'
  | 'alternating-card';

export type TopicHubAction = {
  label: string;
  href: string;
  external?: boolean;
};

export type TopicHubHeroCard = {
  title: string;
  badge?: string;
  backgroundImageUrl: string;
};

export type TopicHubHeroConfig = {
  eyebrow: string;
  title: string;
  mobileTitle?: string;
  descriptor?: string;
  mobileDescriptor?: string;
  intro: string;
  mobileIntro?: string;
  cornerArtworkUrl?: string;
  card?: TopicHubHeroCard;
  trustStripItems?: string[];
  primaryAction: TopicHubAction;
  secondaryAction: TopicHubAction;
  tertiaryAction?: TopicHubAction;
};

export type TopicHubStartHereConfig = {
  eyebrow: string;
  heading: string;
  intro: string;
  sectionId: string;
};

export type TopicHubChipNavConfig = {
  eyebrow: string;
  heading: string;
  intro: string;
  chipOrder: string[];
};

export type TopicHubArchiveHighlightConfig = {
  heading: string;
  body: string;
  action: TopicHubAction;
};

export type TopicHubRelatedArticlesConfig = {
  eyebrow: string;
  heading: string;
  intro: string;
  minimumItems: number;
};

export type TopicHubWhyListenConfig = {
  eyebrow: string;
  heading: string;
  intro: string;
  points: string[];
};

export type TopicHubFaqItem = {
  question: string;
  answer: string;
};

export type TopicHubFaqConfig = {
  eyebrow: string;
  heading: string;
  supportingLine?: string;
  items: TopicHubFaqItem[];
};

export type TopicHubRelatedTopic = {
  href: string;
  title: string;
  displayTitle?: string;
  description: string;
  label: string;
  ctaLabel: string;
  backgroundImageUrl?: string;
};

export type TopicHubRelatedTopicsConfig = {
  eyebrow: string;
  heading: string;
  intro: string;
  topics: TopicHubRelatedTopic[];
};

export type TopicHubFinalCtaConfig = {
  eyebrow: string;
  heading: string;
  body: string;
  primaryAction: TopicHubAction;
  secondaryAction?: TopicHubAction;
};

export type TopicHubLayoutConfig = {
  hero: TopicHubHeroConfig;
  startHere: TopicHubStartHereConfig;
  chips: TopicHubChipNavConfig;
  sectionEyebrow: string;
  archiveHighlight: TopicHubArchiveHighlightConfig;
  relatedArticles?: TopicHubRelatedArticlesConfig;
  whyListen: TopicHubWhyListenConfig;
  faq: TopicHubFaqConfig;
  relatedTopics: TopicHubRelatedTopicsConfig;
  finalCta: TopicHubFinalCtaConfig;
  episodeCardCtaLabel: string;
  showInlinePlayer: boolean;
  minimalCard: boolean;
};

export type TopicHubEditorialSectionConfig = {
  id: string;
  title: string;
  intro: string;
  chipLabel: string;
  minimumEpisodesToRender: number;
  episodeSlugs: readonly string[];
  maxVisibleEpisodes?: number;
  styleVariant: TopicHubSectionStyleVariant;
  taxonomyCollectionSlug?: string;
};

export type TopicHubCurationConfig = {
  featuredEpisodeSlugs: readonly string[];
  editorialSections: readonly TopicHubEditorialSectionConfig[];
};

export type TopicHubSeoOverride = {
  titleAbsolute: string;
  description: string;
  socialTitle?: string;
  socialDescription?: string;
  socialImageUrl?: string;
};

export type TopicHubConfig = {
  slug: string;
  seoOverride?: TopicHubSeoOverride;
  layout: TopicHubLayoutConfig;
  curation: TopicHubCurationConfig;
};

export type TopicHubEditorialSection = {
  id: string;
  title: string;
  intro: string;
  chipLabel: string;
  episodes: ResolvedPodcastEpisode[];
  maxVisibleEpisodes?: number;
  styleVariant: TopicHubSectionStyleVariant;
};

export type TopicHubLayoutProps = {
  hub: DiscoveryHubPage;
  featuredEpisodes: ResolvedPodcastEpisode[];
  groupedSections: TopicHubEditorialSection[];
  config: TopicHubLayoutConfig;
};
