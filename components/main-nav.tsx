'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PATREON_INTERNAL_PATH } from '@/lib/patreon-links';

export function MainNav() {
  const instagramUrl = 'https://www.instagram.com/thecompendiumpodcast/';
  const youtubeUrl = 'https://www.youtube.com/@CompendiumPodcast';
  const youtubeMusicUrl = 'https://music.youtube.com/channel/UCQR5hWsxuu9wh7QvR60qmIw';
  const moreItems = [
    { href: '/connect', label: 'Connect', prefetch: true },
    { href: '/meet-the-team', label: 'The Team', prefetch: true },
    { href: '/reviews', label: 'Reviews', prefetch: false },
    { href: '/blog', label: 'Blog', prefetch: false }
  ];
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() || '';
  const isAdminRoute = pathname.startsWith('/admin');

  useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (open && !drawerRef.current?.contains(target)) setOpen(false);
      if (moreOpen && !moreMenuRef.current?.contains(target)) setMoreOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setMoreOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, moreOpen]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const navLinkClass = (href: string) =>
    `text-base font-bold transition-colors ${
      isActive(href)
        ? 'text-carnival-red underline underline-offset-4 decoration-2'
        : 'text-carnival-ink/70 hover:text-carnival-red'
    }`;

  const mobileNavLinkClass = (href: string) =>
    `flex w-full justify-center rounded-lg px-4 py-2.5 text-base font-bold transition-colors ${
      isActive(href)
        ? 'text-carnival-red underline underline-offset-4 decoration-2'
        : 'text-carnival-ink/70 hover:text-carnival-red'
    }`;
  const isMoreActive = moreItems.some((item) => isActive(item.href));
  const moreNavLinkClass = `inline-flex items-center gap-1 text-base font-bold transition-colors ${
    isMoreActive || moreOpen
      ? 'text-carnival-red underline underline-offset-4 decoration-2'
      : 'text-carnival-ink/70 hover:text-carnival-red'
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
            className="h-auto w-[130px] md:w-[200px] object-contain"
            sizes="(max-width: 768px) 130px, 200px"
          />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {isAdminRoute ? (
            <Link href="/" target="_blank" rel="noopener noreferrer" className="btn-primary">
              Visit Site
            </Link>
          ) : (
            <>
              <Link href="/" className={navLinkClass('/')}>
                Home
              </Link>
              <Link href="/episodes" className={navLinkClass('/episodes')} prefetch={false}>
                Episodes
              </Link>
              <Link href="/merch" className={navLinkClass('/merch')}>
                Merch
              </Link>
              <Link href="/jobs" className={navLinkClass('/jobs')}>
                Jobs
              </Link>
              <div className="relative" ref={moreMenuRef}>
                <button
                  type="button"
                  className={moreNavLinkClass}
                  aria-haspopup="menu"
                  aria-controls="desktop-more-menu"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((current) => !current)}
                >
                  More
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div
                  id="desktop-more-menu"
                  role="menu"
                  aria-hidden={!moreOpen}
                  className={`absolute right-0 z-[90] mt-2 min-w-[12rem] rounded-xl border border-carnival-ink/20 bg-carnival-cream p-2 shadow-card transition ${
                    moreOpen
                      ? 'pointer-events-auto visible translate-y-0 opacity-100'
                      : 'pointer-events-none invisible -translate-y-1 opacity-0'
                  }`}
                >
                  {moreItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={item.prefetch}
                      tabIndex={moreOpen ? 0 : -1}
                      className={`block rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        isActive(item.href)
                          ? 'bg-carnival-red/10 text-carnival-red'
                          : 'text-carnival-ink/80 hover:bg-carnival-gold/25 hover:text-carnival-ink'
                      }`}
                      onClick={() => setMoreOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
              <Link href={PATREON_INTERNAL_PATH} className="btn-primary">
                Patreon
              </Link>
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
            onClick={() => setOpen((v) => !v)}
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
        <div
          className="fixed inset-0 z-[80] bg-black/35 transition-opacity duration-200 md:hidden"
        >
          <div
            id="mobile-nav-menu"
            ref={drawerRef}
            className="absolute right-0 top-0 h-full w-[82%] max-w-xs border-l border-carnival-ink/25 bg-carnival-cream p-4 text-carnival-ink shadow-card transition-transform duration-200 translate-x-0 flex flex-col"
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
              <Link href="/" className={mobileNavLinkClass('/')} onClick={() => setOpen(false)}>
                Home
              </Link>
              <Link href="/episodes" className={mobileNavLinkClass('/episodes')} prefetch={false} onClick={() => setOpen(false)}>
                Episodes
              </Link>
              <Link href="/merch" className={mobileNavLinkClass('/merch')} onClick={() => setOpen(false)}>
                Merch
              </Link>
              <Link href="/jobs" className={mobileNavLinkClass('/jobs')} onClick={() => setOpen(false)}>
                Jobs
              </Link>
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={item.prefetch}
                  className={mobileNavLinkClass(item.href)}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link href={PATREON_INTERNAL_PATH} className="btn-primary flex w-full justify-center" onClick={() => setOpen(false)}>
                Patreon
              </Link>
            </div>

            <div className="mt-auto pt-4">
              <p className="text-xs font-black uppercase tracking-widest text-carnival-ink/60">Socials</p>
              <div className="mt-2 border-t border-carnival-ink/15 pt-3 flex items-center justify-center gap-3">
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-1 text-carnival-ink transition hover:text-carnival-red"
                  onClick={() => setOpen(false)}
                  aria-label="Instagram"
                >
                  <Image src="/ig-instagram-icon.svg" alt="" width={28} height={28} className="h-7 w-7" aria-hidden="true" />
                </a>
                <Link
                  href={PATREON_INTERNAL_PATH}
                  className="inline-flex items-center justify-center p-1 text-carnival-ink transition hover:text-carnival-red"
                  onClick={() => setOpen(false)}
                  aria-label="Patreon"
                >
                  <Image src="/patreon-icon.svg" alt="" width={28} height={28} className="h-7 w-7" aria-hidden="true" />
                </Link>
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-1 text-carnival-ink transition hover:text-carnival-red"
                  onClick={() => setOpen(false)}
                  aria-label="YouTube"
                >
                  <Image src="/youtube-color-icon.svg" alt="" width={28} height={28} className="h-7 w-7" aria-hidden="true" />
                </a>
                <a
                  href={youtubeMusicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-1 text-carnival-ink transition hover:text-carnival-red"
                  onClick={() => setOpen(false)}
                  aria-label="YouTube Music"
                >
                  <Image src="/youtube-music-icon.svg" alt="" width={28} height={28} className="h-7 w-7" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
