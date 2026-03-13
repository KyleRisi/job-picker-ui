"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BlogPostTeaserCard } from '@/components/blog/blog-post-teaser-card';
import { CompactEpisodeRow, EpisodeCard } from '@/components/episodes-browser';
import { ViewModeToggle, VIEW_MODE_STORAGE_KEY, type ViewMode } from '@/components/view-mode-toggle';
import type { DiscoveryHubPage as DiscoveryHubPageData } from '@/lib/podcast-shared';

const LABELS: Record<string, string> = {
  topics: 'Topics',
  themes: 'Themes',
  people: 'People',
  cases: 'Cases',
  events: 'Events',
  collections: 'Collections',
  series: 'Series'
};

export function DiscoveryHubPage({
  routeKey,
  hub
}: {
  routeKey: string;
  hub: DiscoveryHubPageData;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('compact');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (stored === 'grid' || stored === 'compact') {
        setViewMode(stored);
      }
    } catch {
      // Ignore localStorage failures.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Ignore localStorage failures.
    }
  }, [viewMode]);

  return (
    <>
      <section className="full-bleed relative -mt-8 overflow-hidden bg-[var(--brand-cream)] pb-16 pt-16 text-carnival-ink md:pb-20 md:pt-20">
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-carnival-red">{LABELS[routeKey] || 'Discover'}</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{hub.term.name}</h1>
            {hub.term.description ? <p className="mt-4 max-w-2xl text-base leading-relaxed text-carnival-ink/80 sm:text-lg">{hub.term.description}</p> : null}
          </div>
        </div>
      </section>

      <section className="relative z-10 isolate">
        <div className="relative z-10 space-y-6">
          {hub.featuredEpisodes.length ? (
            <section className="rounded-3xl border-2 border-carnival-ink/15 bg-white p-6 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black text-carnival-ink">Featured episodes</h2>
                {hub.term.path ? <Link href={hub.term.path} className="text-sm font-semibold text-carnival-red underline underline-offset-2">Canonical hub URL</Link> : null}
              </div>
              <div className="mt-4 space-y-3">
                {hub.featuredEpisodes.map((episode) => (
                  <CompactEpisodeRow key={episode.id} episode={episode} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="-mt-1 space-y-3" aria-label="Latest episodes">
            {hub.relatedTerms.length ? (
              <div className="relative z-20 space-y-2">
                <h2 className="-mt-1 text-lg font-black text-carnival-ink">Related terms</h2>
                <div className="-mx-4 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex w-max gap-2">
                    {hub.relatedTerms.map((term) => (
                      term.path ? (
                        <Link
                          key={term.id}
                          href={term.path}
                          className="shrink-0 whitespace-nowrap rounded-full border border-carnival-ink/15 bg-white px-3 py-1 text-sm font-semibold text-carnival-ink hover:border-carnival-red hover:text-carnival-red"
                        >
                          {term.name}
                        </Link>
                      ) : null
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>
            {hub.latestEpisodes.length ? (
              viewMode === 'grid' ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {hub.latestEpisodes.map((episode) => (
                    <EpisodeCard key={episode.id} episode={episode} featured={false} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {hub.latestEpisodes.map((episode) => (
                    <CompactEpisodeRow key={episode.id} episode={episode} />
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-carnival-ink/65">No episodes have been assigned to this hub yet.</p>
            )}
          </section>

          {hub.relatedPosts.length ? (
            <section className="rounded-3xl border-2 border-carnival-ink/15 bg-white p-6 shadow-card">
              <h2 className="text-2xl font-black text-carnival-ink">Related blog posts</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {hub.relatedPosts.map((post) => (
                  <BlogPostTeaserCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          ) : null}

        </div>
      </section>
    </>
  );
}
