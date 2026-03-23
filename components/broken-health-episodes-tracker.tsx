'use client';

import { useEffect } from 'react';
import { trackBrokenHealthEvent } from '@/lib/mixpanel-broken-health';

export function BrokenHealthEpisodesTracker({
  hasCriticalApiFailure,
  hasUnexpectedMissingPrimaryContent
}: {
  hasCriticalApiFailure: boolean;
  hasUnexpectedMissingPrimaryContent: boolean;
}) {
  useEffect(() => {
    if (!hasCriticalApiFailure) return;

    trackBrokenHealthEvent('Critical API Failed', {
      api_name: 'getEpisodesLandingPageData',
      content_type: 'episode',
      error_type: 'api_failure'
    });
  }, [hasCriticalApiFailure]);

  useEffect(() => {
    if (!hasUnexpectedMissingPrimaryContent) return;

    trackBrokenHealthEvent('Soft 404 Viewed', {
      content_type: 'episode',
      error_type: 'content_missing',
      error_message: 'Episodes page rendered without expected primary episode content.'
    });
  }, [hasUnexpectedMissingPrimaryContent]);

  return null;
}
