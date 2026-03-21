'use client';

import { useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { usePodcastPlayback } from '@/components/podcast-playback-provider';
import { resolveSourcePageType } from '@/lib/analytics-events';

function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const whole = Math.floor(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

type EpisodeMediaPlayerProps = {
  episode: {
    slug: string;
    title: string;
    audioUrl: string;
    artworkUrl: string | null;
    episodeNumber: number | null;
    publishedAt: string;
    duration: string | null;
  };
};

export function EpisodeMediaPlayer({ episode }: EpisodeMediaPlayerProps) {
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();
  const sourcePagePath = typeof window === 'undefined' ? (pathname || '/') : `${window.location.pathname}${window.location.search || ''}`;
  const sourcePageType = resolveSourcePageType(pathname);
  const playerLocation = sourcePageType === 'episode_page' ? 'episode_player' : 'inline_player';
  const { activeEpisode, isPlaying, duration, currentTime, playbackRate, playEpisode, togglePlayPause, seekTo, skipBy, cycleSpeed } =
    usePodcastPlayback();
  const isActive = activeEpisode?.slug === episode.slug;
  const isEpisodePlaying = isActive && isPlaying;
  const displayedDuration = isActive ? duration : 0;
  const displayedCurrent = isActive ? currentTime : 0;
  const remaining = useMemo(() => Math.max(duration - currentTime, 0), [duration, currentTime]);

  const togglePlay = async () => {
    if (!isActive) {
      await playEpisode(episode, playButtonRef.current, {
        playerLocation,
        sourcePageType,
        sourcePagePath
      });
      return;
    }
    await togglePlayPause({
      playerLocation,
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
    <div
      className={`flex h-[4.2rem] items-center gap-2.5 rounded-xl border px-2.5 transition-colors ${
        isEpisodePlaying
          ? 'border-white/25 bg-carnival-red text-white'
          : 'border-white/25 bg-carnival-ink text-white'
      }`}
    >
      {/* Play / Pause */}
      <button
        ref={playButtonRef}
        type="button"
        onClick={togglePlay}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black transition ${
          isEpisodePlaying ? 'bg-white text-carnival-red' : 'bg-[#f4e7bc] text-carnival-ink'
        }`}
        aria-label={isEpisodePlaying ? 'Pause' : 'Play'}
      >
        {isEpisodePlaying ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Seek bar */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="w-9 text-[10px] font-bold text-white/80">{formatClock(displayedCurrent)}</span>
          <input
            type="range"
            min={0}
            max={displayedDuration || 0}
            step={0.01}
            value={Math.min(displayedCurrent, displayedDuration || 0)}
            onChange={(event) => handleSeek(Number(event.target.value))}
            className={`audio-range w-full min-w-0 ${isEpisodePlaying ? 'audio-range-on-dark' : 'audio-range-paused-strong'}`}
            aria-label="Seek audio"
            disabled={!isActive}
          />
          <span className="w-11 text-right text-[10px] font-bold text-white/80">
            -{formatClock(isActive ? remaining : 0)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={cycleSpeed}
          className="rounded-md px-1.5 py-0.5 text-[11px] font-black text-white/85 hover:text-white"
          aria-label={`Playback speed ${playbackRate}x`}
        >
          {playbackRate}×
        </button>
        <button
          type="button"
          onClick={() => handleSkipBy(-15)}
          className="rounded-md px-1 py-0.5 text-[11px] font-black text-white/85 hover:text-white"
          aria-label="Back 15 seconds"
          disabled={!isActive}
        >
          -15
        </button>
        <button
          type="button"
          onClick={() => handleSkipBy(30)}
          className="rounded-md px-1 py-0.5 text-[11px] font-black text-white/85 hover:text-white"
          aria-label="Forward 30 seconds"
          disabled={!isActive}
        >
          +30
        </button>
      </div>
    </div>
  );
}
