'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CompactPagination } from '@/components/compact-pagination';
import { CompactEpisodeRow, EpisodeCard } from '@/components/episodes-browser';
import type { AuthorEpisodeListItem } from '@/lib/episodes';

function parsePage(value: string | null, maxPages: number) {
  const parsed = Number.parseInt(`${value || '1'}`, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, Math.max(1, maxPages));
}

function buildEpisodesHref(authorSlug: string, page: number, view: 'grid' | 'compact') {
  const query = new URLSearchParams();
  query.set('tab', 'episodes');
  if (page > 1) query.set('page', `${page}`);
  if (view === 'grid') query.set('view', 'grid');
  return `/author/${authorSlug}?${query.toString()}`;
}

export function AuthorHubQueryRenderer({
  authorSlug,
  episodes,
  pageSize
}: {
  authorSlug: string;
  episodes: AuthorEpisodeListItem[];
  pageSize: number;
}) {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') === 'blogs' ? 'blogs' : 'episodes';
  const view = searchParams.get('view') === 'grid' ? 'grid' : 'compact';
  const totalPages = Math.max(1, Math.ceil(episodes.length / pageSize));
  const page = parsePage(searchParams.get('page'), totalPages);
  const isCanonicalEpisodeState = tab === 'episodes' && view === 'compact' && page === 1;

  const pageEpisodes = useMemo(() => {
    const pageStart = (page - 1) * pageSize;
    return episodes.slice(pageStart, pageStart + pageSize);
  }, [episodes, page, pageSize]);

  if (tab !== 'episodes' || isCanonicalEpisodeState) return null;

  return (
    <div data-author-episodes-query-renderer="true" className="space-y-3">
      <div className="flex justify-end">
        <div className="flex items-center gap-1 rounded-lg border border-carnival-ink/15 bg-white p-1" role="radiogroup" aria-label="View mode">
          <Link
            href={buildEpisodesHref(authorSlug, page, 'grid')}
            role="radio"
            aria-checked={view === 'grid'}
            aria-label="Grid view"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
              view === 'grid' ? 'bg-carnival-ink text-white' : 'text-carnival-ink/50 hover:text-carnival-ink'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </Link>
          <Link
            href={buildEpisodesHref(authorSlug, page, 'compact')}
            role="radio"
            aria-checked={view === 'compact'}
            aria-label="Compact list view"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
              view === 'compact' ? 'bg-carnival-ink text-white' : 'text-carnival-ink/50 hover:text-carnival-ink'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </Link>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pageEpisodes.map((episode) => (
            <EpisodeCard key={episode.id} episode={episode} featured={false} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {pageEpisodes.map((episode) => (
            <CompactEpisodeRow key={episode.id} episode={episode} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <CompactPagination
          page={page}
          totalPages={totalPages}
          hrefForPage={(nextPage) => buildEpisodesHref(authorSlug, nextPage, view)}
          ariaLabel="Episodes pagination"
          className="pt-4"
        />
      ) : null}
    </div>
  );
}
