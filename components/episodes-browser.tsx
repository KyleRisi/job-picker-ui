'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { currentPathWithSearch, resolveSourcePageType } from '@/lib/analytics-events';
import { TrackedExternalCtaLink } from '@/components/tracked-external-cta-link';
import { TrackedPatreonCtaLink } from '@/components/tracked-patreon-cta-link';

type EpisodeListItem = Pick<
  PodcastEpisode,
  'id' | 'slug' | 'title' | 'authorName' | 'authorSlug' | 'primaryTopicName' | 'description' | 'publishedAt' | 'episodeNumber' | 'audioUrl' | 'artworkUrl' | 'duration'
>;

function toExcerpt(value: string, maxLength: number): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No description available for this episode yet.';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function episodeDateLabel(episode: EpisodeListItem): string {
  return formatEpisodeDate(episode.publishedAt);
}

function formatEpisodeDurationLabel(value: string | number | null | undefined): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }
  if (!Number.isFinite(value) || (value as number) <= 0) return null;
  const totalMinutes = Math.floor((value as number) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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
  episode: EpisodeListItem;
}) {
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const sourcePageType = resolveSourcePageType(typeof window === 'undefined' ? null : window.location.pathname);
  const { activeEpisode, isPlaying, duration, currentTime, playEpisode, togglePlayPause, seekTo, skipBy } = usePodcastPlayback();
  const isActive = activeEpisode?.slug === episode.slug;
  const playing = isActive && isPlaying;
  const displayedCurrent = isActive ? currentTime : 0;
  const displayedDuration = isActive ? duration : 0;

  const togglePlay = async () => {
    const sourcePagePath = currentPathWithSearch();
    if (!isActive) {
      await playEpisode({
        slug: episode.slug,
        title: episode.title,
        audioUrl: episode.audioUrl,
        artworkUrl: episode.artworkUrl,
        episodeNumber: episode.episodeNumber,
        publishedAt: episode.publishedAt,
        duration: episode.duration
      }, playButtonRef.current, {
        playerLocation: 'episode_card',
        sourcePageType,
        sourcePagePath
      });
      return;
    }
    await togglePlayPause({
      playerLocation: 'episode_card',
      sourcePageType,
      sourcePagePath
    });
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
  showInlinePlayer = true,
  detailHref,
  detailCtaLabel = 'View Episode',
  minimalCard = false,
  nonFeaturedLayout = 'default'
}: {
  episode: EpisodeListItem;
  featured: boolean;
  featuredDesktopTextLarger?: boolean;
  taxonomyChips?: Array<{
    id: string;
    name: string;
    path: string | null;
    publicDisplayable?: boolean;
    termType?: string;
    slug?: string;
  }>;
  showInlinePlayer?: boolean;
  detailHref?: string;
  detailCtaLabel?: string;
  minimalCard?: boolean;
  nonFeaturedLayout?: 'default' | 'title-by-artwork';
}) {
  const sourcePageType = resolveSourcePageType(typeof window === 'undefined' ? null : window.location.pathname);
  const sourcePagePath = currentPathWithSearch();
  const excerpt = toExcerpt(episode.description, featured ? 480 : 220);
  const durationLabel = formatEpisodeDurationLabel(episode.duration);
  const resolvedDetailHref = detailHref || `/episodes/${episode.slug}`;
  const useTitleByArtworkLayout = !featured && nonFeaturedLayout === 'title-by-artwork';
  const spotifyEpisodeUrl = getSpotifyEpisodeUrl(episode.title);
  const applePodcastsEpisodeUrl = getApplePodcastsEpisodeUrl(episode.title);
  const visibleTaxonomyChips = useMemo(
    () => (taxonomyChips || []).filter((chip) => chip.publicDisplayable && chip.path),
    [taxonomyChips]
  );
  const taxonomyChipHref = (chip: { termType?: string; slug?: string; path: string | null }) => {
    if (chip.termType === 'topic' && chip.slug) {
      return `/episodes?topic=${encodeURIComponent(chip.slug)}`;
    }
    return chip.path as string;
  };

  return (
    <article
      className={`h-full overflow-hidden rounded-2xl border bg-white ${
        featured ? 'border-carnival-gold/70 ring-2 ring-carnival-gold/35' : 'border-carnival-ink/10'
      }`}
      aria-label={`Podcast episode ${episode.title}`}
    >
      <div className={featured ? 'flex flex-col gap-0 sm:flex-row sm:items-stretch' : 'flex h-full flex-col'}>
        <div className={featured ? 'aspect-square w-full sm:w-[360px] lg:w-[420px] sm:flex-none sm:self-stretch' : 'hidden'}>
          {episode.artworkUrl ? (
            <Link href={resolvedDetailHref} className="relative block h-full w-full">
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
              href={resolvedDetailHref}
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
            <div className="mb-2 flex items-start gap-3">
              <div className="relative h-24 w-24 flex-none overflow-hidden rounded-lg">
                {episode.artworkUrl ? (
                  <Link href={resolvedDetailHref} className="relative block h-full w-full">
                    <Image
                      src={episode.artworkUrl}
                      alt={`Artwork for ${episode.title}`}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </Link>
                ) : (
                  <Link
                    href={resolvedDetailHref}
                    className="flex h-full w-full items-center justify-center bg-carnival-ink/10 p-2 text-center text-[10px] font-semibold text-carnival-ink/70"
                  >
                    No artwork
                  </Link>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                {useTitleByArtworkLayout ? (
                  <>
                    <h2 className="line-clamp-3 text-[0.98rem] font-black leading-tight text-carnival-ink sm:text-[1.06rem]">
                      <Link href={resolvedDetailHref} className="text-carnival-ink no-underline transition hover:text-carnival-ink/70">
                        {episode.title}
                      </Link>
                    </h2>
                    {episode.primaryTopicName ? (
                      <span className="inline-block max-w-full truncate whitespace-nowrap rounded-full bg-carnival-red px-2 py-0.5 text-[11px] font-semibold text-white">
                        {episode.primaryTopicName}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    {episode.primaryTopicName ? (
                      <span className="inline-block max-w-full truncate whitespace-nowrap rounded-full bg-carnival-red px-2 py-0.5 text-[11px] font-semibold text-white">
                        {episode.primaryTopicName}
                      </span>
                    ) : null}
                    <p className="text-xs font-semibold text-carnival-ink/75">{episodeDateLabel(episode)}</p>
                    {durationLabel ? <p className="text-xs font-semibold text-carnival-ink/75">{durationLabel}</p> : null}
                    {episode.authorName && episode.authorSlug ? (
                      <Link
                        href={`/author/${episode.authorSlug}`}
                        className="text-xs font-semibold text-carnival-ink/75 transition hover:text-carnival-red"
                      >
                        {episode.authorName}
                      </Link>
                    ) : (
                      <p className="text-xs font-semibold text-carnival-ink/75">{episode.authorName || 'The Compendium Podcast'}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          {!useTitleByArtworkLayout ? (
            <h2
              className={`mt-2 font-black leading-tight text-carnival-ink ${
                featured
                  ? featuredDesktopTextLarger
                    ? 'text-[1.2rem] md:text-[1.85rem] lg:text-[2.1rem]'
                    : 'text-[1.2rem]'
                  : minimalCard
                    ? 'text-[1.03rem] sm:text-[1.125rem]'
                    : 'min-h-[3.2rem] text-[1.03rem] sm:text-[1.125rem]'
              }`}
            >
              <Link
                href={resolvedDetailHref}
                className="text-carnival-ink no-underline transition hover:text-carnival-ink/70"
              >
                <span>{episode.title}</span>
              </Link>
            </h2>
          ) : null}
          {!minimalCard ? (
            <p
              className={`mt-3 text-carnival-ink/80 ${
                featured
                  ? featuredDesktopTextLarger
                    ? 'text-[0.8rem] leading-5 line-clamp-5 whitespace-normal md:text-[1rem] md:leading-7 lg:text-[1.125rem]'
                    : 'text-[0.8rem] leading-5 line-clamp-5 whitespace-normal'
                  : 'min-h-[6rem] text-[0.8rem] leading-5 line-clamp-4 whitespace-normal sm:text-[0.85rem] sm:leading-6'
              }`}
            >
              <Link
                href={resolvedDetailHref}
                className="text-inherit no-underline transition hover:text-carnival-ink/65"
              >
                {excerpt}
              </Link>
            </p>
          ) : null}

          {featured ? (
            <>
              {visibleTaxonomyChips.length ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-carnival-ink/70">
                  {visibleTaxonomyChips.map((chip) => (
                    <Link
                      key={chip.id}
                      href={taxonomyChipHref(chip)}
                      className="rounded-full border border-carnival-ink/20 px-3 py-1 text-[11px] font-semibold text-carnival-ink/75 transition hover:border-carnival-red hover:text-carnival-red"
                    >
                      {chip.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              <p className="mt-4 text-xs font-black uppercase tracking-wide text-carnival-ink/70">Listen On</p>
              <div className="mt-2 flex flex-nowrap gap-2">
                <TrackedExternalCtaLink
                  href={spotifyEpisodeUrl}
                  target="_blank"
                  destination="spotify"
                  ctaLocation="episode_card"
                  sourcePageType={sourcePageType}
                  sourcePagePath={sourcePagePath}
                  episodeTitle={episode.title}
                  episodeSlug={episode.slug}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#1DB954] px-2 py-2 text-xs font-bold !text-white !no-underline transition hover:brightness-110 hover:!text-white sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <span className="truncate">Spotify</span>
                </TrackedExternalCtaLink>
                <TrackedExternalCtaLink
                  href={applePodcastsEpisodeUrl}
                  target="_blank"
                  destination="apple_podcasts"
                  ctaLocation="episode_card"
                  sourcePageType={sourcePageType}
                  sourcePagePath={sourcePagePath}
                  episodeTitle={episode.title}
                  episodeSlug={episode.slug}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#D56DFB] px-2 py-2 text-xs font-bold !text-white !no-underline transition hover:brightness-110 hover:!text-white sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <span className="truncate">Apple Podcasts</span>
                </TrackedExternalCtaLink>
                <TrackedPatreonCtaLink
                  href={PATREON_INTERNAL_PATH}
                  ctaLocation="episode_card"
                  sourcePageType={sourcePageType}
                  sourcePagePath={sourcePagePath}
                  episodeTitle={episode.title}
                  episodeSlug={episode.slug}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-carnival-red px-2 py-2 text-xs font-bold !text-white !no-underline transition hover:brightness-110 hover:!text-white sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <span className="truncate">Patreon</span>
                </TrackedPatreonCtaLink>
              </div>
            </>
          ) : null}

          <div className={featured ? 'mt-auto pt-4 space-y-3' : 'mt-auto pt-5 space-y-3'}>
            {showInlinePlayer ? (
              <CardAudioPlayer episode={episode} />
            ) : (
              <Link
                href={resolvedDetailHref}
                className="mx-auto flex w-fit items-center justify-center rounded-full bg-carnival-red px-5 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:brightness-110"
              >
                {detailCtaLabel}
              </Link>
            )}

            {!featured && !minimalCard && visibleTaxonomyChips.length ? (
              <div className="hidden lg:flex flex-wrap items-center gap-2 text-xs font-bold text-carnival-ink/70">
                {visibleTaxonomyChips.map((chip) => (
                  <Link
                    key={chip.id}
                    href={taxonomyChipHref(chip)}
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

export function GridEpisodeCard({
  episode,
  detailHref,
  nonFeaturedLayout
}: {
  episode: EpisodeListItem;
  detailHref?: string;
  nonFeaturedLayout?: 'default' | 'title-by-artwork';
}) {
  return <EpisodeCard episode={episode} featured={false} detailHref={detailHref} nonFeaturedLayout={nonFeaturedLayout} />;
}

export function EpisodesGrid({
  episodes,
  className = 'grid gap-4 min-[600px]:grid-cols-2 min-[1000px]:grid-cols-3'
}: {
  episodes: PodcastEpisode[];
  className?: string;
}) {
  return (
    <div className={className}>
      {episodes.map((episode) => (
        <GridEpisodeCard key={episode.slug} episode={episode} />
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

function normalizePageQueryParam(value: string | null): number {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (!normalized) return 1;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function normalizeTopicQueryParam(value: string | null): string | null {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;
  return normalized;
}

function parseEpisodesQueryState(
  search: string,
  topicToggleOptions: Array<{ label: string; value: string | null }>
): { viewMode: ViewMode | null; topicFilter: string | null; page: number } {
  const params = new URLSearchParams(search);
  const viewValue = `${params.get('view') || ''}`.trim().toLowerCase();
  const viewMode = isViewMode(viewValue) ? viewValue : null;
  const topicValue = normalizeTopicQueryParam(params.get('topic'));
  const topicFilter = topicValue && topicToggleOptions.some((option) => option.value === topicValue)
    ? topicValue
    : null;
  const page = normalizePageQueryParam(params.get('page'));

  return { viewMode, topicFilter, page };
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
  excerptNoSnippet = false,
  detailHref
}: {
  episode: EpisodeListItem;
  excerptNoSnippet?: boolean;
  detailHref?: string;
}) {
  const artworkButtonRef = useRef<HTMLButtonElement | null>(null);
  const sourcePageType = resolveSourcePageType(typeof window === 'undefined' ? null : window.location.pathname);
  const router = useRouter();
  const { activeEpisode, isPlaying, playEpisode, togglePlayPause } = usePodcastPlayback();
  const isActive = activeEpisode?.slug === episode.slug;
  const playing = isActive && isPlaying;
  const resolvedDetailHref = detailHref || `/episodes/${episode.slug}`;

  const togglePlay = async (sourceElement?: HTMLElement | null) => {
    const sourcePagePath = currentPathWithSearch();
    if (!isActive) {
      await playEpisode({
        slug: episode.slug,
        title: episode.title,
        audioUrl: episode.audioUrl,
        artworkUrl: episode.artworkUrl,
        episodeNumber: episode.episodeNumber,
        publishedAt: episode.publishedAt,
        duration: episode.duration
      }, sourceElement || artworkButtonRef.current, {
        playerLocation: 'inline_player',
        sourcePageType,
        sourcePagePath
      });
      return;
    }
    await togglePlayPause({
      playerLocation: 'inline_player',
      sourcePageType,
      sourcePagePath
    });
  };

  const openDetails = () => {
    router.push(resolvedDetailHref);
  };

  return (
    <article
      className="relative cursor-pointer overflow-hidden rounded-xl bg-white shadow-[0_10px_26px_rgba(0,0,0,0.10)] transition hover:shadow-lg"
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
      <div className="flex h-24 items-stretch gap-3 pr-4 sm:h-28 sm:gap-5 sm:pr-6 lg:h-32 lg:gap-6 lg:pr-7 xl:h-36">
        {/* Artwork column */}
        <div className="relative h-full w-24 flex-none overflow-hidden rounded-l-xl sm:w-28 lg:w-32 xl:w-36">
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
                sizes="(max-width: 639px) 34vw, 96px"
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

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col items-start justify-center py-2 text-left sm:py-3">
          <h2 className="mt-1 line-clamp-2 text-[12px] font-semibold leading-[1.05] text-carnival-ink min-[450px]:text-xs sm:text-sm lg:text-base">
            <Link
              href={resolvedDetailHref}
              className="block leading-[1.05] transition hover:text-carnival-ink/70"
            >
              {episode.title}
            </Link>
          </h2>
          <p data-nosnippet={excerptNoSnippet ? '' : undefined} className="mt-1.5 line-clamp-3 text-[11px] leading-tight text-carnival-ink/75 sm:text-xs sm:leading-relaxed lg:text-[13px]">
            {toExcerpt(episode.description, 420)}
          </p>
        </div>
      </div>
    </article>
  );
}

function SortOrderToggle({ order, onChange }: { order: SortOrder; onChange: (o: SortOrder) => void }) {
  return (
    <div className="flex h-[50px] items-center gap-1 rounded-xl border-2 border-carnival-ink/20 bg-white p-1" role="radiogroup" aria-label="Sort episodes">
      <button
        type="button"
        role="radio"
        aria-checked={order === 'oldest'}
        className={`flex h-[42px] items-center rounded-lg px-4 text-[11px] font-black uppercase tracking-wide transition ${
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
        className={`flex h-[42px] items-center rounded-lg px-4 text-[11px] font-black uppercase tracking-wide transition ${
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
  preservedSearchParams,
  topicFilter,
  topicToggleOptions = []
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
  pagination?: { page: number; totalPages: number; pageSize?: number };
  basePath?: string;
  preservedSearchParams?: URLSearchParams;
  topicFilter?: string | null;
  topicToggleOptions?: Array<{ label: string; value: string | null }>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode || 'grid');
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const [viewModeReady, setViewModeReady] = useState(false);
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);
  const topicDropdownRef = useRef<HTMLDivElement | null>(null);
  const lastTrackedSearchRef = useRef('');
  const supportsUrlQueryState = basePath === '/episodes' && Boolean(pagination);
  const [urlQueryState, setUrlQueryState] = useState<{ viewMode: ViewMode | null; topicFilter: string | null; page: number }>({
    viewMode: null,
    topicFilter: null,
    page: pagination?.page || 1
  });
  const effectiveTopicFilter = supportsUrlQueryState
    ? urlQueryState.topicFilter
    : (topicFilter || null);

  const handleSortOrderChange = (nextOrder: SortOrder) => {
    if (nextOrder === sortOrder) return;
    if (pagination) {
      const params = new URLSearchParams(preservedSearchParams?.toString() || '');
      params.delete('page');
      if (nextOrder === 'newest') params.delete('sort');
      else params.set('sort', nextOrder);
      const query = params.toString();
      const href = `${basePath}${query ? `?${query}` : ''}`;
      router.replace(href, { scroll: false });
      return;
    }
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

  useLayoutEffect(() => {
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

  useEffect(() => {
    if (!supportsUrlQueryState || typeof window === 'undefined') return;

    const urlChangeEventName = 'compendium:url-query-change';
    const syncFromWindowLocation = () => {
      setUrlQueryState(parseEpisodesQueryState(window.location.search, topicToggleOptions));
    };
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((...args: Parameters<History['pushState']>) => {
      originalPushState(...args);
      window.dispatchEvent(new Event(urlChangeEventName));
    }) as History['pushState'];
    window.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      originalReplaceState(...args);
      window.dispatchEvent(new Event(urlChangeEventName));
    }) as History['replaceState'];

    syncFromWindowLocation();
    window.addEventListener('popstate', syncFromWindowLocation);
    window.addEventListener('hashchange', syncFromWindowLocation);
    window.addEventListener(urlChangeEventName, syncFromWindowLocation);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', syncFromWindowLocation);
      window.removeEventListener('hashchange', syncFromWindowLocation);
      window.removeEventListener(urlChangeEventName, syncFromWindowLocation);
    };
  }, [supportsUrlQueryState, topicToggleOptions]);

  useEffect(() => {
    if (!supportsUrlQueryState || !viewModeReady) return;
    const queryViewMode = urlQueryState.viewMode;
    if (!queryViewMode) return;
    setViewMode((current) => (current === queryViewMode ? current : queryViewMode));
  }, [supportsUrlQueryState, urlQueryState.viewMode, viewModeReady]);

  const normalizedQuery = query.trim().toLowerCase();
  const searchCorpus = searchEpisodes && searchEpisodes.length ? searchEpisodes : episodes;
  const hasTopicCoverage = episodes.some((episode) => Boolean(episode.primaryTopicSlug));
  const topicFilteredEpisodes = effectiveTopicFilter && hasTopicCoverage
    ? episodes.filter((episode) => episode.primaryTopicSlug === effectiveTopicFilter)
    : episodes;
  const filteredEpisodes = useMemo(() => {
    const source = normalizedQuery ? searchCorpus : topicFilteredEpisodes;
    const sortedEpisodes = [...source].sort(byPublishedDate(sortOrder));
    if (!normalizedQuery) return sortedEpisodes;
    return sortedEpisodes.filter((episode) => {
      const inTitle = episode.title.toLowerCase().includes(normalizedQuery);
      const inEpisodeNumber = episode.episodeNumber !== null && `${episode.episodeNumber}`.includes(normalizedQuery);
      return inTitle || inEpisodeNumber;
    });
  }, [normalizedQuery, searchCorpus, sortOrder, topicFilteredEpisodes]);

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
    if (!showFeaturedTaxonomyChips || !featuredEpisode) {
      return [] as Array<{
        id: string;
        name: string;
        path: string | null;
        publicDisplayable?: boolean;
        termType?: string;
        slug?: string;
      }>;
    }
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
    if (!Array.isArray(terms) || !terms.length) {
      return [] as Array<{
        id: string;
        name: string;
        path: string | null;
        publicDisplayable?: boolean;
        termType?: string;
        slug?: string;
      }>;
    }
    return terms.slice(0, 6).map((term) => ({
      id: term.id,
      name: term.name,
      path: term.path,
      termType: term.termType,
      slug: term.slug,
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
  const effectivePageSize = pagination?.pageSize;
  const derivedTotalPages = pagination
    ? Math.max(
      1,
      effectivePageSize && effectivePageSize > 0
        ? Math.ceil(allStandardEpisodes.length / effectivePageSize)
        : pagination.totalPages
    )
    : 1;
  const requestedPage = pagination
    ? (supportsUrlQueryState ? urlQueryState.page : pagination.page)
    : 1;
  const currentPage = pagination ? Math.min(requestedPage, derivedTotalPages) : 1;
  const effectivePreservedSearchParams = useMemo(() => {
    if (!supportsUrlQueryState) return preservedSearchParams;
    const params = new URLSearchParams();
    if (urlQueryState.viewMode) params.set('view', urlQueryState.viewMode);
    if (effectiveTopicFilter) params.set('topic', effectiveTopicFilter);
    return params.size ? params : undefined;
  }, [effectiveTopicFilter, preservedSearchParams, supportsUrlQueryState, urlQueryState.viewMode]);
  const pagedStandardEpisodes = useMemo(() => {
    if (!pagination || !effectivePageSize) return allStandardEpisodes;
    const start = Math.max(0, (currentPage - 1) * effectivePageSize);
    return allStandardEpisodes.slice(start, start + effectivePageSize);
  }, [allStandardEpisodes, currentPage, effectivePageSize, pagination]);
  const standardEpisodes = isSearching
    ? allStandardEpisodes
    : pagination
      ? pagedStandardEpisodes
      : allStandardEpisodes.slice(0, visibleCount);
  const listHash = sectionId ? `#${sectionId}` : undefined;
  const nextPageHref = pagination && currentPage < derivedTotalPages
    ? pageHref(basePath, currentPage + 1, effectivePreservedSearchParams, listHash)
    : null;
  const hasMore = !isSearching && (pagination ? Boolean(nextPageHref) : visibleCount < allStandardEpisodes.length);
  const hrefForPage = (page: number) => pageHref(basePath, page, effectivePreservedSearchParams, listHash);
  const hrefForTopic = (topic: string | null) => {
    const params = new URLSearchParams(effectivePreservedSearchParams?.toString() || '');
    params.delete('page');
    if (topic) params.set('topic', topic);
    else params.delete('topic');
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ''}`;
  };
  const activeTopicOption =
    topicToggleOptions.find((option) => option.value === effectiveTopicFilter) ||
    topicToggleOptions.find((option) => option.value === null) ||
    topicToggleOptions[0] ||
    null;

  const handleTopicFilterSelect = (nextTopicValue: string | null) => {
    setTopicDropdownOpen(false);
    const href = hrefForTopic(nextTopicValue);
    router.replace(href, { scroll: false });
  };
  const currentListHref = pagination ? hrefForPage(currentPage) : pageHref(basePath, 1, effectivePreservedSearchParams, listHash);
  const episodeDetailHref = (episodeSlug: string) => {
    if (!currentListHref || currentListHref === '/episodes') return `/episodes/${episodeSlug}`;
    const params = new URLSearchParams();
    params.set('returnTo', currentListHref);
    return `/episodes/${episodeSlug}?${params.toString()}`;
  };

  const sortAndViewControls = (
    <div
      className={
        mobileSortLeft
          ? `flex items-center ${showSearch ? 'shrink-0 gap-2' : `w-full ${showSortToggle ? 'justify-between' : 'justify-end'}`} min-[820px]:ml-auto min-[820px]:w-auto min-[820px]:justify-end min-[820px]:gap-2`
          : 'ml-auto flex items-center gap-2'
      }
    >
      {showSortToggle ? <SortOrderToggle order={sortOrder} onChange={handleSortOrderChange} /> : null}
      <ViewModeToggle mode={viewMode} onChange={setViewMode} />
    </div>
  );
  const topicFilterControl = topicToggleOptions.length ? (
    <div className="flex w-full items-center gap-2 min-[820px]:w-[18rem] min-[820px]:shrink-0">
      <div ref={topicDropdownRef} className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setTopicDropdownOpen((open) => !open)}
          className="flex h-[50px] w-full items-center justify-between gap-2 rounded-xl border-2 border-carnival-ink/20 bg-white px-3 py-2 text-left shadow-sm outline-none transition hover:border-carnival-ink/35 focus-visible:border-carnival-gold focus-visible:ring-4 focus-visible:ring-carnival-gold/45"
          aria-haspopup="listbox"
          aria-expanded={topicDropdownOpen}
          aria-label="Filter episodes by topic"
        >
          {activeTopicOption ? (
            <span
              className={`inline-flex min-w-0 items-center truncate rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
                activeTopicOption.value
                  ? 'bg-carnival-red text-white'
                  : 'bg-carnival-ink/10 text-carnival-ink/70'
              }`}
            >
              {activeTopicOption.label}
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className={`ml-auto inline-flex text-carnival-ink/55 transition-transform ${topicDropdownOpen ? 'rotate-180' : ''}`}
          >
            <svg viewBox="0 0 12 8" className="h-2.5 w-2.5 fill-current">
              <path d="M6 8 0 0h12L6 8Z" />
            </svg>
          </span>
        </button>
        {topicDropdownOpen ? (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-carnival-ink/15 bg-white shadow-[0_14px_30px_rgba(0,0,0,0.12)]">
            <ul role="listbox" aria-label="Episode topic filters" className="max-h-72 overflow-y-auto p-1">
              {topicToggleOptions.map((option) => {
                const isActive = option.value === null ? !effectiveTopicFilter : effectiveTopicFilter === option.value;
                return (
                  <li key={option.value || 'all'} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onClick={() => handleTopicFilterSelect(option.value)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                        isActive
                          ? 'bg-carnival-red text-white'
                          : 'text-carnival-ink/85 hover:bg-carnival-ink/5'
                      }`}
                    >
                      <span>{option.label}</span>
                      {isActive ? <span className="text-xs font-black">✓</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;
  const showControlPanel = showSearch || Boolean(topicFilterControl);
  const gridLayoutVariant: 'default' | 'title-by-artwork' = basePath === '/episodes' ? 'title-by-artwork' : 'default';
  const searchPanel = (
    <div className="flex flex-col gap-2 min-[820px]:flex-row min-[820px]:items-center">
      {topicFilterControl}
      {showSearch ? (
        <div className="flex w-full min-w-0 items-center gap-2 min-[820px]:flex-1">
          <LiveSearchInput
            id="episode-search"
            value={query}
            onChange={setQuery}
            placeholder="Search episodes"
            ariaLabel="Search episodes"
            className="min-w-0 flex-1"
          />
          {sortAndViewControls}
        </div>
      ) : (
        sortAndViewControls
      )}
    </div>
  );
  useEffect(() => {
    if (!topicDropdownOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!topicDropdownRef.current?.contains(event.target as Node)) setTopicDropdownOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTopicDropdownOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [topicDropdownOpen]);

  return (
    <section className="space-y-6" aria-label="All podcast episodes">
      {filteredEpisodes.length === 0 ? (
        <>
          {showControlPanel ? searchPanel : null}
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
                detailHref={episodeDetailHref(featuredEpisode.slug)}
              />
            </FeaturedEpisodeShowcase>
          ) : null}

          <section id={sectionId} className="space-y-3 scroll-mt-24" aria-label="Episode list">
            <div className="pt-6">
              {normalizedQuery ? (
                <p className="text-sm font-bold text-carnival-ink/60">
                  {filteredEpisodes.length} result{filteredEpisodes.length !== 1 ? 's' : ''}
                </p>
              ) : sectionTitle ? (
                <h3 className="text-xl font-black text-carnival-ink">{sectionTitle}</h3>
              ) : featuredEpisode ? (
                <h3 className="text-xl font-black text-carnival-ink">Recent Episodes</h3>
              ) : null}
            </div>
            {showControlPanel ? searchPanel : null}

            {!viewModeReady ? (
              <div className="h-24 rounded-xl border border-carnival-ink/10 bg-white/70" aria-hidden="true" />
            ) : viewMode === 'grid' ? (
              <div className="grid gap-4 min-[600px]:grid-cols-2 min-[1000px]:grid-cols-3">
                {standardEpisodes.map((episode) => (
                  <GridEpisodeCard
                    key={episode.slug}
                    episode={episode}
                    detailHref={episodeDetailHref(episode.slug)}
                    nonFeaturedLayout={gridLayoutVariant}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {standardEpisodes.map((episode) => (
                  <CompactEpisodeRow key={episode.slug} episode={episode} detailHref={episodeDetailHref(episode.slug)} />
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

            {!isSearching && pagination && derivedTotalPages > 1 ? (
              <CompactPagination
                page={currentPage}
                totalPages={derivedTotalPages}
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
