'use client';

import { resolveSourcePageType } from '@/lib/analytics-events';
import { trackMixpanel } from '@/lib/mixpanel-browser';
import { isIntentionalNotFoundPath } from '@/lib/mixpanel-broken-health-config';

const BROKEN_HEALTH_ARBITRATION_WINDOW_MS = 300;

const RELEASE_VERSION =
  process.env.NEXT_PUBLIC_RELEASE_VERSION ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  '';

const PAGE_TYPE_MAP: Record<ReturnType<typeof resolveSourcePageType>, string> = {
  home: 'homepage',
  episode_list: 'episode_list',
  episode_page: 'episode',
  blog_post: 'article',
  discovery_hub: 'discovery_hub',
  patreon_page: 'patreon',
  connect: 'connect',
  press_kit: 'press_kit',
  jobs_page: 'jobs',
  job_page: 'job',
  job_apply_page: 'job_apply',
  other_page: 'other'
};

export const BROKEN_HEALTH_EVENT_NAMES = [
  '404 Viewed',
  '500 Error Page Viewed',
  'Soft 404 Viewed',
  'Route Load Failed',
  'Critical API Failed'
] as const;

export type BrokenHealthEventName = (typeof BROKEN_HEALTH_EVENT_NAMES)[number];

type BoundarySource = 'public_segment' | 'global';

type BrokenHealthTrackInput = {
  route_name?: string;
  status_code?: number;
  page_type?: string;
  release_version?: string;
  content_id?: string;
  content_slug?: string;
  content_type?: string;
  api_name?: string;
  error_message?: string;
  error_type?: 'not_found' | 'route_error' | 'api_failure' | 'server_error' | 'content_missing';
  boundary_source?: BoundarySource;
};

type PreparedEvent = {
  eventName: BrokenHealthEventName;
  priority: number;
  properties: Record<string, unknown>;
};

type ArbitrationState = {
  impressionKey: string;
  timer: number | null;
  candidate: PreparedEvent | null;
  committed: boolean;
};

let arbitrationState: ArbitrationState | null = null;

const EVENT_PRIORITY: Record<BrokenHealthEventName, number> = {
  '500 Error Page Viewed': 5,
  '404 Viewed': 4,
  'Route Load Failed': 3,
  'Critical API Failed': 2,
  'Soft 404 Viewed': 1
};

function isPublicPath(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/workspace')) return false;
  return true;
}

function getRouteName(pathname: string): string | undefined {
  if (pathname === '/') return 'home';
  if (pathname === '/episodes') return 'episodes_index';
  if (pathname.startsWith('/episodes/')) return 'episode_detail';
  if (pathname === '/blog') return 'blog_index';
  if (pathname.startsWith('/blog/')) return 'blog_detail';
  if (pathname.startsWith('/topics/')) return 'topic_hub';
  if (pathname.startsWith('/collections/')) return 'collection_hub';
  if (pathname.startsWith('/author/')) return 'author_hub';
  if (pathname === '/jobs') return 'jobs_index';
  if (pathname.startsWith('/jobs/')) return 'job_detail';
  if (pathname.startsWith('/apply/')) return 'job_apply';
  if (pathname === '/connect') return 'connect';
  if (pathname === '/connect/press-kit') return 'press_kit';
  return undefined;
}

function getReleaseVersion(): string | undefined {
  if (RELEASE_VERSION) return RELEASE_VERSION;
  if (typeof window === 'undefined') return undefined;
  const nextData = (window as unknown as { __NEXT_DATA__?: { buildId?: unknown } }).__NEXT_DATA__;
  if (typeof nextData?.buildId === 'string' && nextData.buildId.trim()) {
    return nextData.buildId.trim();
  }
  return undefined;
}

function sanitizeErrorMessage(value: unknown): string | undefined {
  const text = `${value || ''}`
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return undefined;
  return text.slice(0, 220);
}

function getDefaultErrorType(eventName: BrokenHealthEventName): BrokenHealthTrackInput['error_type'] {
  if (eventName === '404 Viewed') return 'not_found';
  if (eventName === '500 Error Page Viewed') return 'server_error';
  if (eventName === 'Route Load Failed') return 'route_error';
  if (eventName === 'Critical API Failed') return 'api_failure';
  return 'content_missing';
}

