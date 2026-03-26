import { CULTS_BELIEF_MORAL_PANICS_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/cults-belief-moral-panics';
import { DISASTERS_SURVIVAL_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/disasters-survival';
import { HISTORY_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/history';
import { INCREDIBLE_PEOPLE_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/incredible-people';
import { MYSTERIES_UNEXPLAINED_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/mysteries-unexplained';
import { POP_CULTURE_ENTERTAINMENT_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/pop-culture-entertainment';
import { SCAMS_HOAXES_CONS_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/scams-hoaxes-cons';
import { TRUE_CRIME_TOPIC_HUB_CONFIG } from '@/lib/topic-hub/config/true-crime';
import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

const TOPIC_HUB_CONFIGS: Record<string, TopicHubConfig> = {
  [CULTS_BELIEF_MORAL_PANICS_TOPIC_HUB_CONFIG.slug]: CULTS_BELIEF_MORAL_PANICS_TOPIC_HUB_CONFIG,
  [DISASTERS_SURVIVAL_TOPIC_HUB_CONFIG.slug]: DISASTERS_SURVIVAL_TOPIC_HUB_CONFIG,
  [HISTORY_TOPIC_HUB_CONFIG.slug]: HISTORY_TOPIC_HUB_CONFIG,
  [INCREDIBLE_PEOPLE_TOPIC_HUB_CONFIG.slug]: INCREDIBLE_PEOPLE_TOPIC_HUB_CONFIG,
  [MYSTERIES_UNEXPLAINED_TOPIC_HUB_CONFIG.slug]: MYSTERIES_UNEXPLAINED_TOPIC_HUB_CONFIG,
  [POP_CULTURE_ENTERTAINMENT_TOPIC_HUB_CONFIG.slug]: POP_CULTURE_ENTERTAINMENT_TOPIC_HUB_CONFIG,
  [SCAMS_HOAXES_CONS_TOPIC_HUB_CONFIG.slug]: SCAMS_HOAXES_CONS_TOPIC_HUB_CONFIG,
  [TRUE_CRIME_TOPIC_HUB_CONFIG.slug]: TRUE_CRIME_TOPIC_HUB_CONFIG
};

export function getTopicHubConfig(slug: string) {
  return TOPIC_HUB_CONFIGS[slug] ?? null;
}

export function listTopicHubSlugs() {
  return Object.keys(TOPIC_HUB_CONFIGS);
}
