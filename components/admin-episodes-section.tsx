'use client';

import { useState } from 'react';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminEpisodesTable } from '@/components/forms/admin-episodes-table';
import type { PodcastEpisode } from '@/lib/podcast';

export function AdminEpisodesSection({
  episodes,
  showBypassBanner,
  feedError
}: {
  episodes: PodcastEpisode[];
  showBypassBanner: boolean;
  feedError: string;
}) {
  const [viewCount, setViewCount] = useState(episodes.length);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black">Episodes</h1>
          <span className="rounded-full bg-carnival-red px-3 py-1 text-sm font-bold text-white">
            {viewCount}
          </span>
        </div>
        <AdminTabs current="episodes" />
      </div>
      {showBypassBanner ? (
        <p className="rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
      ) : null}
      {feedError ? (
        <p className="rounded-md border border-carnival-red/30 bg-carnival-red/10 p-3 font-semibold">{feedError}</p>
      ) : null}
      <AdminEpisodesTable episodes={episodes} onFilteredCountChange={setViewCount} />
    </section>
  );
}
