'use client';

import { useEffect } from 'react';
import { trackMixpanel } from '@/lib/mixpanel-browser';
import type { HomepageV2Environment } from '@/lib/homepage-v2/env';
import {
  HOMEPAGE_V2_PAGE_VERSION,
  HOMEPAGE_V2_REQUIRED_EVENTS,
  resolveHomepageV2DeviceTypeFromWindow,
  resolveHomepageV2EnvironmentClientFallback,
  type HomepageV2TrackedEvent
} from '@/lib/homepage-v2/tracking';

type Props = {
  environment: HomepageV2Environment;
  pagePath: string;
};

function isHomepageV2TrackedEvent(value: string): value is HomepageV2TrackedEvent {
  return (HOMEPAGE_V2_REQUIRED_EVENTS as readonly string[]).includes(value);
}

export function HomepageV2EventTracker({ environment, pagePath }: Props) {
  useEffect(() => {
    const resolvedEnvironment = resolveHomepageV2EnvironmentClientFallback(environment);

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const node = target?.closest('[data-homepage-v2-event]') as HTMLElement | null;
      if (!node) return;

      const eventName = `${node.dataset.homepageV2Event || ''}`.trim();
      if (!isHomepageV2TrackedEvent(eventName)) return;

      const dedupeWindowMs = 650;
      const now = Date.now();
      const lastTrackedAt = Number(node.dataset.homepageV2TrackedAt || '0');
      if (Number.isFinite(lastTrackedAt) && now - lastTrackedAt < dedupeWindowMs) return;
      node.dataset.homepageV2TrackedAt = String(now);

      const properties: Record<string, unknown> = {
        page_version: HOMEPAGE_V2_PAGE_VERSION,
        environment: resolvedEnvironment,
        device_type: resolveHomepageV2DeviceTypeFromWindow(),
        page_path: pagePath
      };

      const section = `${node.dataset.homepageV2Section || ''}`.trim();
      const destination = `${node.dataset.homepageV2Destination || ''}`.trim();
      const pillar = `${node.dataset.homepageV2Pillar || ''}`.trim();
      const episodeSlug = `${node.dataset.homepageV2EpisodeSlug || ''}`.trim();
      const topicSlug = `${node.dataset.homepageV2TopicSlug || ''}`.trim();

      if (section) properties.section = section;
      if (destination) properties.destination = destination;
      if (pillar) properties.pillar = pillar;
      if (episodeSlug) properties.episode_slug = episodeSlug;
      if (topicSlug) properties.topic_slug = topicSlug;

      trackMixpanel(eventName, properties);
    };

    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
    };
  }, [environment, pagePath]);

  return null;
}
