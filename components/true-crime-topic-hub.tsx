import { TopicHubLayout } from '@/components/topic-hub/topic-hub-layout';
import type { DiscoveryHubPage, ResolvedPodcastEpisode } from '@/lib/podcast-shared';
import { TRUE_CRIME_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/true-crime';
import type { TopicHubEditorialSection } from '@/lib/topic-hub/topic-hub-types';

export function TrueCrimeTopicHub({
  hub,
  featuredEpisodes,
  groupedSections
}: {
  hub: DiscoveryHubPage;
  featuredEpisodes: ResolvedPodcastEpisode[];
  groupedSections: TopicHubEditorialSection[];
}) {
  return (
    <TopicHubLayout
      hub={hub}
      featuredEpisodes={featuredEpisodes}
      groupedSections={groupedSections}
      config={TRUE_CRIME_TOPIC_HUB_CONFIG.layout}
    />
  );
}
