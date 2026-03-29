'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { currentPathWithSearch, resolveSourcePageType } from '@/lib/analytics-events';
import { trackMixpanel } from '@/lib/mixpanel-browser';
import { TrackedExternalCtaLink } from '@/components/tracked-external-cta-link';

const SPOTIFY_URL = 'https://open.spotify.com/show/30Hh0xbotgbIyCL5tJE4zJ';
const APPLE_PODCASTS_URL = 'https://podcasts.apple.com/gb/podcast/the-compendium-an-assembly-of-fascinating-things/id1676817109';
const INSTAGRAM_URL = 'https://www.instagram.com/thecompendiumpodcast/';
const PATREON_URL = '/patreon';
const SUGGESTIONS_URL = '/freaky-register';
const CONTACT_URL = '/connect';
const PRIVACY_URL = '/connect';
const TERMS_URL = '/connect';
const COOKIE_POLICY_URL = '/connect';

function footerLinkClassName() {
  return 'text-[0.93rem] font-medium text-white/76 transition hover:text-carnival-gold focus-visible:text-carnival-gold';
}

function footerHeadingClassName() {
  return 'text-[11px] font-black uppercase tracking-[0.18em] text-carnival-gold/95';
}

export function SiteFooter({ showTopBorder = true }: { showTopBorder?: boolean }) {
  const pathname = usePathname();
  const sourcePageType = resolveSourcePageType(pathname);
  const [listenChooserOpen, setListenChooserOpen] = useState(false);
  const chooserRef = useRef<HTMLDivElement>(null);
  const chooserButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setListenChooserOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!listenChooserOpen) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (chooserButtonRef.current?.contains(target)) return;
      if (chooserRef.current?.contains(target)) return;
      setListenChooserOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setListenChooserOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [listenChooserOpen]);

  const sourcePagePath = currentPathWithSearch();

  return (
    <footer
      className={`full-bleed relative overflow-hidden bg-[#131927] pt-12 pb-7 text-white ${showTopBorder ? 'border-t border-white/26' : ''}`}
      aria-labelledby="site-footer-heading"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-carnival-red/10 blur-[120px]" />
        <div className="absolute right-0 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-carnival-gold/10 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4">
        <h2 id="site-footer-heading" className="sr-only">Site footer</h2>

        <div className="grid gap-10 border-b border-white/14 pb-9 lg:grid-cols-[1fr_2.2fr] lg:gap-8">
          <section aria-labelledby="footer-brand-title" className="max-w-sm">
            <Link href="/" className="inline-flex" aria-label="The Compendium Podcast home">
              <Image
                src="/thecompendiumlogowhite.svg"
                alt="The Compendium Podcast"
                width={1281}
                height={293}
                className="h-auto w-[180px] object-contain sm:w-[224px]"
                sizes="(max-width: 640px) 180px, 224px"
              />
            </Link>
            <p id="footer-brand-title" className="mt-4 text-sm leading-relaxed text-white/83">
              Fascinating stories, strange lives, and
              <br />
              things people can&apos;t stop talking about.
            </p>

            <div className="relative mt-6 inline-flex flex-col items-start">
              <button
                ref={chooserButtonRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={listenChooserOpen}
                aria-controls="footer-listen-now-chooser"
                className="inline-flex min-h-[44px] items-center rounded-md bg-carnival-red px-5 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:brightness-110"
                onClick={() => {
                  setListenChooserOpen((value) => {
                    const next = !value;
                    if (next) {
                      trackMixpanel('Listen Now Chooser Opened', {
                        cta_location: 'footer',
                        source_page_type: sourcePageType,
                        source_page_path: sourcePagePath,
                        surface: 'footer'
                      });
                    }
                    return next;
                  });
                }}
              >
                Listen Now
              </button>

              {listenChooserOpen ? (
                <div
                  id="footer-listen-now-chooser"
                  ref={chooserRef}
                  role="dialog"
                  aria-label="Choose listening platform"
                  className="absolute bottom-[calc(100%+0.7rem)] left-0 z-20 w-[270px] rounded-xl border border-white/20 bg-[#1a2232] p-3 shadow-[0_16px_38px_rgba(0,0,0,0.45)]"
                >
                  <p className="mb-2 text-sm font-semibold text-white/90">Choose your preferred app</p>
                  <div className="space-y-2">
                    <TrackedExternalCtaLink
                      href={SPOTIFY_URL}
                      target="_blank"
                      destination="spotify"
                      ctaLocation="footer"
                      sourcePageType={sourcePageType}
                      sourcePagePath={sourcePagePath}
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-[#1DB954] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110"
                    >
                      Listen on Spotify
                    </TrackedExternalCtaLink>
                    <TrackedExternalCtaLink
                      href={APPLE_PODCASTS_URL}
                      target="_blank"
                      destination="apple_podcasts"
                      ctaLocation="footer"
                      sourcePageType={sourcePageType}
                      sourcePagePath={sourcePagePath}
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-[#9933CC] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110"
                    >
                      Listen on Apple Podcasts
                    </TrackedExternalCtaLink>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            <nav aria-labelledby="footer-explore-heading">
              <p id="footer-explore-heading" className={footerHeadingClassName()}>Explore</p>
              <ul className="mt-3 space-y-2.5">
                <li><Link href="/episodes" className={footerLinkClassName()}>Episodes</Link></li>
                <li><Link href="/topics" className={footerLinkClassName()}>Topics</Link></li>
                <li><Link href="/topics/true-crime" className={footerLinkClassName()}>True Crime</Link></li>
                <li><Link href="/topics/history" className={footerLinkClassName()}>History</Link></li>
                <li><Link href="/topics/incredible-people" className={footerLinkClassName()}>Incredible People</Link></li>
              </ul>
            </nav>

            <nav aria-labelledby="footer-community-heading">
              <p id="footer-community-heading" className={footerHeadingClassName()}>Community</p>
              <ul className="mt-3 space-y-2.5">
                <li><Link href={SUGGESTIONS_URL} className={footerLinkClassName()}>Suggestions</Link></li>
                <li><Link href="/jobs" className={footerLinkClassName()}>Jobs</Link></li>
                <li><Link href="/reviews" className={footerLinkClassName()}>Reviews</Link></li>
                <li><Link href="/merch" className={footerLinkClassName()}>Merch</Link></li>
              </ul>
            </nav>

            <nav aria-labelledby="footer-about-heading">
              <p id="footer-about-heading" className={footerHeadingClassName()}>About</p>
              <ul className="mt-3 space-y-2.5">
                <li><Link href="/meet-the-team" className={footerLinkClassName()}>Meet the Team</Link></li>
                <li><Link href="/connect/press-kit" className={footerLinkClassName()}>Press Kit</Link></li>
                <li><Link href={CONTACT_URL} className={footerLinkClassName()}>Contact</Link></li>
                <li><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className={footerLinkClassName()}>Instagram</a></li>
              </ul>
            </nav>

            <nav aria-labelledby="footer-support-heading">
              <p id="footer-support-heading" className={footerHeadingClassName()}>Support</p>
              <ul className="mt-3 space-y-2.5">
                <li><Link href={PATREON_URL} className={footerLinkClassName()}>Patreon</Link></li>
              </ul>
            </nav>

            <nav aria-labelledby="footer-listen-heading">
              <p id="footer-listen-heading" className={footerHeadingClassName()}>Listen</p>
              <ul className="mt-3 space-y-2.5">
                <li>
                  <TrackedExternalCtaLink
                    href={SPOTIFY_URL}
                    target="_blank"
                    destination="spotify"
                    ctaLocation="footer"
                    sourcePageType={sourcePageType}
                    sourcePagePath={sourcePagePath}
                    className={footerLinkClassName()}
                  >
                    Spotify
                  </TrackedExternalCtaLink>
                </li>
                <li>
                  <TrackedExternalCtaLink
                    href={APPLE_PODCASTS_URL}
                    target="_blank"
                    destination="apple_podcasts"
                    ctaLocation="footer"
                    sourcePageType={sourcePageType}
                    sourcePagePath={sourcePagePath}
                    className={footerLinkClassName()}
                  >
                    Apple Podcasts
                  </TrackedExternalCtaLink>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 text-xs text-white/60 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p>© The Compendium</p>
          <nav aria-label="Legal links" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href={PRIVACY_URL} className="transition hover:text-white">Privacy Policy</Link>
            <Link href={TERMS_URL} className="transition hover:text-white">Terms</Link>
            <Link href={COOKIE_POLICY_URL} className="transition hover:text-white">Cookie Policy</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
