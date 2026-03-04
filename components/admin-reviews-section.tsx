'use client';

import { useState } from 'react';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminReviewsForm } from '@/components/forms/admin-reviews-form';

export function AdminReviewsSection({ showBypassBanner }: { showBypassBanner: boolean }) {
  const [viewCount, setViewCount] = useState(0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black">Reviews</h1>
          <span className="rounded-full bg-carnival-red px-3 py-1 text-sm font-bold text-white">
            {viewCount}
          </span>
        </div>
        <AdminTabs current="reviews" />
      </div>
      {showBypassBanner ? (
        <p className="rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
      ) : null}
      <AdminReviewsForm onTotalChange={setViewCount} />
    </section>
  );
}
