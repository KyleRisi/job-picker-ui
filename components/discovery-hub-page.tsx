"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BlogPostCard } from '@/components/blog/blog-post-card';
import { CompactPagination } from '@/components/compact-pagination';
import { CompactEpisodeRow, GridEpisodeCard } from '@/components/episodes-browser';
import { JoinPatreonCta } from '@/components/join-patreon-cta';
import { ViewModeToggle, VIEW_MODE_STORAGE_KEY, type ViewMode } from '@/components/view-mode-toggle';
import { pageHref } from '@/lib/pagination';
import type { DiscoveryHubPage as DiscoveryHubPageData } from '@/lib/podcast-shared';
import { resolveHubIntroText } from '@/lib/seo-page-copy';
import { trackBrokenHealthEvent } from '@/lib/mixpanel-broken-health';

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
  const hasUnexpectedMissingPrimaryContent =
    hub.pagination.page === 1 &&
    hub.pagination.total > 0 &&
    hub.latestEpisodes.length === 0;

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

  useEffect(() => {
    if (!hasUnexpectedMissingPrimaryContent) return;
    trackBrokenHealthEvent('Soft 404 Viewed', {
      content_id: hub.term.id,
      content_slug: hub.term.slug,
      content_type: routeKey,
      error_type: 'content_missing',
      error_message: 'Discovery hub expected episode content but primary listing was empty.'
    });
  }, [hasUnexpectedMissingPrimaryContent, hub.term.id, hub.term.slug, routeKey]);

  const basePath = hub.term.path || `/${routeKey}/${hub.term.slug}`;
  const hrefForPage = (page: number) => pageHref(basePath, page);
  const introText = resolveHubIntroText(hub);

  return (
    <>
      <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink pb-16 pt-16 text-white md:pb-20 md:pt-20">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-32 -top-24 h-96 w-96 rounded-full bg-carnival-red/30 blur-[120px]" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-carnival-gold">{LABELS[routeKey] || 'Discover'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-[36px] font-black leading-tight tracking-tight text-white sm:text-[48px]">{hub.term.name}</h1>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-carnival-red px-3 text-sm font-black text-white">
                {hub.pagination.total}
              </span>
            </div>
            {introText ? <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-white/90 md:text-[18px]">{introText}</p> : null}
            {hub.relatedTerms.length ? (
              <div className="mt-8">
                <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-white/75">Related Terms</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {hub.relatedTerms.map((term) => (
                    term.path ? (
                      <Link
                        key={term.id}
                        href={term.path}
                        className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-semibold text-white hover:bg-white/15"
                      >
                        {term.name}
                      </Link>
                    ) : null
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative z-10 isolate pt-6 md:pt-8">
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
            <div className="flex justify-end">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>
            {hub.latestEpisodes.length ? (
              viewMode === 'grid' ? (
                <div className="grid gap-4 min-[600px]:grid-cols-2 min-[1000px]:grid-cols-3">
                  {hub.latestEpisodes.map((episode) => (
                    <GridEpisodeCard key={episode.id} episode={episode} />
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
            {hub.pagination.totalPages > 1 ? (
              <CompactPagination
                page={hub.pagination.page}
                totalPages={hub.pagination.totalPages}
                hrefForPage={hrefForPage}
                ariaLabel="Taxonomy pagination"
                className="pt-4"
              />
            ) : null}
          </section>

          {hub.relatedPosts.length ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-black text-carnival-ink">Related blog posts</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {hub.relatedPosts.map((post) => (
                  <BlogPostCard
                    key={post.id}
                    compact
                    post={{
                      id: post.id,
                      slug: post.slug,
                      title: post.title,
                      excerpt: post.excerpt,
                      excerpt_auto: post.excerpt,
                      published_at: post.publishedAt,
                      reading_time_minutes: post.readingTimeMinutes,
                      featured_image: post.featuredImage
                        ? {
                            storage_path: post.featuredImage.storagePath,
                            alt_text_default: post.featuredImage.altText
                          }
                        : null,
                      taxonomies: {
                        categories: [
                          {
                            id: hub.term.id,
                            name: hub.term.name,
                            slug: hub.term.slug
                          }
                        ]
                      },
                      author: post.author
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}

        </div>
      </section>

      <div className="-mb-8 pt-8">
        <JoinPatreonCta />
      </div>
    </>
  );
}
