'use client';

import { usePathname } from 'next/navigation';
import { PATREON_URL } from '@/lib/patreon-links';
import { resolveSourcePageType, type CtaLocation } from '@/lib/analytics-events';
import { TrackedExternalCtaLink } from '@/components/tracked-external-cta-link';

export function SupportAndListenCta({
  pageType,
  pageSlug,
  pageUrl,
  contentTitle,
  placement,
  variant = 'hero',
  className = ''
}: {
  pageType: string;
  pageSlug?: string;
  pageUrl?: string;
  contentTitle?: string;
  placement?: string;
  variant?: 'hero' | 'compact';
  className?: string;
}) {
  const pathname = usePathname();
  const resolvedSourcePageType = resolveSourcePageType(pathname);
  const sourcePagePath = typeof window === 'undefined' ? (pathname || '/') : `${window.location.pathname}${window.location.search || ''}`;
  const normalizedLocation = `${placement || ''}`.trim().toLowerCase();
  const ctaLocation: CtaLocation =
    normalizedLocation === 'hero' || normalizedLocation === 'header' || normalizedLocation === 'footer'
      ? (normalizedLocation as CtaLocation)
      : resolvedSourcePageType === 'blog_post'
        ? 'blog_post'
        : resolvedSourcePageType === 'episode_page'
          ? 'episode_page'
          : resolvedSourcePageType === 'patreon_page'
            ? 'patreon_page'
            : 'other_cta';

  const wrapperClass =
    variant === 'compact'
      ? 'rounded-2xl border border-carnival-ink/15 bg-white p-5'
      : 'rounded-3xl border border-carnival-gold/25 bg-carnival-ink px-6 py-8 text-white';

  return (
    <section
      className={`${wrapperClass} ${className}`.trim()}
      data-blog-cta="1"
      data-page-type={pageType}
      data-page-slug={pageSlug || ''}
      data-page-url={pageUrl || ''}
      data-content-title={contentTitle || ''}
      data-placement={placement || ''}
      aria-label="Support and listen actions"
    >
      <h2 className={`font-black ${variant === 'compact' ? 'text-xl text-carnival-ink' : 'text-3xl text-white'}`}>Support And Listen</h2>
      <p className={variant === 'compact' ? 'mt-2 text-carnival-ink/75' : 'mt-2 text-white/80'}>
        Catch more episodes, support the show, and stay connected with The Compendium.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <TrackedExternalCtaLink
          href="https://open.spotify.com/show/5fA8xqUEfXvD8WQmMsmFJk"
          target="_blank"
          destination="spotify"
          ctaLocation={ctaLocation}
          sourcePageType={resolvedSourcePageType}
          sourcePagePath={sourcePagePath}
          className="inline-flex items-center justify-center rounded-full bg-[#1DB954] px-5 py-2.5 text-sm font-black text-white no-underline transition hover:brightness-110"
        >
          Listen On Spotify
        </TrackedExternalCtaLink>
        <TrackedExternalCtaLink
          href="https://podcasts.apple.com/us/podcast/the-compendium-podcast/id1531291277"
          target="_blank"
          destination="apple_podcasts"
          ctaLocation={ctaLocation}
          sourcePageType={resolvedSourcePageType}
          sourcePagePath={sourcePagePath}
          className="inline-flex items-center justify-center rounded-full bg-[#D56DFB] px-5 py-2.5 text-sm font-black text-white no-underline transition hover:brightness-110"
        >
          Listen On Apple
        </TrackedExternalCtaLink>
        <TrackedExternalCtaLink
          href={PATREON_URL}
          destination="patreon"
          ctaLocation={ctaLocation}
          sourcePageType={resolvedSourcePageType}
          sourcePagePath={sourcePagePath}
          target="_blank"
          className="inline-flex items-center justify-center rounded-full bg-carnival-red px-5 py-2.5 text-sm font-black text-white no-underline transition hover:brightness-110"
        >
          Join Patreon
        </TrackedExternalCtaLink>
      </div>
    </section>
  );
}
