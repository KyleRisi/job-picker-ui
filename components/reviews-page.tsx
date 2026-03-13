'use client';

import { useState, useRef } from 'react';
import type { PublicReview } from '@/lib/reviews';

/* ─── Types ─── */
type Review = PublicReview;

/* ─── Constants ─── */
const INITIAL_COUNT = 6;
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
  'Portugal': '🇵🇹',
  'Greece': '🇬🇷',
  'Poland': '🇵🇱',
  'Austria': '🇦🇹',
  'Belgium': '🇧🇪',
  'Switzerland': '🇨🇭',
  'Philippines': '🇵🇭',
  'Kenya': '🇰🇪',
  'Nigeria': '🇳🇬',
};

const COUNTRIES = [
  'Australia',
  'Austria',
  'Belgium',
  'Brazil',
  'Canada',
  'Denmark',
  'France',
  'Germany',
  'Greece',
  'India',
  'Ireland',
  'Italy',
  'Japan',
  'Kenya',
  'Mexico',
  'Netherlands',
  'New Zealand',
  'Nigeria',
  'Norway',
  'Philippines',
  'Poland',
  'Portugal',
  'Singapore',
  'South Africa',
  'Spain',
  'Sweden',
  'Switzerland',
  'United Kingdom',
  'United States',
];

/* ─── Sub-components ─── */
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-carnival-gold" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={`h-5 w-5 ${i < rating ? 'fill-current' : 'fill-current opacity-20'}`}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
      {Array.from({ length: 5 }).map((_, i) => {
        const star = i + 1;
        const active = star <= (hover || value);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform hover:scale-110"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <svg viewBox="0 0 24 24" className={`h-8 w-8 ${active ? 'fill-carnival-gold text-carnival-gold' : 'fill-white/20 text-white/20'} transition-colors`}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function CompendiumIcon() {
  return (
    <img src="/website.png" alt="The Compendium" className="h-5 w-5 rounded" />
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="min-w-0 flex flex-col rounded-2xl border border-carnival-ink/10 bg-white p-6 shadow-card">
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

      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-carnival-ink/60">
        {review.country ? (
          <span className="text-base leading-none">{COUNTRY_FLAGS[review.country] ?? '🌍'}</span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-2">
          <span>{new Date(review.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {review.platform === 'apple' ? (
            <img src="/ApplePodcast.png" alt="Apple Podcasts" className="h-5 w-5" />
          ) : (
            <CompendiumIcon />
          )}
        </span>
      </div>
    </article>
  );
}

/* ─── Submit Form ─── */
function SubmitReviewForm({ onSubmitted }: { onSubmitted: (review: Review) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(0);
  const [country, setCountry] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (rating === 0) {
      setError('Please select a star rating.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, title, body, rating, country }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Something went wrong. Please try again.');
      }

      const data = await res.json();

      setSuccess(true);
      setName('');
      setEmail('');
      setTitle('');
      setBody('');
      setRating(0);
      setCountry('');

      if (data.review) {
        onSubmitted(data.review as Review);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-carnival-gold/30 bg-carnival-gold/10 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-carnival-gold/30">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-black text-white">Thank You!</h3>
        <p className="mt-2 text-sm text-white/70">
          Your review has been submitted and is now pending admin approval.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="mt-4 text-sm font-bold text-carnival-gold underline underline-offset-2 hover:no-underline"
        >
          Submit another review
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {/* Rating */}
      <div>
        <label className="mb-2 block text-sm font-bold text-white">
          Your Rating <span className="text-carnival-gold">*</span>
        </label>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      {/* Name & Email row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="review-name" className="mb-1.5 block text-sm font-bold text-white">
            Name <span className="text-carnival-gold">*</span>
          </label>
          <input
            id="review-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30"
          />
        </div>
        <div>
          <label htmlFor="review-email" className="mb-1.5 block text-sm font-bold text-white">
            Email <span className="text-carnival-gold">*</span>
          </label>
          <input
            id="review-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30"
          />
          <p className="mt-1 text-xs text-white/50">Not displayed publicly — just so we know you&apos;re real.</p>
        </div>
      </div>

      {/* Country */}
      <div>
        <label htmlFor="review-country" className="mb-1.5 block text-sm font-bold text-white">
          Country
        </label>
        <select
          id="review-country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30"
        >
          <option value="">Select your country (optional)</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {COUNTRY_FLAGS[c] ? `${COUNTRY_FLAGS[c]} ` : ''}{c}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label htmlFor="review-title" className="mb-1.5 block text-sm font-bold text-white">
          Review Title <span className="text-carnival-gold">*</span>
        </label>
        <input
          id="review-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sum it up in a few words"
          maxLength={100}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30"
        />
      </div>

      {/* Body */}
      <div>
        <label htmlFor="review-body" className="mb-1.5 block text-sm font-bold text-white">
          Your Review <span className="text-carnival-gold">*</span>
        </label>
        <textarea
          id="review-body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What do you enjoy about the podcast?"
          rows={4}
          maxLength={2000}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-carnival-red/20 px-4 py-2.5 text-sm font-semibold text-carnival-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 rounded-full bg-carnival-red px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  );
}

/* ─── Main Page Component ─── */
export function ReviewsPage({ initialReviews }: { initialReviews: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [visible, setVisible] = useState(INITIAL_COUNT);
  const displayed = reviews.slice(0, visible);
  const hasMore = visible < reviews.length;

  function handleNewReview(review: Review) {
    setReviews((prev) => [review, ...prev]);
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black text-carnival-ink md:text-4xl">Listener Reviews</h1>
          <span className="rounded-full bg-carnival-red px-3 py-0.5 text-sm font-black text-white">
            {reviews.length}
          </span>
        </div>
        <p className="mt-2 text-carnival-ink/70">
          What listeners around the world are saying about The Compendium Podcast.
        </p>
      </div>

      {/* Review Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {displayed.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {/* More Button */}
      {hasMore && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => Math.min(v + LOAD_MORE_COUNT, reviews.length))}
            className="inline-flex items-center gap-2 rounded-full bg-carnival-red px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
          >
            More Reviews
          </button>
        </div>
      )}

      {/* Submit Form — dark section */}
      <section
        aria-label="Submit your review"
        className="full-bleed relative mt-12 overflow-hidden bg-carnival-ink py-16 md:py-20"
      >
        {/* Atmospheric glows */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-carnival-red/20 blur-[120px]" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-carnival-gold/15 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-2xl px-4">
          <h2 className="text-2xl font-black text-white md:text-3xl">Leave a Review</h2>
          <p className="mt-2 mb-8 text-sm text-white/60">
            Enjoyed the podcast? We&apos;d love to hear from you! Your review will appear on this page.
          </p>
          <SubmitReviewForm onSubmitted={handleNewReview} />
        </div>
      </section>
    </>
  );
}
