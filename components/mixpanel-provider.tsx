'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initMixpanel, trackMixpanel } from '@/lib/mixpanel-browser';

function currentUserId(): string | null {
  return null;
}

export function MixpanelProvider() {
  const initializedRef = useRef(false);
  const pathname = usePathname();
  const lastTrackedPathRef = useRef('');

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
    if (!initializedRef.current) return;
    if (typeof window === 'undefined') return;

    const routeKey = `${pathname}${window.location.search || ''}`;
    if (!routeKey || routeKey === lastTrackedPathRef.current) return;
    lastTrackedPathRef.current = routeKey;

    trackMixpanel('Page View', {
      page_url: window.location.href,
      page_title: document.title,
      user_id: currentUserId()
    });
  }, [pathname]);

  return null;
}
