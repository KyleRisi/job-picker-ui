'use client';

import { useEffect } from 'react';
import { trackMixpanel } from '@/lib/mixpanel-browser';

const DISCOVERY_EVENT_NAMES = [
  'topic_card_clicked',
  'topic_hub_card_clicked',
  'topic_hub_archive_clicked',
  'related_topic_clicked'
] as const;

type DiscoveryEventName = (typeof DISCOVERY_EVENT_NAMES)[number];

function isDiscoveryEventName(value: string): value is DiscoveryEventName {
  return (DISCOVERY_EVENT_NAMES as readonly string[]).includes(value);
}

function readDataAttribute(node: HTMLElement, name: string): string {
  return `${node.getAttribute(name) || ''}`.trim();
}

export function DiscoveryAnalyticsEventTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const node = target?.closest('[data-discovery-event]') as HTMLElement | null;
      if (!node) return;

      const eventName = readDataAttribute(node, 'data-discovery-event');
      if (!isDiscoveryEventName(eventName)) return;

      const now = Date.now();
      const lastTrackedAt = Number(readDataAttribute(node, 'data-discovery-tracked-at') || '0');
      if (Number.isFinite(lastTrackedAt) && now - lastTrackedAt < 650) return;
      node.setAttribute('data-discovery-tracked-at', String(now));

      const properties: Record<string, unknown> = {};

      const pagePath = readDataAttribute(node, 'data-page-path');
      const pageType = readDataAttribute(node, 'data-page-type');
      const topicSlug = readDataAttribute(node, 'data-topic-slug');
      const episodeSlug = readDataAttribute(node, 'data-episode-slug');
      const destination = readDataAttribute(node, 'data-destination');
      const sourceSection = readDataAttribute(node, 'data-source-section');
      const destinationTopicSlug = readDataAttribute(node, 'data-destination-topic-slug');
      const ctaLocation = readDataAttribute(node, 'data-cta-location');
      const surface = readDataAttribute(node, 'data-surface');

      if (pagePath) properties.page_path = pagePath;
      if (pageType) properties.page_type = pageType;
      if (topicSlug) properties.topic_slug = topicSlug;
      if (episodeSlug) properties.episode_slug = episodeSlug;
      if (destination) properties.destination = destination;
      if (sourceSection) properties.source_section = sourceSection;
      if (destinationTopicSlug) properties.destination_topic_slug = destinationTopicSlug;
      if (ctaLocation) properties.cta_location = ctaLocation;
      if (surface) properties.surface = surface;

      trackMixpanel(eventName, properties);
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
