'use client';

import Link from 'next/link';

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#efb3b3] bg-[#fff4f4] p-6 text-[#7f1d1d]">
      <h2 className="text-2xl font-black">Admin panel hit an error</h2>
      <p className="mt-2 text-sm font-medium">
        {error?.message || 'Something went wrong while loading this section.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/admin" className="btn-secondary">
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
