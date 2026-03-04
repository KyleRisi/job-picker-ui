'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function MainNav() {
  const patreonUrl = 'https://www.patreon.com/cw/TheCompendiumPodcast';
  const instagramUrl = 'https://www.instagram.com/thecompendiumpodcast/';
  const youtubeUrl = 'https://www.youtube.com/@CompendiumPodcast';
  const youtubeMusicUrl = 'https://music.youtube.com/channel/UCQR5hWsxuu9wh7QvR60qmIw';
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (open && !drawerRef.current?.contains(target)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
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
  }, [open]);

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
            priority
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
              <Link href="/reviews" className={navLinkClass('/reviews')} prefetch={false}>
                Reviews
              </Link>
              <Link href="/connect" className={navLinkClass('/connect')}>
                Connect
              </Link>
              <Link href="/merch" className={navLinkClass('/merch')}>
                Merch
              </Link>
              <Link href="/jobs" className={navLinkClass('/jobs')}>
                Jobs
              </Link>
              <a href={patreonUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Patreon
              </a>
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
              <Link href="/reviews" className={mobileNavLinkClass('/reviews')} prefetch={false} onClick={() => setOpen(false)}>
                Reviews
              </Link>
              <Link href="/connect" className={mobileNavLinkClass('/connect')} onClick={() => setOpen(false)}>
                Connect
              </Link>
              <Link href="/merch" className={mobileNavLinkClass('/merch')} onClick={() => setOpen(false)}>
                Merch
              </Link>
              <Link href="/jobs" className={mobileNavLinkClass('/jobs')} onClick={() => setOpen(false)}>
                Jobs
              </Link>
              <a href={patreonUrl} target="_blank" rel="noopener noreferrer" className="btn-primary flex w-full justify-center">
                Patreon
              </a>
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
                <a
                  href={patreonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-1 text-carnival-ink transition hover:text-carnival-red"
                  onClick={() => setOpen(false)}
                  aria-label="Patreon"
                >
                  <Image src="/patreon-icon.svg" alt="" width={28} height={28} className="h-7 w-7" aria-hidden="true" />
                </a>
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