function getDefaultStatusCode(eventName: BrokenHealthEventName): number | undefined {
  if (eventName === '404 Viewed') return 404;
  if (eventName === '500 Error Page Viewed') return 500;
  return undefined;
}

function resolvePageType(pathname: string, override?: string): string | undefined {
  if (override) return override;
  return PAGE_TYPE_MAP[resolveSourcePageType(pathname)];
}

function stripUndefined(values: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries);
}

function resolveImpressionKey(pathnameWithSearch: string): string {
  if (typeof window === 'undefined') return pathnameWithSearch;
  const state = window.history.state as { key?: unknown; idx?: unknown } | null;
  if (typeof state?.key === 'string' && state.key.trim()) {
    return state.key;
  }
  if (typeof state?.idx === 'number' && Number.isFinite(state.idx)) {
    return `${state.idx}:${pathnameWithSearch}`;
  }
  return pathnameWithSearch;
}

function ensureArbitrationState(impressionKey: string) {
  if (!arbitrationState || arbitrationState.impressionKey !== impressionKey) {
    if (arbitrationState?.timer) {
      window.clearTimeout(arbitrationState.timer);
    }
    arbitrationState = {
      impressionKey,
      timer: null,
      candidate: null,
      committed: false
    };
  }
}

function commitCandidate(impressionKey: string) {
  if (!arbitrationState) return;
  if (arbitrationState.impressionKey !== impressionKey) return;
  if (arbitrationState.committed) return;
  if (!arbitrationState.candidate) return;

  const { eventName, properties } = arbitrationState.candidate;
  // After commit, this impression is locked to one broken-health event.
  trackMixpanel(eventName, properties);
  arbitrationState.committed = true;
  arbitrationState.timer = null;
}

function queueCandidate(candidate: PreparedEvent, impressionKey: string) {
  ensureArbitrationState(impressionKey);
  if (!arbitrationState || arbitrationState.committed) return;

  const current = arbitrationState.candidate;
  if (!current || candidate.priority > current.priority) {
    arbitrationState.candidate = candidate;
  }

  if (arbitrationState.timer) return;

  // Hold a short arbitration window so a higher-priority signal can upgrade
  // a lower-priority candidate detected slightly earlier in the same impression.
  arbitrationState.timer = window.setTimeout(() => {
    commitCandidate(impressionKey);
  }, BROKEN_HEALTH_ARBITRATION_WINDOW_MS);
}

export function trackBrokenHealthEvent(eventName: BrokenHealthEventName, input: BrokenHealthTrackInput = {}) {
  if (typeof window === 'undefined') return;

  const pathname = window.location.pathname || '/';
  const search = window.location.search || '';
  const pathnameWithSearch = `${pathname}${search}`;

  if (!isPublicPath(pathname)) return;
  if (eventName === '404 Viewed' && isIntentionalNotFoundPath(pathname)) return;

  const impressionKey = resolveImpressionKey(pathnameWithSearch);
  const statusCode = input.status_code ?? getDefaultStatusCode(eventName);
  const errorType = input.error_type ?? getDefaultErrorType(eventName);

  const properties = stripUndefined({
    broken_url: window.location.href,
    path: pathname,
    referrer: document.referrer || 'direct',
    page_title: document.title || '',
    route_name: input.route_name || getRouteName(pathname),
    status_code: typeof statusCode === 'number' ? statusCode : undefined,
    page_type: resolvePageType(pathname, input.page_type),
    release_version: input.release_version || getReleaseVersion(),
    content_id: input.content_id,
    content_slug: input.content_slug,
    content_type: input.content_type,
    api_name: input.api_name,
    error_message: sanitizeErrorMessage(input.error_message),
    error_type: errorType,
    boundary_source: input.boundary_source
  });

  queueCandidate(
    {
      eventName,
      priority: EVENT_PRIORITY[eventName],
      properties
    },
    impressionKey
  );
}
