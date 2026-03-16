import type { ResolvedPodcastEpisode } from '@/lib/podcast-shared';
import type { TopicHubEditorialSection, TopicHubEditorialSectionConfig } from '@/lib/topic-hub/topic-hub-types';

function byNewest(a: ResolvedPodcastEpisode, b: ResolvedPodcastEpisode) {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

function mapEpisodesBySlug(episodes: ResolvedPodcastEpisode[]) {
  return new Map(episodes.map((episode) => [episode.slug, episode]));
}

function dedupeByEpisodeId(episodes: ResolvedPodcastEpisode[]) {
  return episodes.filter((episode, index, collection) => collection.findIndex((item) => item.id === episode.id) === index);
}

export function getTopicEpisodes(episodes: ResolvedPodcastEpisode[], topicSlug: string) {
  return episodes
    .filter((episode) => episode.discoveryTerms.some((term) => term.termType === 'topic' && term.slug === topicSlug))
    .sort(byNewest);
}

export function buildTopicFeaturedSelection(episodes: ResolvedPodcastEpisode[], featuredEpisodeSlugs: readonly string[]) {
  const episodesBySlug = mapEpisodesBySlug(episodes);

  return featuredEpisodeSlugs
    .map((slug) => episodesBySlug.get(slug))
    .filter((episode): episode is ResolvedPodcastEpisode => Boolean(episode));
}

export function buildTopicEditorialGroups(params: {
  episodes: ResolvedPodcastEpisode[];
  featuredEpisodeIds: Set<string>;
  sectionConfigs: readonly TopicHubEditorialSectionConfig[];
}) {
  const episodesBySlug = mapEpisodesBySlug(params.episodes);
  const usedEpisodeIds = new Set(params.featuredEpisodeIds);

  return params.sectionConfigs.flatMap((sectionConfig): TopicHubEditorialSection[] => {
    const configuredEpisodes = sectionConfig.episodeSlugs
      .map((slug) => episodesBySlug.get(slug))
      .filter((episode): episode is ResolvedPodcastEpisode => Boolean(episode));

    const taxonomyEpisodes = sectionConfig.taxonomyCollectionSlug
      ? params.episodes.filter((episode) =>
          episode.discoveryTerms.some(
            (term) => term.termType === 'collection' && term.slug === sectionConfig.taxonomyCollectionSlug
          )
        )
      : [];

    const resolvedEpisodes = dedupeByEpisodeId([...configuredEpisodes, ...taxonomyEpisodes])
      .filter((episode) => !usedEpisodeIds.has(episode.id));

    if (resolvedEpisodes.length < sectionConfig.minimumEpisodesToRender) {
      return [];
    }

    const cappedEpisodes = sectionConfig.maxVisibleEpisodes
      ? resolvedEpisodes.slice(0, sectionConfig.maxVisibleEpisodes)
      : resolvedEpisodes;

    cappedEpisodes.forEach((episode) => usedEpisodeIds.add(episode.id));

    return [
      {
        id: sectionConfig.id,
        title: sectionConfig.title,
        intro: sectionConfig.intro,
        chipLabel: sectionConfig.chipLabel,
        episodes: cappedEpisodes,
        maxVisibleEpisodes: sectionConfig.maxVisibleEpisodes,
        styleVariant: sectionConfig.styleVariant
      }
    ];
  });
}
