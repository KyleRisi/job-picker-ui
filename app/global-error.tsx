'use client';

import { useEffect } from 'react';
import { trackBrokenHealthEvent } from '@/lib/mixpanel-broken-health';

export default function GlobalError({
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
      boundary_source: 'global',
      error_message: error?.message || 'Global error boundary rendered.'
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <section className="mx-auto my-10 max-w-3xl rounded-2xl border border-carnival-red/35 bg-carnival-red/10 p-6 text-carnival-ink">
          <h1 className="text-2xl font-black">Unexpected application error</h1>
          <p className="mt-3 text-sm font-medium text-carnival-ink/80">
            A global error occurred. Try reloading this view.
          </p>
          <button type="button" onClick={reset} className="btn-primary mt-5">
            Try again
          </button>
        </section>
      </body>
    </html>
  );
}
