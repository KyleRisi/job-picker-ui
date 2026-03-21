'use client';

import Link from 'next/link';
import { MouseEvent, useRef } from 'react';
import { trackMixpanel } from '@/lib/mixpanel-browser';
import type { CtaLocation, SourcePageType } from '@/lib/analytics-events';

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
  ctaLocation: CtaLocation;
  sourcePageType: SourcePageType;
  sourcePagePath: string;
  episodeTitle?: string;
  episodeSlug?: string;
  target?: string;
  rel?: string;
  ariaLabel?: string;
  title?: string;
  onClick?: () => void;
};

function isInternalPatreonHref(href: string): boolean {
  return href === '/patreon' || href.startsWith('/patreon?') || href.startsWith('/patreon#');
}

function defaultRel(target: string | undefined, rel: string | undefined): string | undefined {
  if (rel) return rel;
  if (target === '_blank') return 'noreferrer';
  return undefined;
}

export function TrackedPatreonCtaLink({
  href,
  className,
  children,
  ctaLocation,
  sourcePageType,
  sourcePagePath,
  episodeTitle,
  episodeSlug,
  target,
  rel,
  ariaLabel,
  title,
  onClick
}: Props) {
  const lastClickRef = useRef(0);
  const internal = isInternalPatreonHref(href);

  const onTrackedClick = (event?: MouseEvent<HTMLAnchorElement>) => {
    const now = Date.now();
    if (now - lastClickRef.current < 700) {
      if (event) event.preventDefault();
      return;
    }
    lastClickRef.current = now;

    const commonProperties: Record<string, unknown> = {
      cta_location: ctaLocation,
      source_page_type: sourcePageType,
      source_page_path: sourcePagePath
    };
    if (episodeTitle) commonProperties.episode_title = episodeTitle;
    if (episodeSlug) commonProperties.episode_slug = episodeSlug;

    if (internal) {
      trackMixpanel('Patreon CTA Clicked', {
        ...commonProperties,
        target_type: 'internal_patreon_page'
      });
      onClick?.();
      return;
    }

    trackMixpanel('Patreon CTA Clicked', {
      ...commonProperties,
      target_type: 'external_patreon'
    });
    trackMixpanel('External CTA Clicked', {
      ...commonProperties,
      destination: 'patreon'
    });
    onClick?.();

    if (!event) return;
    if (target === '_blank') return;

    event.preventDefault();
    window.setTimeout(() => {
      window.location.assign(href);
    }, 120);
  };

  if (internal) {
    return (
      <Link
        href={href}
        className={className}
        aria-label={ariaLabel}
        title={title}
        onClick={() => onTrackedClick()}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target={target}
      rel={defaultRel(target, rel)}
      className={className}
      aria-label={ariaLabel}
      title={title}
      onClick={onTrackedClick}
    >
      {children}
    </a>
  );
}
