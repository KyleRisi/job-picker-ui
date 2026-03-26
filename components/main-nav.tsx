'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { currentPathWithSearch, resolveSourcePageType } from '@/lib/analytics-events';
import { trackMixpanel } from '@/lib/mixpanel-browser';

const SPOTIFY_URL = 'https://open.spotify.com/show/30Hh0xbotgbIyCL5tJE4zJ';
const APPLE_PODCASTS_URL = 'https://podcasts.apple.com/gb/podcast/the-compendium-an-assembly-of-fascinating-things/id1676817109';

const NAV_ITEMS = [
  { href: '/topics', label: 'Topics', prefetch: true },
  { href: '/episodes', label: 'Episodes', prefetch: false },
  { href: '/reviews', label: 'Reviews', prefetch: false },
  { href: '/connect', label: 'Connect', prefetch: true },
  { href: '/patreon', label: 'Patreon', prefetch: true }
] as const;

export function MainNav() {
  const [open, setOpen] = useState(false);
  const [listenChooserOpen, setListenChooserOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const desktopListenNowButtonRef = useRef<HTMLButtonElement>(null);
  const desktopChooserRef = useRef<HTMLDivElement>(null);
  const desktopFirstActionRef = useRef<HTMLAnchorElement>(null);
  const mobileListenNowButtonRef = useRef<HTMLButtonElement>(null);
  const mobileChooserRef = useRef<HTMLDivElement>(null);
  const mobileFirstActionRef = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname() || '';
  const isAdminRoute = pathname.startsWith('/admin');
  const sourcePageType = resolveSourcePageType(pathname);

  useEffect(() => {
    setOpen(false);
    setListenChooserOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (open && !drawerRef.current?.contains(target)) {
        setOpen(false);
        setListenChooserOpen(false);
        return;
      }

      if (!listenChooserOpen) return;

      const clickedDesktopTrigger = desktopListenNowButtonRef.current?.contains(target) || false;
      const clickedDesktopChooser = desktopChooserRef.current?.contains(target) || false;
      const clickedMobileTrigger = mobileListenNowButtonRef.current?.contains(target) || false;
      const clickedMobileChooser = mobileChooserRef.current?.contains(target) || false;

      if (open) {
        if (!clickedMobileTrigger && !clickedMobileChooser) setListenChooserOpen(false);
        return;
      }

      if (!clickedDesktopTrigger && !clickedDesktopChooser) setListenChooserOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (listenChooserOpen) {
        setListenChooserOpen(false);
        return;
      }
      setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, listenChooserOpen]);

  useEffect(() => {
    if (!listenChooserOpen) return;
    if (open) {
      mobileFirstActionRef.current?.focus();
      return;
    }
    desktopFirstActionRef.current?.focus();
  }, [listenChooserOpen, open]);

  const trackListenChooserOpened = (surface: 'desktop' | 'mobile') => {
    trackMixpanel('Listen Now Chooser Opened', {
      cta_location: 'header',
      source_page_type: sourcePageType,
      source_page_path: currentPathWithSearch(),
      surface
    });
  };

  const trackPlatformClick = (destination: 'spotify' | 'apple_podcasts', surface: 'desktop' | 'mobile') => {
    trackMixpanel('External CTA Clicked', {
      destination,
      cta_location: 'header',
      source_page_type: sourcePageType,
      source_page_path: currentPathWithSearch(),
      surface,
      target_type: 'listen_platform'
    });
  };

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const navLinkClass = (href: string) =>
    `text-base font-bold transition-colors ${
      isActive(href)
        ? 'text-carnival-red underline underline-offset-4 decoration-2'
        : 'text-carnival-ink/75 hover:text-carnival-red'
    }`;

  const mobileNavLinkClass = (href: string) =>
    `flex w-full justify-center rounded-lg px-4 py-2.5 text-base font-bold transition-colors ${
      isActive(href)
        ? 'text-carnival-red underline underline-offset-4 decoration-2'
        : 'text-carnival-ink/75 hover:text-carnival-red'
    }`;

  return (
    <nav
      className={isAdminRoute ? 'w-full px-4 py-4' : 'mx-auto max-w-6xl px-4 py-4'}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="block shrink-0" aria-label="The Compendium Podcast home">
          <Image
            src="/compendium-logo.png"
            alt="The Compendium Podcast"
            width={280}
            height={60}
            className="h-auto w-[130px] object-contain md:w-[200px]"
            sizes="(max-width: 768px) 130px, 200px"
          />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {isAdminRoute ? (
            <Link href="/" target="_blank" rel="noopener noreferrer" className="btn-primary">
              Visit Site
            </Link>
          ) : (
            <>
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className={navLinkClass(item.href)} prefetch={item.prefetch}>
                  {item.label}
                </Link>
              ))}
              <div className="relative">
                <button
                  ref={desktopListenNowButtonRef}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={listenChooserOpen}
                  aria-controls="listen-now-chooser-desktop"
                  onClick={() => {
                    setListenChooserOpen((value) => {
                      const next = !value;
                      if (next) trackListenChooserOpened('desktop');
                      return next;
                    });
                  }}
                  className="inline-flex items-center rounded-md bg-carnival-red px-4 py-2 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110"
                >
                  Listen Now
                </button>
                {listenChooserOpen ? (
                  <div
                    id="listen-now-chooser-desktop"
                    ref={desktopChooserRef}
                    role="dialog"
                    aria-label="Choose listening platform"
                    className="absolute right-0 top-[calc(100%+0.6rem)] z-[90] w-[292px] rounded-xl border border-carnival-ink/15 bg-carnival-cream p-3 shadow-card"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-carnival-ink">Choose your preferred app</p>
                      <button
                        type="button"
                        aria-label="Close platform chooser"
                        onClick={() => setListenChooserOpen(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-carnival-ink/70 transition hover:bg-carnival-ink/8 hover:text-carnival-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carnival-red"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 6L18 18" />
                          <path d="M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-2">
                      <a
                        ref={desktopFirstActionRef}
                        href={SPOTIFY_URL}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          trackPlatformClick('spotify', 'desktop');
                          setListenChooserOpen(false);
                        }}
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-[#1DB954] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carnival-red"
                      >
                        Listen on Spotify
                      </a>
                      <a
                        href={APPLE_PODCASTS_URL}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          trackPlatformClick('apple_podcasts', 'desktop');
                          setListenChooserOpen(false);
                        }}
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-[#9933CC] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carnival-red"
                      >
                        Listen on Apple Podcasts
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        {isAdminRoute ? null : (
          <button
            type="button"
            className="relative p-2 group md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <div className="flex h-7 w-7 flex-col items-center justify-center gap-[5px]">
              <span
                className={`block h-[2.5px] w-6 rounded-full transition-all duration-300 ease-in-out ${
                  open
                    ? 'translate-y-[7.5px] rotate-45 bg-carnival-red scale-x-110'
                    : 'bg-carnival-ink group-hover:bg-carnival-red'
                }`}
              />
              <span
                className={`block h-[2.5px] w-6 rounded-full transition-all duration-300 ease-in-out ${
                  open
                    ? 'opacity-0 scale-x-0 bg-carnival-red'
                    : 'bg-carnival-ink group-hover:bg-carnival-red'
                }`}
              />
              <span
                className={`block h-[2.5px] w-6 rounded-full transition-all duration-300 ease-in-out ${
                  open
                    ? '-translate-y-[7.5px] -rotate-45 bg-carnival-red scale-x-110'
                    : 'bg-carnival-ink group-hover:bg-carnival-red'
                }`}
              />
            </div>
          </button>
        )}
      </div>

      {!isAdminRoute && open ? (
        <div className="fixed inset-0 z-[80] bg-black/35 transition-opacity duration-200 md:hidden">
          <div
            id="mobile-nav-menu"
            ref={drawerRef}
            className="absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col border-l border-carnival-ink/25 bg-carnival-cream p-4 text-carnival-ink shadow-card"
            role="dialog"
            aria-label="Navigation menu"
            aria-modal="true"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-bold">Menu</p>
              <button
                type="button"
                className="p-2 group"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <div className="flex h-6 w-6 flex-col items-center justify-center">
                  <span className="block h-[2.5px] w-5 translate-y-[1.25px] rotate-45 rounded-full bg-carnival-red transition-colors group-hover:bg-carnival-ink" />
                  <span className="block h-[2.5px] w-5 -translate-y-[1.25px] -rotate-45 rounded-full bg-carnival-red transition-colors group-hover:bg-carnival-ink" />
                </div>
              </button>
            </div>

            <div className="space-y-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={item.prefetch}
                  className={mobileNavLinkClass(item.href)}
                  onClick={() => {
                    setOpen(false);
                    setListenChooserOpen(false);
                  }}
                >
                  {item.label}
                </Link>
              ))}

              <button
                ref={mobileListenNowButtonRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={listenChooserOpen}
                aria-controls="listen-now-chooser-mobile"
                className="btn-primary mt-2 flex w-full justify-center"
                onClick={() => {
                  setListenChooserOpen((value) => {
                    const next = !value;
                    if (next) trackListenChooserOpened('mobile');
                    return next;
                  });
                }}
              >
                Listen Now
              </button>
            </div>

            {listenChooserOpen ? (
              <div
                className="absolute inset-0 z-10 flex items-end bg-carnival-ink/35 p-3"
                onClick={(event) => {
                  if (event.target === event.currentTarget) setListenChooserOpen(false);
                }}
              >
                <div
                  id="listen-now-chooser-mobile"
                  ref={mobileChooserRef}
                  role="dialog"
                  aria-label="Choose listening platform"
                  className="w-full rounded-2xl border border-carnival-ink/15 bg-carnival-cream p-4 shadow-card"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-carnival-ink">Choose your preferred app</p>
                    <button
                      type="button"
                      aria-label="Close platform chooser"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-carnival-ink/70 transition hover:bg-carnival-ink/8 hover:text-carnival-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carnival-red"
                      onClick={() => setListenChooserOpen(false)}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 6L18 18" />
                        <path d="M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-2">
                    <a
                      ref={mobileFirstActionRef}
                      href={SPOTIFY_URL}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        trackPlatformClick('spotify', 'mobile');
                        setListenChooserOpen(false);
                        setOpen(false);
                      }}
                      className="inline-flex min-h-[48px] w-full items-center justify-center rounded-md bg-[#1DB954] px-4 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carnival-red"
                    >
                      Listen on Spotify
                    </a>
                    <a
                      href={APPLE_PODCASTS_URL}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        trackPlatformClick('apple_podcasts', 'mobile');
                        setListenChooserOpen(false);
                        setOpen(false);
                      }}
                      className="inline-flex min-h-[48px] w-full items-center justify-center rounded-md bg-[#9933CC] px-4 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carnival-red"
                    >
                      Listen on Apple Podcasts
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
