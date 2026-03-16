import type { ResolvedPodcastEpisode } from '@/lib/podcast-shared';
import { TRUE_CRIME_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/true-crime';
import {
  buildTopicEditorialGroups,
  buildTopicFeaturedSelection,
  getTopicEpisodes
} from '@/lib/topic-hub/topic-hub-curation';
import type { TopicHubEditorialSection } from '@/lib/topic-hub/topic-hub-types';

export const TRUE_CRIME_FEATURED_EPISODE_SLUGS = TRUE_CRIME_TOPIC_HUB_CONFIG.curation.featuredEpisodeSlugs;

type TrueCrimeSectionConfig = {
  id: string;
  title: string;
  intro: string;
  chipLabel: string;
  minimumEpisodesToRender: number;
  episodeSlugs: readonly string[];
};

export type TrueCrimeEditorialSection = TopicHubEditorialSection;

export const TRUE_CRIME_EDITORIAL_SECTION_CONFIG: readonly TrueCrimeSectionConfig[] =
  TRUE_CRIME_TOPIC_HUB_CONFIG.curation.editorialSections.map((section) => ({
    id: section.id,
    title: section.title,
    intro: section.intro,
    chipLabel: section.chipLabel,
    minimumEpisodesToRender: section.minimumEpisodesToRender,
    episodeSlugs: section.episodeSlugs
  }));

export function buildTrueCrimeFeaturedSelection(episodes: ResolvedPodcastEpisode[]) {
  return buildTopicFeaturedSelection(episodes, TRUE_CRIME_FEATURED_EPISODE_SLUGS);
}

export function buildTrueCrimeEditorialGroups(params: {
  episodes: ResolvedPodcastEpisode[];
  featuredEpisodeIds: Set<string>;
}) {
  return buildTopicEditorialGroups({
    episodes: params.episodes,
    featuredEpisodeIds: params.featuredEpisodeIds,
    sectionConfigs: TRUE_CRIME_TOPIC_HUB_CONFIG.curation.editorialSections
  });
}

export function getTrueCrimeTopicEpisodes(episodes: ResolvedPodcastEpisode[], topicSlug = 'true-crime') {
  return getTopicEpisodes(episodes, topicSlug);
}
