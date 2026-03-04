'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { PodcastEpisode, formatEpisodeDate } from '@/lib/podcast';

type SortMode = 'newest' | 'oldest' | 'title';
const PAGE_SIZE = 50;

function toExcerpt(value: string, maxLength: number): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No description available.';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function AdminEpisodesTable({
  episodes,
  onFilteredCountChange
}: {
  episodes: PodcastEpisode[];
  onFilteredCountChange?: (count: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [page, setPage] = useState(1);

  const years = useMemo(() => {
    const unique = new Set<string>();
    episodes.forEach((episode) => {
      const parsed = new Date(episode.publishedAt);
      if (Number.isNaN(parsed.getTime())) return;
      unique.add(`${parsed.getUTCFullYear()}`);
    });
    return Array.from(unique).sort((a, b) => Number(b) - Number(a));
  }, [episodes]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredRows = episodes.filter((episode) => {
      if (yearFilter !== 'all') {
        const parsed = new Date(episode.publishedAt);
        if (Number.isNaN(parsed.getTime())) return false;
        if (`${parsed.getUTCFullYear()}` !== yearFilter) return false;
      }

      if (!normalizedQuery) return true;

      const inTitle = episode.title.toLowerCase().includes(normalizedQuery);
      const inNumber = episode.episodeNumber !== null && `${episode.episodeNumber}`.includes(normalizedQuery);
      return inTitle || inNumber;
    });

    const sortedRows = [...filteredRows];
    if (sortMode === 'title') {
      sortedRows.sort((a, b) => a.title.localeCompare(b.title));
      return sortedRows;
    }

    sortedRows.sort((a, b) => {
      const aTime = new Date(a.publishedAt).getTime();
      const bTime = new Date(b.publishedAt).getTime();
      if (sortMode === 'oldest') return aTime - bTime;
      return bTime - aTime;
    });
    return sortedRows;
  }, [episodes, query, sortMode, yearFilter]);

  useEffect(() => {
    onFilteredCountChange?.(filtered.length);
  }, [filtered.length, onFilteredCountChange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [query, yearFilter, sortMode]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="label min-w-[220px] flex-1">
          Search
          <input
            className="input mt-1"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title or episode number"
          />
        </label>

        <label className="label">
          Year
          <select
            className="input mt-1"
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
          >
            <option value="all">All years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          Sort
          <select
            className="input mt-1"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A-Z</option>
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {paged.map((episode) => {
          const description = toExcerpt(episode.description, 200);
          const episodeLabel = `Episode ${episode.episodeNumber ?? '-'}`;
          const detailHref = `/episodes/${episode.slug}`;

          return (
            <article key={episode.id} className="rounded-2xl border border-carnival-ink/12 bg-white p-3 shadow-card sm:p-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="h-20 w-20 flex-none overflow-hidden rounded-xl bg-carnival-ink/10 sm:h-24 sm:w-24">
                  {episode.artworkUrl ? (
                    <Image
                      src={episode.artworkUrl}
                      alt={`Artwork for ${episode.title}`}
                      width={96}
                      height={96}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-carnival-red px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                      {episodeLabel}
                    </span>
                    <p className="text-xs font-black uppercase tracking-wide text-carnival-ink/60">
                      {formatEpisodeDate(episode.publishedAt)}
                      {episode.duration ? ` · ${episode.duration}` : ''}
                    </p>
                  </div>

                  <h3 className="mt-1 text-sm font-bold leading-tight text-carnival-ink sm:text-xl sm:leading-tight">
                    <Link href={detailHref} className="transition hover:text-carnival-red">
                      {episode.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-carnival-ink/75 sm:text-sm">
                    {description}
                  </p>
                </div>
              </div>
            </article>
          );
        })}

        {!paged.length ? (
          <p className="rounded-md border border-carnival-ink/15 bg-white p-4 text-sm">
            No episodes found for the selected filters.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          Showing {(page - 1) * PAGE_SIZE + (paged.length ? 1 : 0)}-{(page - 1) * PAGE_SIZE + paged.length} of {filtered.length} filtered episodes
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </button>
          <span className="text-sm font-semibold">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
