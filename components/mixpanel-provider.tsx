'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initMixpanel, trackMixpanel } from '@/lib/mixpanel-browser';
import { isPublicAnalyticsPath, routeVisitStorageKey } from '@/lib/analytics-events';
import { trackBrokenHealthEvent } from '@/lib/mixpanel-broken-health';
import { inferHomepageV2EnvironmentFromWindowLocation } from '@/lib/homepage-v2/env';
import { HOMEPAGE_V2_PAGE_VERSION, resolveHomepageV2DeviceTypeFromWindow } from '@/lib/homepage-v2/tracking';

function currentUserId(): string | null {
  return null;
}

const STRICT_ROUTE_FAILURE_PATTERNS: RegExp[] = [
  /\bchunkloaderror\b/i,
  /loading chunk [\w-]+ failed/i,
  /loading css chunk [\w-]+ failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /abort fetching component for route/i
];

function textFromUnknownError(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Error) {
    return `${value.name || 'Error'}: ${value.message || ''}\n${value.stack || ''}`.trim();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isStrictRouteFailureSignal(details: string): boolean {
  const normalized = `${details || ''}`.trim();
  if (!normalized) return false;
  if (STRICT_ROUTE_FAILURE_PATTERNS.some((pattern) => pattern.test(normalized))) return true;

  const lower = normalized.toLowerCase();
  if (lower.includes('/_next/static/chunks/') && /(failed|error|missing|not found)/i.test(normalized)) {
    return true;
  }

  return false;
}

function maybeTrackRouteLoadFailure(details: string) {
  if (!isStrictRouteFailureSignal(details)) return;
  trackBrokenHealthEvent('Route Load Failed', {
    error_type: 'route_error',
    error_message: details
  });
}

export function MixpanelProvider() {
  const initializedRef = useRef(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (initializedRef.current) return;
    initMixpanel();
    initializedRef.current = true;

    const onError = (event: ErrorEvent) => {
      if (!isPublicAnalyticsPath(window.location.pathname)) return;
      const details = `${event.message || ''}\n${event.filename || ''}\n${event.error ? textFromUnknownError(event.error) : ''}`.trim();
      trackMixpanel('Error', {
        error_type: 'client',
        error_message: event.message || 'Unknown client error',
        error_code: '',
        page_url: window.location.href,
        user_id: currentUserId()
      });
      maybeTrackRouteLoadFailure(details);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isPublicAnalyticsPath(window.location.pathname)) return;
      const reason = event.reason;
      const reasonDetails = textFromUnknownError(reason);
      const message =
        typeof reason === 'string'
          ? reason
          : reason instanceof Error
            ? reason.message
            : 'Unhandled promise rejection';

      trackMixpanel('Error', {
        error_type: 'unhandledrejection',
        error_message: message,
        error_code: '',
        page_url: window.location.href,
        user_id: currentUserId()
      });
      maybeTrackRouteLoadFailure(reasonDetails);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pathname) return;
    if (!isPublicAnalyticsPath(pathname)) return;
    const search = searchParams?.toString() || '';
    const path = `${pathname || '/'}${search ? `?${search}` : ''}`;
    const dedupeKey = routeVisitStorageKey(`mixpanel:page_view:${path}`);
    try {
      if (window.sessionStorage.getItem(dedupeKey) === '1') return;
      window.sessionStorage.setItem(dedupeKey, '1');
    } catch {
      // Ignore sessionStorage failures and continue tracking.
    }

    trackMixpanel('Page View', {
      page_title: document.title || '',
      page_url: window.location.href,
      page_path: path,
      ...(() => {
        const isHomepageV2Path = pathname === '/preview/homepage-v2' || pathname === '/';
        const hasHomepageV2Marker = Boolean(document.querySelector('[data-homepage-v2-root="true"]'));
        if (!isHomepageV2Path || !hasHomepageV2Marker) return {};
        return {
          page_version: HOMEPAGE_V2_PAGE_VERSION,
          environment: inferHomepageV2EnvironmentFromWindowLocation(),
          device_type: resolveHomepageV2DeviceTypeFromWindow()
        };
      })()
    });
  }, [pathname, searchParams]);

  return null;
}
