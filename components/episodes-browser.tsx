'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { type PodcastEpisode, formatEpisodeDate } from '@/lib/podcast-shared';
import { usePodcastPlayback } from '@/components/podcast-playback-provider';
import { LiveSearchInput } from '@/components/live-search-input';
import { FeaturedEpisodeShowcase } from '@/components/featured-episode-showcase';

function toExcerpt(value: string, maxLength: number): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No description available for this episode yet.';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function episodeDateLabel(episode: PodcastEpisode): string {
  return formatEpisodeDate(episode.publishedAt);
}

function episodeChipLabel(episode: PodcastEpisode): string | null {
  if (episode.episodeNumber === null) return null;
  return `Episode ${episode.episodeNumber}`;
}

function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const whole = Math.floor(totalSeconds);
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function CardAudioPlayer({
  episode
}: {
  episode: PodcastEpisode;
}) {
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const { activeEpisode, isPlaying, duration, currentTime, playEpisode, togglePlayPause, seekTo, skipBy } = usePodcastPlayback();
  const isActive = activeEpisode?.slug === episode.slug;
  const playing = isActive && isPlaying;
  const displayedCurrent = isActive ? currentTime : 0;
  const displayedDuration = isActive ? duration : 0;

  const togglePlay = async () => {
    if (!isActive) {
      await playEpisode({
        slug: episode.slug,
        title: episode.title,
        audioUrl: episode.audioUrl,
        artworkUrl: episode.artworkUrl,
        episodeNumber: episode.episodeNumber,
        publishedAt: episode.publishedAt,
        duration: episode.duration
      }, playButtonRef.current);
      return;
    }
    await togglePlayPause();
  };

  const handleSeek = (value: number) => {
    if (!isActive) return;
    seekTo(value);
  };

  const handleSkipBy = (deltaSeconds: number) => {
    if (!isActive) return;
    skipBy(deltaSeconds);
  };

  return (
    <div className={`rounded-full px-3 py-2 transition-colors ${playing ? 'bg-carnival-red text-white' : 'bg-carnival-ink/5 text-carnival-ink'}`}>
      <div className="flex items-center gap-2">
        <button
          ref={playButtonRef}
          type="button"
          onClick={togglePlay}
          className={`rounded-full px-2.5 py-1.5 text-xs font-black ${playing ? 'bg-white text-carnival-red' : 'bg-white text-carnival-ink'}`}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <span className={`w-8 text-xs font-bold ${playing ? 'text-white/90' : 'text-carnival-ink/70'}`}>{formatClock(displayedCurrent)}</span>
        <button
          type="button"
          onClick={() => handleSkipBy(-15)}
          className={`text-xs font-black ${playing ? 'text-white' : 'text-carnival-ink/75'}`}
          aria-label="Back 15 seconds"
        >
          -15
        </button>
        <input
          type="range"
          min={0}
          max={displayedDuration || 0}
          step={0.01}
          value={Math.min(displayedCurrent, displayedDuration || 0)}
          onChange={(event) => handleSeek(Number(event.target.value))}
          className={`audio-range w-full min-w-0 ${playing ? 'audio-range-on-dark' : ''}`}
          aria-label="Seek audio"
          disabled={!isActive}
        />
        <button
          type="button"
          onClick={() => handleSkipBy(30)}
          className={`text-xs font-black ${playing ? 'text-white' : 'text-carnival-ink/75'}`}
          aria-label="Forward 30 seconds"
          disabled={!isActive}
        >
          +30
        </button>
      </div>
    </div>
  );
}

