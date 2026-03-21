'use client';

import { MouseEvent, useRef } from 'react';
import { trackMixpanel } from '@/lib/mixpanel-browser';
import {
  CtaLocation,
  Destination,
  SourcePageType,
  currentPathWithSearch,
  resolveDestination
} from '@/lib/analytics-events';

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
  ctaLocation: CtaLocation;
  sourcePageType?: SourcePageType;
  sourcePagePath?: string;
  destination?: Destination;
  episodeTitle?: string;
  episodeSlug?: string;
  target?: string;
  rel?: string;
  ariaLabel?: string;
};

function defaultRel(target: string | undefined, rel: string | undefined): string | undefined {
  if (rel) return rel;
  if (target === '_blank') return 'noreferrer';
  return undefined;
}

export function TrackedExternalCtaLink({
  href,
  className,
  children,
  ctaLocation,
  sourcePageType = 'other_page',
  sourcePagePath,
  destination,
  episodeTitle,
  episodeSlug,
  target,
  rel,
  ariaLabel
}: Props) {
  const lastClickRef = useRef(0);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const now = Date.now();
    if (now - lastClickRef.current < 700) {
      event.preventDefault();
      return;
    }
    lastClickRef.current = now;

    const resolvedDestination = destination || resolveDestination(href);
    if (!resolvedDestination) return;

    const pagePath = sourcePagePath || currentPathWithSearch();
    const properties: Record<string, unknown> = {
      destination: resolvedDestination,
      cta_location: ctaLocation,
      source_page_type: sourcePageType,
      source_page_path: pagePath
    };
    if (episodeTitle) properties.episode_title = episodeTitle;
    if (episodeSlug) properties.episode_slug = episodeSlug;

    const opensNewTab = target === '_blank';
    if (!opensNewTab) {
      event.preventDefault();
      trackMixpanel('External CTA Clicked', properties);
      window.setTimeout(() => {
        window.location.assign(href);
      }, 120);
      return;
    }

    trackMixpanel('External CTA Clicked', properties);
  };

  return (
    <a
      href={href}
      target={target}
      rel={defaultRel(target, rel)}
      className={className}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}
