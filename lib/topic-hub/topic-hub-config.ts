import { TRUE_CRIME_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/true-crime';
import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

const TOPIC_HUB_CONFIGS: Record<string, TopicHubConfig> = {
  [TRUE_CRIME_TOPIC_HUB_CONFIG.slug]: TRUE_CRIME_TOPIC_HUB_CONFIG
};

export function getTopicHubConfig(slug: string) {
  return TOPIC_HUB_CONFIGS[slug] ?? null;
}

export function listTopicHubSlugs() {
  return Object.keys(TOPIC_HUB_CONFIGS);
}