export function EpisodeCard({
  episode,
  featured
}: {
  episode: PodcastEpisode;
  featured: boolean;
}) {
  const excerpt = toExcerpt(episode.description, featured ? 480 : 220);
  const episodeChip = episodeChipLabel(episode);
  const detailHref = `/episodes/${episode.slug}`;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-[0_10px_26px_rgba(0,0,0,0.10)] ${
        featured ? 'border-carnival-gold/70 ring-2 ring-carnival-gold/35' : 'border-carnival-ink/10'
      }`}
      aria-label={`Podcast episode ${episode.title}`}
    >
      <div className={featured ? 'flex flex-col gap-0 md:flex-row md:items-stretch' : 'flex h-full flex-col'}>
        <div className={featured ? 'aspect-square w-full md:w-[360px] lg:w-[420px] md:flex-none md:self-stretch' : 'aspect-square'}>
          {episode.artworkUrl ? (
            <Link href={detailHref} className="relative block h-full w-full">
              <Image
                src={episode.artworkUrl}
                alt={`Artwork for ${episode.title}`}
                fill
                sizes={
                  featured
                    ? '(max-width: 768px) 100vw, 420px'
                    : '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 380px'
                }
                className={featured ? 'object-contain bg-black' : 'object-cover'}
                unoptimized
              />
            </Link>
          ) : (
            <Link
              href={detailHref}
              className="flex h-full w-full items-center justify-center bg-carnival-ink/10 px-6 text-center text-sm font-semibold text-carnival-ink/70"
            >
              Episode artwork unavailable
            </Link>
          )}
        </div>

        <div className={`flex min-w-0 flex-1 flex-col ${featured ? 'p-6 sm:p-5' : 'p-4'}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-carnival-ink/70">{episodeDateLabel(episode)}</p>
            {episode.duration ? (
              <span className="rounded-full border border-carnival-ink/25 bg-carnival-ink/5 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-carnival-ink/75">
                {episode.duration}
              </span>
            ) : null}
          </div>
          <h2 className={`mt-2 font-black leading-tight text-carnival-ink ${featured ? 'text-3xl' : 'text-[1.35rem]'}`}>
            <Link href={detailHref} className="!text-carnival-ink !no-underline transition hover:!text-carnival-red">
              <span className="inline-flex flex-wrap items-center gap-2">
                {episodeChip ? (
                  <span className="rounded-full bg-carnival-red px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                    {episodeChip}
                  </span>
                ) : null}
                <span>{episode.title}</span>
              </span>
            </Link>
          </h2>
          <p className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed text-carnival-ink/80 ${featured ? 'line-clamp-5' : ''}`}>
            <Link href={detailHref} className="!text-inherit !no-underline transition hover:!text-carnival-red">
              {excerpt}
            </Link>
          </p>

          <div className={featured ? 'mt-4 space-y-3' : 'mt-auto pt-4 space-y-3'}>
            <CardAudioPlayer
              episode={episode}
            />

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-carnival-ink/70" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function EpisodesGrid({
  episodes,
  className = 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
}: {
  episodes: PodcastEpisode[];
  className?: string;
}) {
  return (
    <div className={className}>
      {episodes.map((episode) => (
        <EpisodeCard key={episode.slug} episode={episode} featured={false} />
      ))}
    </div>
  );
}

const INITIAL_COUNT = 12;
const LOAD_MORE_COUNT = 12;
const EPISODES_VIEW_MODE_STORAGE_KEY = 'compendium:episodes:view-mode';

type ViewMode = 'grid' | 'compact';
type SortOrder = 'newest' | 'oldest';

function isViewMode(value: string): value is ViewMode {
  return value === 'grid' || value === 'compact';
}

function byPublishedDate(order: SortOrder) {
  return (a: PodcastEpisode, b: PodcastEpisode) => {
    const aTime = new Date(a.publishedAt).getTime() || 0;
    const bTime = new Date(b.publishedAt).getTime() || 0;
    return order === 'oldest' ? aTime - bTime : bTime - aTime;
  };
}

export function CompactEpisodeRow({ episode }: { episode: PodcastEpisode }) {
  const artworkButtonRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const { activeEpisode, isPlaying, playEpisode, togglePlayPause } = usePodcastPlayback();
  const isActive = activeEpisode?.slug === episode.slug;
  const playing = isActive && isPlaying;
  const episodeChip = episodeChipLabel(episode);
  const detailHref = `/episodes/${episode.slug}`;

  const togglePlay = async (sourceElement?: HTMLElement | null) => {
    if (!isActive) {
      await playEpisode({
        slug: episode.slug,
        title: episode.title,
        audioUrl: episode.audioUrl,
        artworkUrl: episode.artworkUrl,
        episodeNumber: episode.episodeNumber,
        publishedAt: episode.publishedAt,
        duration: episode.duration
      }, sourceElement || artworkButtonRef.current);
      return;
    }
    await togglePlayPause();
  };

  const openDetails = () => {
    router.push(detailHref);
  };

  return (
    <article
      className="cursor-pointer overflow-hidden rounded-2xl border border-carnival-ink/10 bg-white shadow-[0_10px_26px_rgba(0,0,0,0.10)] transition hover:shadow-lg"
      aria-label={`Podcast episode ${episode.title}`}
      role="link"
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openDetails();
      }}
    >
      <div className="flex items-center gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-5">
        {/* Artwork column — chip sits directly above artwork on narrow screens */}
        <div className="flex flex-none flex-col items-start">
          {episodeChip ? (
            <span className="mb-1.5 inline-block rounded-full bg-carnival-red px-2.5 py-0.5 text-[11px] font-black text-white min-[450px]:hidden">
              {episodeChip}
            </span>
          ) : null}
          <div className="relative h-20 w-20 overflow-hidden rounded-xl sm:h-24 sm:w-24">
            {episode.artworkUrl ? (
              <button
                ref={artworkButtonRef}
                type="button"
                className="relative block h-full w-full"
                aria-label={playing ? 'Pause episode' : 'Play episode'}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void togglePlay(artworkButtonRef.current || event.currentTarget);
                }}
              >
                <Image
                  src={episode.artworkUrl}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                />
              </button>
            ) : (
              <button
                ref={artworkButtonRef}
                type="button"
                className="h-full w-full bg-carnival-ink/10"
                aria-label={playing ? 'Pause episode' : 'Play episode'}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void togglePlay(artworkButtonRef.current || event.currentTarget);
                }}
              />
            )}
            {/* Play button overlaid on artwork — mobile only */}
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void togglePlay(artworkButtonRef.current || event.currentTarget);
              }}
              className={`absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-lg transition sm:hidden ${
                playing ? 'bg-carnival-red/90' : 'bg-carnival-red hover:bg-carnival-red/80'
              }`}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="ml-0.5 h-3 w-3 fill-current"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Desktop play button — separate from artwork */}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void togglePlay(artworkButtonRef.current || event.currentTarget);
          }}
          className={`hidden h-14 w-14 flex-none items-center justify-center rounded-full text-white shadow-md transition sm:flex ${
            playing ? 'bg-carnival-red/90' : 'bg-carnival-red hover:bg-carnival-red/80'
          }`}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-carnival-ink/60">
              {episodeDateLabel(episode)}
              {episode.duration ? <> &middot; {episode.duration}</> : null}
            </p>
            {/* Episode chip inline with date — hidden below 450px */}
            {episodeChip ? (
              <span className="hidden flex-none rounded-full bg-carnival-red px-2.5 py-0.5 text-[11px] font-black text-white min-[450px]:inline-block">
                {episodeChip}
              </span>
            ) : null}
          </div>
          <h2 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-carnival-ink min-[450px]:text-lg sm:text-xl">
            <Link href={detailHref} className="transition hover:text-carnival-red">
              {episode.title}
            </Link>
          </h2>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-carnival-ink/75 sm:text-sm">
            {toExcerpt(episode.description, 200)}
          </p>
        </div>
      </div>
    </article>
  );
}

function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-carnival-ink/15 bg-white p-1" role="radiogroup" aria-label="View mode">
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'grid'}
        aria-label="Grid view"
        className={`flex h-7 w-7 items-center justify-center rounded-md transition ${mode === 'grid' ? 'bg-carnival-ink text-white' : 'text-carnival-ink/50 hover:text-carnival-ink'}`}
        onClick={() => onChange('grid')}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'compact'}
        aria-label="Compact list view"
        className={`flex h-7 w-7 items-center justify-center rounded-md transition ${mode === 'compact' ? 'bg-carnival-ink text-white' : 'text-carnival-ink/50 hover:text-carnival-ink'}`}
        onClick={() => onChange('compact')}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function SortOrderToggle({ order, onChange }: { order: SortOrder; onChange: (o: SortOrder) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-carnival-ink/15 bg-white p-1" role="radiogroup" aria-label="Sort episodes">
      <button
        type="button"
        role="radio"
        aria-checked={order === 'oldest'}
        className={`flex h-7 items-center rounded-md px-3 text-xs font-black uppercase tracking-wide transition ${
          order === 'oldest' ? 'bg-carnival-ink text-white' : 'text-carnival-ink/60 hover:text-carnival-ink'
        }`}
        onClick={() => onChange('oldest')}
      >
        Oldest
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={order === 'newest'}
        className={`flex h-7 items-center rounded-md px-3 text-xs font-black uppercase tracking-wide transition ${
          order === 'newest' ? 'bg-carnival-ink text-white' : 'text-carnival-ink/60 hover:text-carnival-ink'
        }`}
        onClick={() => onChange('newest')}
      >
        Newest
      </button>
    </div>
  );
}

export function EpisodesBrowser({ episodes, showSearch = true, initialCount = INITIAL_COUNT, loadMoreCount = LOAD_MORE_COUNT, middleSlot }: { episodes: PodcastEpisode[]; showSearch?: boolean; initialCount?: number; loadMoreCount?: number; middleSlot?: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [viewModeReady, setViewModeReady] = useState(false);

  const handleSortOrderChange = (nextOrder: SortOrder) => {
    if (nextOrder === sortOrder) return;
    if (typeof window === 'undefined') {
      setSortOrder(nextOrder);
      return;
    }

    const previousY = window.scrollY;
    setSortOrder(nextOrder);
    requestAnimationFrame(() => {
      window.scrollTo(0, previousY);
      requestAnimationFrame(() => {
        window.scrollTo(0, previousY);
      });
    });
  };

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(EPISODES_VIEW_MODE_STORAGE_KEY);
      if (stored && isViewMode(stored)) {
        setViewMode(stored);
      }
    } catch {
      // Ignore localStorage failures.
    } finally {
      setViewModeReady(true);
    }
  }, []);

  useEffect(() => {
    if (!viewModeReady) return;
    try {
      window.localStorage.setItem(EPISODES_VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Ignore localStorage failures.
    }
  }, [viewMode, viewModeReady]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredEpisodes = useMemo(() => {
    const sortedEpisodes = [...episodes].sort(byPublishedDate(sortOrder));
    if (!normalizedQuery) return sortedEpisodes;
    return sortedEpisodes.filter((episode) => {
      const inTitle = episode.title.toLowerCase().includes(normalizedQuery);
      const inEpisodeNumber = episode.episodeNumber !== null && `${episode.episodeNumber}`.includes(normalizedQuery);
      return inTitle || inEpisodeNumber;
    });
  }, [episodes, normalizedQuery, sortOrder]);

  const featuredEpisode = useMemo(() => {
    if (normalizedQuery) return null;
    if (!filteredEpisodes.length) return null;
    return [...filteredEpisodes].sort(byPublishedDate('newest'))[0] ?? null;
  }, [filteredEpisodes, normalizedQuery]);

  const allStandardEpisodes = featuredEpisode
    ? filteredEpisodes.filter((episode) => episode.slug !== featuredEpisode.slug)
    : filteredEpisodes;
  const isSearching = !!normalizedQuery;
  const standardEpisodes = isSearching ? allStandardEpisodes : allStandardEpisodes.slice(0, visibleCount);
  const hasMore = !isSearching && visibleCount < allStandardEpisodes.length;

  const searchPanel = (
    <LiveSearchInput
      id="episode-search"
      value={query}
      onChange={setQuery}
      placeholder="Search episodes"
      ariaLabel="Search episodes"
    />
  );

  return (
    <section className="space-y-6" aria-label="All podcast episodes">
      {filteredEpisodes.length === 0 ? (
        <>
          {showSearch ? searchPanel : null}
          <p className="rounded-xl border border-carnival-ink/15 bg-white p-6 text-center font-semibold text-carnival-ink/75">
            No episodes matched that search.
          </p>
        </>
      ) : (
        <>
          {featuredEpisode ? (
            <FeaturedEpisodeShowcase heading="Latest Episode">
              <EpisodeCard
                episode={featuredEpisode}
                featured
              />
            </FeaturedEpisodeShowcase>
          ) : null}

          {middleSlot}

          <section className="space-y-3" aria-label="Episode list">
            <div className="flex flex-col gap-3 pt-6 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
              {featuredEpisode ? (
                <h3 className="text-xl font-black text-carnival-ink">Full Catalogue</h3>
              ) : (
                <p className="text-sm font-bold text-carnival-ink/60">
                  {filteredEpisodes.length} result{filteredEpisodes.length !== 1 ? 's' : ''}
                </p>
              )}
              <div className="flex w-full items-center justify-between gap-2 min-[480px]:w-auto min-[480px]:justify-end">
                <SortOrderToggle order={sortOrder} onChange={handleSortOrderChange} />
                <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              </div>
            </div>
            {showSearch ? searchPanel : null}

            {viewMode === 'grid' ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {standardEpisodes.map((episode) => (
                  <EpisodeCard
                    key={episode.slug}
                    episode={episode}
                    featured={false}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {standardEpisodes.map((episode) => (
                  <CompactEpisodeRow key={episode.slug} episode={episode} />
                ))}
              </div>
            )}

            {hasMore ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  className="rounded-xl bg-carnival-red px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-card transition hover:brightness-110"
                  onClick={() => setVisibleCount((c) => c + loadMoreCount)}
                >
                  Load More Episodes
                </button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </section>
  );
}
