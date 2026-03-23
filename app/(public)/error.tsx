'use client';

import { useEffect } from 'react';
import { trackBrokenHealthEvent } from '@/lib/mixpanel-broken-health';

export default function PublicError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    trackBrokenHealthEvent('500 Error Page Viewed', {
      status_code: 500,
      error_type: 'server_error',
      boundary_source: 'public_segment',
      error_message: error?.message || 'Public route error boundary rendered.'
    });
  }, [error]);

  return (
    <section className="mx-auto my-10 max-w-3xl rounded-2xl border border-carnival-red/35 bg-carnival-red/10 p-6 text-carnival-ink">
      <h1 className="text-2xl font-black">Something went wrong</h1>
      <p className="mt-3 text-sm font-medium text-carnival-ink/80">
        This page hit an error while loading. You can try again.
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-5">
        Try again
      </button>
    </section>
  );
}
