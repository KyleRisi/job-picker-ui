'use client';

import { useEffect } from 'react';
import { trackMixpanel } from '@/lib/mixpanel-browser';
import { routeVisitStorageKey, shouldTrackOncePerSession } from '@/lib/analytics-events';

export function JobsListingsViewedTracker({ listingCount }: { listingCount: number }) {
  useEffect(() => {
    const key = routeVisitStorageKey('mixpanel:jobs:listings_viewed');
    if (!shouldTrackOncePerSession(key)) return;
    trackMixpanel('Job Listings Viewed', {
      listing_count: listingCount,
      source_page_type: 'jobs_page',
      source_page_path: `${window.location.pathname}${window.location.search || ''}`
    });
  }, [listingCount]);

  return null;
}

export function JobPageViewedTracker({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  useEffect(() => {
    const key = routeVisitStorageKey('mixpanel:jobs:job_viewed');
    if (!shouldTrackOncePerSession(key)) return;
    trackMixpanel('Job Page Viewed', {
      job_id: jobId,
      job_title: jobTitle,
      source_page_type: 'job_page',
      source_page_path: `${window.location.pathname}${window.location.search || ''}`
    });
  }, [jobId, jobTitle]);

  return null;
}
