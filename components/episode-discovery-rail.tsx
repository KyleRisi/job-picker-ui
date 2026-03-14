'use client';

import Link from 'next/link';
import { EpisodeCard } from '@/components/episodes-browser';
import type { PodcastEpisode } from '@/lib/podcast-shared';

const DESKTOP_INITIAL_VISIBLE_COUNT = 6;

export function EpisodeDiscoveryRail({
  title,
  href,
  episodes
}: {
  title: string;
  href: string;
  episodes: PodcastEpisode[];
}) {
  if (!episodes.length) return null;

  const desktopEpisodes = episodes.slice(0, DESKTOP_INITIAL_VISIBLE_COUNT);

  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-carnival-ink sm:text-3xl">{title}</h2>
        <Link
          href={href}
          className="inline-flex flex-none items-center gap-2 text-sm font-black uppercase tracking-wide text-carnival-red transition hover:opacity-80 xl:hidden"
        >
          See All
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-visible xl:hidden">
        <div className="-my-3 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex snap-x snap-mandatory gap-4 pl-[max(1rem,calc((100vw-72rem)/2+1rem))]">
            {episodes.map((episode) => (
              <div key={episode.id} className="w-[320px] min-w-[320px] snap-start sm:w-[340px] sm:min-w-[340px] lg:w-[380px] lg:min-w-[380px]">
                <EpisodeCard episode={episode} featured={false} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden space-y-4 xl:block">
        <div className="grid grid-cols-3 justify-between gap-4">
          {desktopEpisodes.map((episode) => (
            <div key={episode.id} className="w-[360px]">
              <EpisodeCard episode={episode} featured={false} />
            </div>
          ))}
        </div>

        {episodes.length > DESKTOP_INITIAL_VISIBLE_COUNT ? (
          <div className="flex justify-center pt-2">
            <Link
              href={href}
              className="inline-flex items-center justify-center rounded-full bg-carnival-red px-5 py-2.5 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110"
            >
              See All
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
