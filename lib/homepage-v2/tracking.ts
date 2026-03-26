import { inferHomepageV2EnvironmentFromWindowLocation, type HomepageV2Environment } from '@/lib/homepage-v2/env';

export const HOMEPAGE_V2_PAGE_VERSION = 'homepage_v2' as const;

export const HOMEPAGE_V2_REQUIRED_EVENTS = [
  'homepage_spotify_click',
  'homepage_apple_click',
  'homepage_email_signup',
  'homepage_patreon_click',
  'homepage_start_here_click',
  'homepage_pillar_click',
  'homepage_latest_episode_click',
  'homepage_popular_episode_click',
  'homepage_reviews_click',
  'homepage_hosts_click'
] as const;

export type HomepageV2TrackedEvent = (typeof HOMEPAGE_V2_REQUIRED_EVENTS)[number];

export type HomepageV2DeviceType = 'desktop' | 'mobile' | 'tablet';

export function resolveHomepageV2DeviceTypeFromWindow(): HomepageV2DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth || 0;
  if (width <= 767) return 'mobile';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

export function resolveHomepageV2DeviceTypeFromUserAgent(userAgent: string | null | undefined): HomepageV2DeviceType {
  const ua = `${userAgent || ''}`.toLowerCase();
  if (!ua) return 'desktop';
  if (/tablet|ipad/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  return 'desktop';
}

export function resolveHomepageV2EnvironmentClientFallback(
  value: HomepageV2Environment | null | undefined
): HomepageV2Environment {
  if (value === 'preview' || value === 'production') return value;
  return inferHomepageV2EnvironmentFromWindowLocation();
}

export function withHomepageV2BaseEventProperties(input: {
  environment: HomepageV2Environment;
  deviceType: HomepageV2DeviceType;
  pagePath: string;
}) {
  return {
    page_version: HOMEPAGE_V2_PAGE_VERSION,
    environment: input.environment,
    device_type: input.deviceType,
    page_path: input.pagePath
  };
}
