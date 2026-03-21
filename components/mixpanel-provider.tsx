'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initMixpanel, trackMixpanel } from '@/lib/mixpanel-browser';
import { routeVisitStorageKey } from '@/lib/analytics-events';

function currentUserId(): string | null {
  return null;
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
      trackMixpanel('Error', {
        error_type: 'client',
        error_message: event.message || 'Unknown client error',
        error_code: '',
        page_url: window.location.href,
        user_id: currentUserId()
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
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
      page_path: path
    });
  }, [pathname, searchParams]);

  return null;
}
