'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { type PodcastEpisode, formatEpisodeDate } from '@/lib/podcast-shared';
import { usePodcastPlayback } from '@/components/podcast-playback-provider';
import { LiveSearchInput } from '@/components/live-search-input';
import { FeaturedEpisodeShowcase } from '@/components/featured-episode-showcase';
import { ViewModeToggle, VIEW_MODE_STORAGE_KEY, type ViewMode } from '@/components/view-mode-toggle';
import { CompactPagination } from '@/components/compact-pagination';
import { trackMixpanel } from '@/lib/mixpanel-browser';
import { pageHref } from '@/lib/pagination';
import { PATREON_INTERNAL_PATH } from '@/lib/patreon-links';
import { isTaxonomyPublicDisplayable } from '@/lib/taxonomy-route-policy';

function toExcerpt(value: string, maxLength: number): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No description available for this episode yet.';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function episodeDateLabel(episode: PodcastEpisode): string {
  return formatEpisodeDate(episode.publishedAt);
}

function getSpotifyEpisodeUrl(title: string): string {
  const query = encodeURIComponent(`${title} The Compendium Podcast`);
  return `https://open.spotify.com/search/${query}`;
}

function getApplePodcastsEpisodeUrl(title: string): string {
  const query = encodeURIComponent(`${title} The Compendium Podcast`);
  return `https://podcasts.apple.com/us/search?term=${query}`;
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
  featured,
  featuredDesktopTextLarger = false,
  taxonomyChips,
  showInlinePlayer = true
}: {
  episode: PodcastEpisode;
  featured: boolean;
  featuredDesktopTextLarger?: boolean;
  taxonomyChips?: Array<{ id: string; name: string; path: string | null; publicDisplayable?: boolean }>;
  showInlinePlayer?: boolean;
}) {
  const excerpt = toExcerpt(episode.description, featured ? 480 : 220);
  const detailHref = `/episodes/${episode.slug}`;
  const spotifyEpisodeUrl = getSpotifyEpisodeUrl(episode.title);
  const applePodcastsEpisodeUrl = getApplePodcastsEpisodeUrl(episode.title);
  const visibleTaxonomyChips = useMemo(
    () => (taxonomyChips || []).filter((chip) => chip.publicDisplayable && chip.path),
    [taxonomyChips]
  );

  return (
    <article
      className={`h-full overflow-hidden rounded-2xl border bg-white ${
        featured ? 'border-carnival-gold/70 ring-2 ring-carnival-gold/35' : 'border-carnival-ink/10'
      }`}
      aria-label={`Podcast episode ${episode.title}`}
    >
      <div className={featured ? 'flex flex-col gap-0 sm:flex-row sm:items-stretch' : 'flex h-full flex-col'}>
        <div className={featured ? 'aspect-square w-full sm:w-[360px] lg:w-[420px] sm:flex-none sm:self-stretch' : 'aspect-square'}>
          {episode.artworkUrl ? (
            <Link href={detailHref} className="relative block h-full w-full">
              {featured ? (
                <>
                  <div className="absolute inset-0 overflow-hidden bg-black">
                    <Image
                      src={episode.artworkUrl}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 420px"
                      className="scale-110 object-cover opacity-70 blur-xl"
                      aria-hidden="true"
                    />
                    <div className="absolute inset-0 bg-carnival-ink/35" />
                  </div>
                  <Image
                    src={episode.artworkUrl}
                    alt={`Artwork for ${episode.title}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 420px"
                    className="relative z-10 object-contain"
                  />
                </>
              ) : (
                <Image
                  src={episode.artworkUrl}
                  alt={`Artwork for ${episode.title}`}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 380px"
                  className="object-cover"
                />
              )}
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
          {featured ? (
            <div className="flex w-full items-center justify-between gap-3 text-xs font-black uppercase tracking-wide text-carnival-ink/70">
              {episode.episodeNumber !== null ? (
                <span className="inline-flex w-fit rounded-full bg-carnival-red px-2.5 py-1 text-[11px] font-semibold text-white">
                  EPISODE {episode.episodeNumber}
                </span>
              ) : (
                <span />
              )}
              <p className="text-right">{episodeDateLabel(episode)}</p>
            </div>
          ) : (
          <div className={featured ? 'flex items-center gap-2' : 'flex w-full items-center justify-between gap-2 pb-1'}>
            <p className="text-xs font-bold uppercase tracking-wide text-carnival-ink/70">{episodeDateLabel(episode)}</p>
            {!featured && episode.episodeNumber !== null ? (
              <span className="rounded-full bg-carnival-red px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Episode {episode.episodeNumber}
              </span>
            ) : null}
          </div>
          )}
          <h2
            className={`mt-2 font-black leading-tight text-carnival-ink ${
              featured
                ? featuredDesktopTextLarger
                  ? 'text-[1.2rem] md:text-[1.85rem] lg:text-[2.1rem]'
                  : 'text-[1.2rem]'
                : 'min-h-[3.2rem] text-[1.2rem]'
            }`}
          >
            <Link href={detailHref} className="!text-carnival-ink !no-underline transition hover:!text-carnival-red">
              <span>{episode.title}</span>
            </Link>
          </h2>
          <p
            className={`mt-3 text-carnival-ink/80 ${
              featured
                ? featuredDesktopTextLarger
                  ? 'text-[0.8rem] leading-5 line-clamp-5 whitespace-normal md:text-[1rem] md:leading-7 lg:text-[1.125rem]'
                  : 'text-[0.8rem] leading-5 line-clamp-5 whitespace-normal'
                : 'min-h-[6rem] text-[0.85rem] leading-6 line-clamp-4 whitespace-normal'
            }`}
          >
            <Link href={detailHref} className="!text-inherit !no-underline transition hover:!text-carnival-red">
              {excerpt}
            </Link>
          </p>

          {featured ? (
            <>
              {visibleTaxonomyChips.length ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-carnival-ink/70">
                  {visibleTaxonomyChips.map((chip) => (
                    <Link
                      key={chip.id}
                      href={chip.path as string}
                      className="rounded-full border border-carnival-ink/20 px-3 py-1 text-[11px] font-semibold text-carnival-ink/75 transition hover:border-carnival-red hover:text-carnival-red"
                    >
                      {chip.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              <p className="mt-4 text-xs font-black uppercase tracking-wide text-carnival-ink/70">Listen On</p>
              <div className="mt-2 flex flex-nowrap gap-2">
                <a
                  href={spotifyEpisodeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#1DB954] px-2 py-2 text-xs font-bold !text-white !no-underline transition hover:brightness-110 hover:!text-white sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <span className="truncate">Spotify</span>
                </a>
                <a
                  href={applePodcastsEpisodeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#D56DFB] px-2 py-2 text-xs font-bold !text-white !no-underline transition hover:brightness-110 hover:!text-white sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <span className="truncate">Apple Podcasts</span>
                </a>
                <Link
                  href={PATREON_INTERNAL_PATH}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-carnival-red px-2 py-2 text-xs font-bold !text-white !no-underline transition hover:brightness-110 hover:!text-white sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <span className="truncate">Patreon</span>
                </Link>
              </div>
            </>
          ) : null}

          <div className={featured ? 'mt-auto pt-4 space-y-3' : 'mt-auto pt-5 space-y-3'}>
            {showInlinePlayer ? (
              <CardAudioPlayer episode={episode} />
            ) : (
              <Link
                href={detailHref}
                className="inline-flex w-full items-center justify-center rounded-full bg-carnival-ink px-4 py-2 text-sm font-black text-white transition hover:bg-carnival-red"
              >
                View Episode
              </Link>
            )}

            {!featured && visibleTaxonomyChips.length ? (
              <div className="hidden lg:flex flex-wrap items-center gap-2 text-xs font-bold text-carnival-ink/70">
                {visibleTaxonomyChips.map((chip) => (
                  <Link
                    key={chip.id}
                    href={chip.path as string}
                    className="rounded-full border border-carnival-ink/20 px-3 py-1 text-[11px] font-semibold text-carnival-ink/75 transition hover:border-carnival-red hover:text-carnival-red"
                  >
                    {chip.name}
                  </Link>
                ))}
              </div>
            ) : null}
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

export function CompactEpisodeRow({
  episode,
  excerptNoSnippet = false
}: {
  episode: PodcastEpisode;
  excerptNoSnippet?: boolean;
}) {
  const artworkButtonRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const { activeEpisode, isPlaying, playEpisode, togglePlayPause } = usePodcastPlayback();
  const isActive = activeEpisode?.slug === episode.slug;
  const playing = isActive && isPlaying;
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
      className="relative cursor-pointer overflow-hidden rounded-2xl border border-carnival-ink/10 bg-white shadow-[0_10px_26px_rgba(0,0,0,0.10)] transition hover:shadow-lg"
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
      <div className="flex items-start gap-4 px-4 py-4 sm:items-center sm:gap-6 sm:px-6 sm:py-5">
        {/* Artwork column */}
        <div className="flex flex-none flex-col items-start">
          <div className="relative h-24 w-24 overflow-hidden rounded-xl sm:h-24 sm:w-24">
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
            {/* Play button overlaid on artwork */}
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void togglePlay(artworkButtonRef.current || event.currentTarget);
              }}
              className={`absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-lg transition sm:h-8 sm:w-8 ${
                playing ? 'bg-carnival-red/90' : 'bg-carnival-red hover:bg-carnival-red/80'
              }`}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current sm:h-3.5 sm:w-3.5"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5 fill-current sm:h-3.5 sm:w-3.5"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex w-full items-center justify-end gap-2 sm:justify-between">
            {episode.episodeNumber !== null ? (
              <span className="rounded-full bg-carnival-red px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                <span className="sm:hidden">EP {episode.episodeNumber}</span>
                <span className="hidden sm:inline">Episode {episode.episodeNumber}</span>
              </span>
            ) : null}
            <p className="hidden text-right text-xs font-semibold uppercase tracking-wide text-carnival-ink/60 sm:block">{episodeDateLabel(episode)}</p>
          </div>
          <h2 className="mt-1 text-sm font-bold leading-snug text-carnival-ink min-[450px]:text-lg sm:text-xl">
            <Link href={detailHref} className="transition hover:text-carnival-red">
              {episode.title}
            </Link>
          </h2>
          <p data-nosnippet={excerptNoSnippet ? '' : undefined} className="mt-1.5 hidden line-clamp-2 text-xs leading-relaxed text-carnival-ink/75 sm:block sm:text-sm">
            {toExcerpt(episode.description, 200)}
          </p>
        </div>
      </div>
    </article>
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

export function EpisodesBrowser({
  episodes,
  searchEpisodes,
  showSearch = true,
  initialCount = INITIAL_COUNT,
  loadMoreCount = LOAD_MORE_COUNT,
  loadMoreHref,
  middleSlot,
  showFeaturedEpisode = true,
  featuredDesktopTextLarger = false,
  showFeaturedTaxonomyChips = false,
  showSortToggle = true,
  mobileSortLeft = false,
  initialViewMode,
  initialSortOrder = 'newest',
  sectionId,
  sectionTitle,
  pagination,
  basePath = '/episodes',
  preservedSearchParams
}: {
  episodes: PodcastEpisode[];
  searchEpisodes?: PodcastEpisode[];
  showSearch?: boolean;
  initialCount?: number;
  loadMoreCount?: number;
  loadMoreHref?: string;
  middleSlot?: React.ReactNode;
  showFeaturedEpisode?: boolean;
  featuredDesktopTextLarger?: boolean;
  showFeaturedTaxonomyChips?: boolean;
  showSortToggle?: boolean;
  mobileSortLeft?: boolean;
  initialViewMode?: ViewMode;
  initialSortOrder?: SortOrder;
  sectionId?: string;
  sectionTitle?: string;
  pagination?: { page: number; totalPages: number };
  basePath?: string;
  preservedSearchParams?: URLSearchParams;
}) {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode || 'grid');
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const [viewModeReady, setViewModeReady] = useState(false);
  const lastTrackedSearchRef = useRef('');

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
    if (initialViewMode) {
      setViewMode(initialViewMode);
      setViewModeReady(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (stored && isViewMode(stored)) {
        setViewMode(stored);
      }
    } catch {
      // Ignore localStorage failures.
    } finally {
      setViewModeReady(true);
    }
  }, [initialViewMode]);

  useEffect(() => {
    setSortOrder(initialSortOrder);
  }, [initialSortOrder]);

  useEffect(() => {
    if (!viewModeReady) return;
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Ignore localStorage failures.
    }
  }, [viewMode, viewModeReady]);

  const normalizedQuery = query.trim().toLowerCase();
  const searchCorpus = searchEpisodes && searchEpisodes.length ? searchEpisodes : episodes;
  const filteredEpisodes = useMemo(() => {
    const source = normalizedQuery ? searchCorpus : episodes;
    const sortedEpisodes = [...source].sort(byPublishedDate(sortOrder));
    if (!normalizedQuery) return sortedEpisodes;
    return sortedEpisodes.filter((episode) => {
      const inTitle = episode.title.toLowerCase().includes(normalizedQuery);
      const inEpisodeNumber = episode.episodeNumber !== null && `${episode.episodeNumber}`.includes(normalizedQuery);
      return inTitle || inEpisodeNumber;
    });
  }, [episodes, normalizedQuery, searchCorpus, sortOrder]);

  useEffect(() => {
    if (!normalizedQuery) {
      lastTrackedSearchRef.current = '';
      return;
    }

    const timeout = window.setTimeout(() => {
      const signature = `${normalizedQuery}::${filteredEpisodes.length}`;
      if (signature === lastTrackedSearchRef.current) return;
      lastTrackedSearchRef.current = signature;

      trackMixpanel('Search', {
        search_query: normalizedQuery,
        user_id: null,
        results_count: filteredEpisodes.length
      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [normalizedQuery, filteredEpisodes.length]);

  const featuredEpisode = useMemo(() => {
    if (!showFeaturedEpisode) return null;
    if (normalizedQuery) return null;
    if (!filteredEpisodes.length) return null;
    return [...filteredEpisodes].sort(byPublishedDate('newest'))[0] ?? null;
  }, [filteredEpisodes, normalizedQuery, showFeaturedEpisode]);

  const featuredTaxonomyChips = useMemo(() => {
    if (!showFeaturedTaxonomyChips || !featuredEpisode) return [] as Array<{ id: string; name: string; path: string | null; publicDisplayable?: boolean }>;
    const terms = (featuredEpisode as PodcastEpisode & {
      discoveryTerms?: Array<{
        id: string;
        name: string;
        path: string | null;
        isActive: boolean;
        termType: string;
        slug: string;
        entitySubtype: string | null;
      }>;
    }).discoveryTerms;
    if (!Array.isArray(terms) || !terms.length) return [] as Array<{ id: string; name: string; path: string | null; publicDisplayable?: boolean }>;
    return terms.slice(0, 6).map((term) => ({
      id: term.id,
      name: term.name,
      path: term.path,
      publicDisplayable: isTaxonomyPublicDisplayable({
        isActive: term.isActive,
        termType: term.termType,
        slug: term.slug,
        entitySubtype: term.entitySubtype,
        path: term.path
      })
    }));
  }, [featuredEpisode, showFeaturedTaxonomyChips]);

  const allStandardEpisodes = featuredEpisode
    ? filteredEpisodes.filter((episode) => episode.slug !== featuredEpisode.slug)
    : filteredEpisodes;
  const isSearching = !!normalizedQuery;
  const standardEpisodes = isSearching
    ? allStandardEpisodes
    : pagination
      ? allStandardEpisodes
      : allStandardEpisodes.slice(0, visibleCount);
  const listHash = sectionId ? `#${sectionId}` : undefined;
  const nextPageHref = pagination && pagination.page < pagination.totalPages
    ? pageHref(basePath, pagination.page + 1, preservedSearchParams, listHash)
    : null;
  const hasMore = !isSearching && (pagination ? Boolean(nextPageHref) : visibleCount < allStandardEpisodes.length);
  const hrefForPage = (page: number) => pageHref(basePath, page, preservedSearchParams, listHash);

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
                featuredDesktopTextLarger={featuredDesktopTextLarger}
                taxonomyChips={featuredTaxonomyChips}
              />
            </FeaturedEpisodeShowcase>
          ) : null}

          <section id={sectionId} className="space-y-3 scroll-mt-24" aria-label="Episode list">
            <div className="flex flex-col gap-3 pt-6 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
              {normalizedQuery ? (
                <p className="text-sm font-bold text-carnival-ink/60">
                  {filteredEpisodes.length} result{filteredEpisodes.length !== 1 ? 's' : ''}
                </p>
              ) : sectionTitle ? (
                <h3 className="text-xl font-black text-carnival-ink">{sectionTitle}</h3>
              ) : featuredEpisode ? (
                <h3 className="text-xl font-black text-carnival-ink">Recent Episodes</h3>
              ) : (
                <p className="text-sm font-bold text-carnival-ink/60">
                  {filteredEpisodes.length} result{filteredEpisodes.length !== 1 ? 's' : ''}
                </p>
              )}
              <div
                className={
                  mobileSortLeft
                    ? 'flex w-full items-center justify-between gap-2 min-[480px]:ml-auto min-[480px]:w-auto min-[480px]:justify-end'
                    : 'ml-auto flex w-full items-center justify-end gap-2 min-[480px]:w-auto'
                }
              >
                {showSortToggle ? <SortOrderToggle order={sortOrder} onChange={handleSortOrderChange} /> : null}
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

            {hasMore && !pagination ? (
              <div className="flex justify-center py-6">
                {loadMoreHref ? (
                  <Link
                    href={loadMoreHref}
                    className="rounded-xl bg-carnival-red px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-card transition hover:brightness-110"
                  >
                    Browse All Episodes
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="rounded-xl bg-carnival-red px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-card transition hover:brightness-110"
                    onClick={() => setVisibleCount((c) => c + loadMoreCount)}
                  >
                    Browse All Episodes
                  </button>
                )}
              </div>
            ) : null}

            {middleSlot}

            {!isSearching && pagination && pagination.totalPages > 1 ? (
              <CompactPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                hrefForPage={hrefForPage}
                ariaLabel="Episodes pagination"
                className="pt-4"
              />
            ) : null}
          </section>
        </>
      )}
    </section>
  );
}
