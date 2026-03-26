'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { PublicReview } from '@/lib/reviews';

const INITIAL_COUNT = 3;
const LOAD_MORE_COUNT = 6;

const COUNTRY_FLAGS: Record<string, string> = {
  'Australia': '🇦🇺',
  'Canada': '🇨🇦',
  'United Kingdom': '🇬🇧',
  'United States': '🇺🇸',
  'New Zealand': '🇳🇿',
  'Ireland': '🇮🇪',
  'South Africa': '🇿🇦',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'India': '🇮🇳',
  'Brazil': '🇧🇷',
  'Mexico': '🇲🇽',
  'Japan': '🇯🇵',
  'Singapore': '🇸🇬',
  'Netherlands': '🇳🇱',
  'Sweden': '🇸🇪',
  'Norway': '🇳🇴',
  'Denmark': '🇩🇰',
  'Spain': '🇪🇸',
  'Italy': '🇮🇹',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-carnival-gold" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={`h-5 w-5 ${i < rating ? 'fill-current' : 'fill-current opacity-20'}`} aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function CompendiumIcon() {
  return (
    <Image src="/website.png" alt="The Compendium" width={20} height={20} className="h-5 w-5 rounded" />
  );
}

function formatReviewDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(value));
}

export function ReviewsSection({
  reviews,
  totalCount,
  heading = 'Listener Reviews',
  ariaLabel = 'Listener reviews',
  ctaLabel = 'See All Reviews',
  sectionClassName = 'py-14 md:py-20',
  headingClassName = 'text-3xl font-black text-carnival-ink md:text-4xl',
  ctaClassName = 'inline-flex items-center gap-2 rounded-full bg-carnival-red px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110',
  ctaMode = 'link',
  ctaLinkProps,
  loadMoreCount = LOAD_MORE_COUNT,
  showHeader = true,
  showCtaAlways = false
}: {
  reviews: PublicReview[];
  totalCount?: number;
  heading?: string;
  ariaLabel?: string;
  ctaLabel?: string;
  sectionClassName?: string;
  headingClassName?: string;
  ctaClassName?: string;
  ctaMode?: 'link' | 'load_more';
  ctaLinkProps?: Record<string, string>;
  loadMoreCount?: number;
  showHeader?: boolean;
  showCtaAlways?: boolean;
}) {
  const [visible, setVisible] = useState(INITIAL_COUNT);
  const displayed = reviews.slice(0, visible);
  const hasMore = visible < reviews.length;
  const countLabel = typeof totalCount === 'number' ? totalCount : reviews.length;

  return (
    <section className={sectionClassName} aria-label={ariaLabel}>
      {showHeader ? (
        <div className="mb-8 flex items-center gap-3">
          <h2 className={headingClassName}>{heading}</h2>
          <span className="rounded-full bg-carnival-red px-3 py-0.5 text-sm font-black text-white">
            {countLabel}
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        {displayed.map((review) => (
          <article
            key={review.id}
            className="min-w-0 flex flex-col rounded-2xl border border-carnival-ink/10 bg-white p-6 shadow-card"
          >
            {/* Top row: stars left, author right */}
            <div className="flex items-center justify-between gap-2">
              <div className="shrink-0">
                <StarRating rating={review.rating} />
              </div>
              <span className="min-w-0 flex-1 truncate text-right text-sm font-bold text-carnival-ink/70">{review.author}</span>
            </div>

            <h3 className="mt-3 text-lg font-black text-carnival-ink">{review.title}</h3>
            <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-relaxed text-carnival-ink/80">
              {review.body}
            </p>

            {/* Bottom row: flag left, date + platform right */}
            <div className="mt-4 flex items-center justify-between gap-2 text-xs text-carnival-ink/60">
              {review.country ? (
                <span className="text-base leading-none">{COUNTRY_FLAGS[review.country] ?? '🌍'}</span>
              ) : (
                <span />
              )}
              <span className="inline-flex items-center gap-2">
                <span>{formatReviewDate(review.date)}</span>
                {review.platform === 'apple' ? (
                  <Image src="/ApplePodcast.png" alt="Apple Podcasts" width={20} height={20} className="h-5 w-5" />
                ) : (
                  <CompendiumIcon />
                )}
              </span>
            </div>
          </article>
        ))}
      </div>

      {hasMore || showCtaAlways ? (
        <div className="mt-8 text-center">
          {ctaMode === 'load_more' ? (
            <button
              type="button"
              className={ctaClassName}
              onClick={() => setVisible((count) => Math.min(reviews.length, count + loadMoreCount))}
            >
              {ctaLabel}
            </button>
          ) : (
            <Link
              href="/reviews"
              className={ctaClassName}
              {...ctaLinkProps}
            >
              {ctaLabel}
            </Link>
          )}
        </div>
      ) : null}
    </section>
  );
}
