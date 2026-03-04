'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent
} from 'react';

const PLAYBACK_STORAGE_KEY = 'compendium:podcast-playback';

type PlaybackEpisode = {
  slug: string;
  title: string;
  audioUrl: string;
  artworkUrl: string | null;
  episodeNumber: number | null;
  publishedAt: string;
  duration: string | null;
};

type PodcastPlaybackContextValue = {
  activeEpisode: PlaybackEpisode | null;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  playbackRate: number;
  sleepTimerActive: boolean;
  playEpisode: (episode: PlaybackEpisode, sourceElement?: HTMLElement | null) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (seconds: number) => void;
  skipBy: (seconds: number) => void;
  cycleSpeed: () => void;
  toggleSleepTimer: () => void;
};

const PodcastPlaybackContext = createContext<PodcastPlaybackContextValue | null>(null);

function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const whole = Math.floor(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function DesktopTicker({ children, className }: { children: ReactNode; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) return;

    const check = () => {
      const isOver = text.scrollWidth > wrap.clientWidth;
      setOverflowing(isOver);
      if (isOver) {
        const shift = ((text.scrollWidth - wrap.clientWidth) / text.scrollWidth) * 100;
        text.style.setProperty('--ticker-shift', `-${shift.toFixed(1)}%`);
      }
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div ref={wrapRef} className="desktop-player-ticker-wrap">
      <span
        ref={textRef}
        className={`desktop-player-ticker ${className ?? ''}`}
        data-overflowing={overflowing}
      >
        {children}
      </span>
    </div>
  );
}

export function PodcastPlaybackProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoplayResumeCleanupRef = useRef<(() => void) | null>(null);
  const playbackIntentRef = useRef(false);
  const isPageUnloadingRef = useRef(false);
  const latestPersistRef = useRef<{
    activeEpisode: PlaybackEpisode | null;
    currentTime: number;
    playbackRate: number;
    trayExpanded: boolean;
  }>({
    activeEpisode: null,
    currentTime: 0,
    playbackRate: 1,
    trayExpanded: false
  });
  const restoringRef = useRef(false);
  const launcherButtonRef = useRef<HTMLElement | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<PlaybackEpisode | null>(null);
  const [trayExpanded, setTrayExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [sleepTimerActive, setSleepTimerActive] = useState(false);
  const mobileDragStartYRef = useRef<number | null>(null);
  const mobileDragDeltaYRef = useRef(0);
  const [mobileSheetDragY, setMobileSheetDragY] = useState(0);

  const animateArtworkFlight = useCallback((artworkUrl: string, sourceElement?: HTMLElement | null) => {
    if (!sourceElement || typeof window === 'undefined') return;

    const sourceRect = sourceElement.getBoundingClientRect();
    // If the launcher button is already mounted use its position, otherwise
    // calculate the resting position: bottom-3 right-3 with the artwork size.
    const isMobile = window.innerWidth <= 450;
    const size = isMobile ? 56 : 67.2; // h-14 or h-[4.2rem]
    const offset = 12; // bottom-3 / right-3
    const launcherRect = launcherButtonRef.current?.getBoundingClientRect();
    const targetRect =
      launcherRect && launcherRect.width > 0 && launcherRect.height > 0
        ? launcherRect
        : new DOMRect(window.innerWidth - offset - size, window.innerHeight - offset - size, size, size);

    const sprite = document.createElement('img');
    sprite.src = artworkUrl;
    sprite.alt = '';
    sprite.setAttribute('aria-hidden', 'true');
    sprite.style.position = 'fixed';
    sprite.style.left = `${sourceRect.left + sourceRect.width / 2 - 20}px`;
    sprite.style.top = `${sourceRect.top + sourceRect.height / 2 - 20}px`;
    sprite.style.width = '40px';
    sprite.style.height = '40px';
    sprite.style.borderRadius = '9999px';
    sprite.style.objectFit = 'cover';
    sprite.style.pointerEvents = 'none';
    sprite.style.zIndex = '9999';
    sprite.style.boxShadow = '0 8px 20px rgba(0,0,0,0.35)';
    document.body.appendChild(sprite);

    const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
    const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
    const arcLift = Math.max(70, Math.min(190, Math.abs(deltaX) * 0.28 + 70));

    const animation = sprite.animate(
      [
        { transform: 'translate(0px, 0px) scale(0.7)', borderRadius: '9999px', opacity: 0.9, offset: 0 },
        { transform: `translate(${deltaX * 0.24}px, ${deltaY * 0.18 - arcLift}px) scale(1.15) rotate(-7deg)`, borderRadius: '16px', opacity: 1, offset: 0.34 },
        { transform: `translate(${deltaX * 0.7}px, ${deltaY * 0.76 - arcLift * 0.28}px) scale(1.45) rotate(4deg)`, borderRadius: '10px', opacity: 0.98, offset: 0.72 },
        { transform: `translate(${deltaX * 1.05}px, ${deltaY * 1.05}px) scale(1.8)`, borderRadius: '8px', opacity: 0.96, offset: 0.9 },
        { transform: `translate(${deltaX}px, ${deltaY}px) scale(1.68)`, borderRadius: '8px', opacity: 0.95, offset: 1 }
      ],
      {
        duration: 2000,
        easing: 'cubic-bezier(0.2, 0.95, 0.2, 1)'
      }
    );

    animation.onfinish = () => {
      sprite.remove();
    };
    animation.oncancel = () => {
      sprite.remove();
    };
  }, []);

  const clearAutoplayResumeListeners = useCallback(() => {
    if (autoplayResumeCleanupRef.current) {
      autoplayResumeCleanupRef.current();
      autoplayResumeCleanupRef.current = null;
    }
  }, []);

  const tryPlayWithFallback = useCallback(async (audio: HTMLAudioElement): Promise<boolean> => {
    const originalMuted = audio.muted;

    try {
      await audio.play();
      clearAutoplayResumeListeners();
      return true;
    } catch {
      try {
        audio.muted = true;
        await audio.play();
        clearAutoplayResumeListeners();
        return true;
      } catch {
        return false;
      } finally {
        // Always restore the previous mute state after fallback attempts.
        audio.muted = originalMuted;
      }
    }
  }, [clearAutoplayResumeListeners]);

  const scheduleAutoplayResumeOnInteraction = useCallback((audio: HTMLAudioElement) => {
    if (typeof window === 'undefined' || autoplayResumeCleanupRef.current) return;

    const tryResume = async () => {
      try {
        await audio.play();
        clearAutoplayResumeListeners();
      } catch {
        // Keep listeners attached; next interaction will retry.
      }
    };

    const onInteract = () => {
      void tryResume();
    };

    window.addEventListener('pointerdown', onInteract);
    window.addEventListener('touchstart', onInteract);
    window.addEventListener('keydown', onInteract);

    autoplayResumeCleanupRef.current = () => {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('touchstart', onInteract);
      window.removeEventListener('keydown', onInteract);
    };
  }, [clearAutoplayResumeListeners]);

  const playEpisode = useCallback(
    async (episode: PlaybackEpisode, sourceElement?: HTMLElement | null) => {
      const audio = audioRef.current;
      if (!audio) return;

      playbackIntentRef.current = true;
      const sameEpisode = activeEpisode?.slug === episode.slug;
      if (!sameEpisode) {
        audio.src = episode.audioUrl;
        audio.load();
        audio.currentTime = 0;
        setCurrentTime(0);
        setDuration(0);
        setActiveEpisode(episode);
        if (episode.artworkUrl) animateArtworkFlight(episode.artworkUrl, sourceElement);
      }

      audio.playbackRate = playbackRate;
      // Manual play should never stay muted.
      audio.muted = false;
      const didResume = await tryPlayWithFallback(audio);
      if (!didResume) {
        console.error('Unable to start podcast playback after autoplay fallback.');
        scheduleAutoplayResumeOnInteraction(audio);
      }
    },
    [activeEpisode?.slug, animateArtworkFlight, playbackRate, scheduleAutoplayResumeOnInteraction, tryPlayWithFallback]
  );

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      playbackIntentRef.current = true;
      // Manual play should never stay muted.
      audio.muted = false;
      const didResume = await tryPlayWithFallback(audio);
      if (!didResume) {
        console.error('Unable to resume podcast playback after autoplay fallback.');
        scheduleAutoplayResumeOnInteraction(audio);
      }
      return;
    }
    playbackIntentRef.current = false;
    audio.pause();
  }, [scheduleAutoplayResumeOnInteraction, tryPlayWithFallback]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    playbackIntentRef.current = false;
    audio.pause();
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();
    playbackIntentRef.current = false;
    clearAutoplayResumeListeners();
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setActiveEpisode(null);
    setTrayExpanded(false);
    try {
      window.sessionStorage.removeItem(PLAYBACK_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear podcast playback session:', error);
    }
  }, [clearAutoplayResumeListeners]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
    const next = Math.min(Math.max(seconds, 0), max);
    audio.currentTime = next;
    setCurrentTime(next);
  }, []);

  const skipBy = useCallback((deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
    const next = Math.min(Math.max(audio.currentTime + deltaSeconds, 0), max);
    audio.currentTime = next;
    setCurrentTime(next);
  }, []);

  const cycleSpeed = useCallback(() => {
    const nextRate = playbackRate >= 2 ? 1 : Number((playbackRate + 0.25).toFixed(2));
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  }, [playbackRate]);

  const toggleSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
      setSleepTimerActive(false);
      return;
    }

    sleepTimerRef.current = setTimeout(() => {
      if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
      sleepTimerRef.current = null;
      setSleepTimerActive(false);
    }, 15 * 60 * 1000);
    setSleepTimerActive(true);
  }, []);

  const collapseTray = useCallback(() => {
    setTrayExpanded(false);
    setMobileSheetDragY(0);
    mobileDragStartYRef.current = null;
    mobileDragDeltaYRef.current = 0;
  }, []);

  const handleMobileHandleTouchStart = useCallback((event: ReactTouchEvent<HTMLButtonElement>) => {
    if (!trayExpanded) return;
    mobileDragStartYRef.current = event.touches[0]?.clientY ?? null;
    mobileDragDeltaYRef.current = 0;
    setMobileSheetDragY(0);
  }, [trayExpanded]);

  const handleMobileHandleTouchMove = useCallback((event: ReactTouchEvent<HTMLButtonElement>) => {
    if (mobileDragStartYRef.current === null) return;
    const nextY = event.touches[0]?.clientY ?? mobileDragStartYRef.current;
    const deltaY = Math.max(nextY - mobileDragStartYRef.current, 0);
    mobileDragDeltaYRef.current = deltaY;
    setMobileSheetDragY(Math.min(deltaY, 140));
  }, []);

  const handleMobileHandleTouchEnd = useCallback(() => {
    const deltaY = mobileDragDeltaYRef.current;
    mobileDragStartYRef.current = null;
    mobileDragDeltaYRef.current = 0;
    if (deltaY > 70) {
      collapseTray();
      return;
    }
    setMobileSheetDragY(0);
  }, [collapseTray]);

  useEffect(() => {
    latestPersistRef.current = {
      activeEpisode,
      currentTime,
      playbackRate,
      trayExpanded
    };
  }, [activeEpisode, currentTime, playbackRate, trayExpanded]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      playbackIntentRef.current = true;
      setIsPlaying(true);
    };
    const handlePause = () => {
      if (isPageUnloadingRef.current || restoringRef.current) return;
      setIsPlaying(false);
    };
    const handleEnded = () => {
      playbackIntentRef.current = false;
      setIsPlaying(false);
    };
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      clearAutoplayResumeListeners();
    };
  }, [clearAutoplayResumeListeners]);

  useEffect(() => {
    const markUnloading = () => {
      isPageUnloadingRef.current = true;
      try {
        const snapshot = latestPersistRef.current;
        if (!snapshot.activeEpisode) {
          window.sessionStorage.removeItem(PLAYBACK_STORAGE_KEY);
          return;
        }
        window.sessionStorage.setItem(
          PLAYBACK_STORAGE_KEY,
          JSON.stringify({
            activeEpisode: snapshot.activeEpisode,
            currentTime: snapshot.currentTime,
            playbackRate: snapshot.playbackRate,
            wasPlaying: playbackIntentRef.current,
            trayExpanded: snapshot.trayExpanded
          })
        );
      } catch (error) {
        console.error('Failed to persist podcast playback during unload:', error);
      }
    };
    const clearUnloading = () => {
      isPageUnloadingRef.current = false;
    };

    window.addEventListener('beforeunload', markUnloading);
    window.addEventListener('pagehide', markUnloading);
    window.addEventListener('pageshow', clearUnloading);
    return () => {
      window.removeEventListener('beforeunload', markUnloading);
      window.removeEventListener('pagehide', markUnloading);
      window.removeEventListener('pageshow', clearUnloading);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      const raw = window.sessionStorage.getItem(PLAYBACK_STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as {
        activeEpisode: PlaybackEpisode | null;
        currentTime: number;
        playbackRate: number;
        wasPlaying: boolean;
        trayExpanded: boolean;
      };

      if (!saved?.activeEpisode?.audioUrl) return;

      restoringRef.current = true;
      playbackIntentRef.current = Boolean(saved.wasPlaying);
      setActiveEpisode(saved.activeEpisode);
      setPlaybackRate(Number.isFinite(saved.playbackRate) ? saved.playbackRate : 1);
      setTrayExpanded(Boolean(saved.trayExpanded));
      setCurrentTime(Number.isFinite(saved.currentTime) ? Math.max(saved.currentTime, 0) : 0);
      audio.src = saved.activeEpisode.audioUrl;
      audio.load();
      audio.playbackRate = Number.isFinite(saved.playbackRate) ? saved.playbackRate : 1;

      const resumeAfterMetadata = async () => {
        const nextTime = Number.isFinite(saved.currentTime) ? Math.max(saved.currentTime, 0) : 0;
        const max = Number.isFinite(audio.duration) ? audio.duration : nextTime;
        audio.currentTime = Math.min(nextTime, max);
        setCurrentTime(audio.currentTime || 0);

        if (saved.wasPlaying) {
          let resumed = false;

          // Try 1 — unmuted autoplay (works when browser has sufficient engagement).
          try {
            audio.muted = false;
            await audio.play();
            resumed = true;
          } catch {
            // Try 2 — muted autoplay then immediate unmute. Most browsers
            // (Chrome, Firefox) allow muted autoplay and won't revoke
            // playback when the element is unmuted while already playing.
            try {
              audio.muted = true;
              await audio.play();
              audio.muted = false;
              // Give the browser a tick to potentially pause after unmute
              // (Safari may do this).
              await new Promise((r) => setTimeout(r, 100));
              resumed = !audio.paused;
            } catch {
              audio.muted = false;
            }
          }

          if (resumed) {
            clearAutoplayResumeListeners();
          } else {
            // Even muted autoplay was blocked — wait for first interaction.
            scheduleAutoplayResumeOnInteraction(audio);
          }
        }
        restoringRef.current = false;
      };

      if (audio.readyState >= 1) {
        void resumeAfterMetadata();
      } else {
        audio.addEventListener('loadedmetadata', () => void resumeAfterMetadata(), { once: true });
      }
    } catch (error) {
      console.error('Failed to restore podcast playback session:', error);
      restoringRef.current = false;
    }
  }, [clearAutoplayResumeListeners, scheduleAutoplayResumeOnInteraction]);

  useEffect(() => {
    if (restoringRef.current) return;
    try {
      if (!activeEpisode) {
        window.sessionStorage.removeItem(PLAYBACK_STORAGE_KEY);
        return;
      }
      window.sessionStorage.setItem(
        PLAYBACK_STORAGE_KEY,
        JSON.stringify({
          activeEpisode,
          currentTime,
          playbackRate,
          wasPlaying: playbackIntentRef.current,
          trayExpanded
        })
      );
    } catch (error) {
      console.error('Failed to persist podcast playback session:', error);
    }
  }, [activeEpisode, currentTime, playbackRate, isPlaying, trayExpanded]);

  const value = useMemo<PodcastPlaybackContextValue>(
    () => ({
      activeEpisode,
      isPlaying,
      duration,
      currentTime,
      playbackRate,
      sleepTimerActive,
      playEpisode,
      togglePlayPause,
      pause,
      stop,
      seekTo,
      skipBy,
      cycleSpeed,
      toggleSleepTimer
    }),
    [
      activeEpisode,
      isPlaying,
      duration,
      currentTime,
      playbackRate,
      sleepTimerActive,
      playEpisode,
      togglePlayPause,
      pause,
      stop,
      seekTo,
      skipBy,
      cycleSpeed,
      toggleSleepTimer
    ]
  );

  const remaining = Math.max(duration - currentTime, 0);

  return (
    <PodcastPlaybackContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
      {activeEpisode ? (
        <div className="pointer-events-none fixed bottom-3 right-3 z-50 flex items-end gap-2 max-[450px]:inset-x-0 max-[450px]:bottom-0 max-[450px]:right-0 max-[450px]:flex-col max-[450px]:items-stretch max-[450px]:gap-0">
          {/* ── Mobile sheet (≤450px) ── */}
          <aside
            className={`pointer-events-auto fixed inset-x-0 bottom-0 z-[51] w-screen rounded-t-3xl border border-b-0 border-white/25 px-4 py-4 shadow-[0_-20px_48px_rgba(0,0,0,0.45)] transition-all duration-300 min-[451px]:hidden ${
              isPlaying ? 'bg-carnival-red text-white' : 'bg-carnival-ink text-white'
            } ${
              trayExpanded
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-full opacity-0'
            }`}
            style={mobileSheetDragY > 0 ? { transform: `translateY(${mobileSheetDragY}px)` } : undefined}
            aria-hidden={!trayExpanded}
          >
            <div className="relative mb-2 h-8">
              <button
                type="button"
                onTouchStart={handleMobileHandleTouchStart}
                onTouchMove={handleMobileHandleTouchMove}
                onTouchEnd={handleMobileHandleTouchEnd}
                onTouchCancel={handleMobileHandleTouchEnd}
                className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center rounded-full px-2 py-2 touch-pan-y"
                aria-label="Collapse player"
              >
                <span className="h-1.5 w-14 rounded-full bg-white/45" />
              </button>

              <button
                type="button"
                onClick={collapseTray}
                className="absolute right-0 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 text-xs font-black text-white/90 hover:text-white"
                aria-label="Minimize player"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/episodes/${activeEpisode.slug}`}>
                <div className="relative h-10 w-10 overflow-hidden rounded-md border border-white/30 bg-black/35">
                  {activeEpisode.artworkUrl ? (
                    <Image
                      src={activeEpisode.artworkUrl}
                      alt={`Artwork for ${activeEpisode.title}`}
                      fill
                      sizes="40px"
                      className="object-cover"
                      quality={56}
                    />
                  ) : null}
                </div>
              </Link>

                <div className="min-w-0 flex-1">
                  <div className="mobile-player-ticker-wrap">
                    <p className="mobile-player-ticker text-sm font-black leading-tight">
                      {activeEpisode.episodeNumber !== null ? `Episode ${activeEpisode.episodeNumber}: ` : ''}
                      {activeEpisode.title}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">The Compendium Podcast</p>
                </div>

              </div>

              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-white/85">
                  <span>{formatClock(currentTime)}</span>
                  <span>-{formatClock(remaining)}</span>
                </div>
                <div className={`mobile-player-range-shell ${isPlaying ? 'mobile-player-range-shell-playing' : 'mobile-player-range-shell-paused'}`}>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => seekTo(Number(event.target.value))}
                    className={`audio-range mobile-player-range-input w-full min-w-0 ${
                      isPlaying ? 'audio-range-on-dark' : 'audio-range-paused-mobile'
                    }`}
                    aria-label="Seek audio"
                  />
                </div>
              </div>

              <div className="mt-2 grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 pb-5">
                <button
                  type="button"
                  onClick={cycleSpeed}
                  className="h-8 px-1 text-xs font-black text-white/95"
                  aria-label={`Playback speed ${playbackRate}x`}
                >
                  {playbackRate}x
                </button>

                <div className="justify-self-center flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => skipBy(-15)}
                    className="h-10 rounded-md border border-white/40 px-3 text-xs font-black text-white"
                    aria-label="Back 15 seconds"
                  >
                    -15
                  </button>
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-black ${
                      isPlaying ? 'border-white bg-white text-carnival-red' : 'border-white/80 bg-carnival-ink text-white'
                    }`}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                        <rect x="6" y="5" width="4" height="14" rx="1" />
                        <rect x="14" y="5" width="4" height="14" rx="1" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => skipBy(30)}
                    className="h-10 rounded-md border border-white/40 px-3 text-xs font-black text-white"
                    aria-label="Forward 30 seconds"
                  >
                    +30
                  </button>
                </div>

                <span aria-hidden="true" className="h-10" />
              </div>
          </aside>

          {/* ── Desktop bar + minimized artwork (>450px) ── */}
          <div className="pointer-events-auto hidden items-end gap-2 min-[451px]:flex">
            <aside
              className={`flex h-[4.2rem] w-[min(700px,calc(100vw-6rem))] items-center gap-2.5 rounded-xl border border-white/25 px-2.5 shadow-2xl transition-all duration-300 ${
                isPlaying ? 'bg-carnival-red text-white' : 'bg-carnival-ink text-white'
              } ${
                trayExpanded
                  ? 'translate-x-0 opacity-100'
                  : 'pointer-events-none hidden translate-x-6 opacity-0'
              }`}
            >
              {/* Play / Pause button (replaces internal artwork) */}
              <button
                type="button"
                onClick={togglePlayPause}
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black transition ${
                  isPlaying ? 'bg-white text-carnival-red' : 'bg-[#f4e7bc] text-carnival-ink'
                }`}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
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

              {/* Title + seek bar */}
              <div className="min-w-0 flex-1">
                <DesktopTicker className="text-[13px] font-black leading-tight">
                  {activeEpisode.episodeNumber !== null ? `Episode ${activeEpisode.episodeNumber}: ` : ''}
                  {activeEpisode.title}
                </DesktopTicker>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="w-9 text-[10px] font-bold text-white/80">{formatClock(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => seekTo(Number(event.target.value))}
                    className={`audio-range w-full min-w-0 ${isPlaying ? 'audio-range-on-dark' : 'audio-range-paused-strong'}`}
                    aria-label="Seek audio"
                  />
                  <span className="w-11 text-right text-[10px] font-bold text-white/80">-{formatClock(remaining)}</span>
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
                  onClick={() => skipBy(-15)}
                  className="rounded-md px-1 py-0.5 text-[11px] font-black text-white/85 hover:text-white"
                  aria-label="Back 15 seconds"
                >
                  -15
                </button>
                <button
                  type="button"
                  onClick={() => skipBy(30)}
                  className="rounded-md px-1 py-0.5 text-[11px] font-black text-white/85 hover:text-white"
                  aria-label="Forward 30 seconds"
                >
                  +30
                </button>
                <button
                  type="button"
                  onClick={collapseTray}
                  className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/50 text-[10px] font-black text-white/80 hover:text-white"
                  aria-label="Minimize player"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </aside>

            <button
              ref={launcherButtonRef as React.Ref<HTMLButtonElement>}
              type="button"
              onClick={() => setTrayExpanded((c) => !c)}
              className={`relative h-[4.2rem] w-[4.2rem] shrink-0 overflow-hidden rounded-md border-2 shadow-xl transition ${
                isPlaying ? 'border-white/60 bg-carnival-red' : 'border-carnival-ink/25 bg-[#f4e7bc]'
              }`}
              aria-label={trayExpanded ? 'Minimize player' : 'Expand player'}
              title={trayExpanded ? 'Minimize player' : 'Expand player'}
            >
              {activeEpisode.artworkUrl ? (
                <Image
                  src={activeEpisode.artworkUrl}
                  alt={`Artwork for ${activeEpisode.title}`}
                  fill
                  sizes="67px"
                  className="object-cover"
                  quality={56}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-black text-carnival-ink">EP</span>
              )}
            </button>
          </div>

          {/* ── Mobile artwork button (≤450px) — always visible ── */}
          <div className="pointer-events-auto fixed bottom-3 right-3 z-50 min-[451px]:hidden">
            <button
              ref={launcherButtonRef as React.Ref<HTMLButtonElement>}
              type="button"
              onClick={() => setTrayExpanded((c) => !c)}
              className={`relative h-14 w-14 overflow-hidden rounded-md border-2 shadow-xl transition ${
                isPlaying ? 'border-white/60 bg-carnival-red' : 'border-carnival-ink/25 bg-[#f4e7bc]'
              }`}
              aria-label={trayExpanded ? 'Minimize player' : 'Expand player'}
              title={trayExpanded ? 'Minimize player' : 'Expand player'}
            >
              {activeEpisode.artworkUrl ? (
                <Image
                  src={activeEpisode.artworkUrl}
                  alt={`Artwork for ${activeEpisode.title}`}
                  fill
                  sizes="56px"
                  className="object-cover"
                  quality={56}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-black text-carnival-ink">EP</span>
              )}
            </button>
          </div>
        </div>
      ) : null}
    </PodcastPlaybackContext.Provider>
  );
}

export function usePodcastPlayback() {
  const context = useContext(PodcastPlaybackContext);
  if (!context) {
    throw new Error('usePodcastPlayback must be used within PodcastPlaybackProvider');
  }
  return context;
}
