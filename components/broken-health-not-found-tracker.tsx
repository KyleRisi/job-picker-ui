'use client';

import { useEffect } from 'react';
import { trackBrokenHealthEvent } from '@/lib/mixpanel-broken-health';

export function BrokenHealthNotFoundTracker() {
  useEffect(() => {
    trackBrokenHealthEvent('404 Viewed', {
      status_code: 404,
      error_type: 'not_found'
    });
  }, []);

  return null;
}
