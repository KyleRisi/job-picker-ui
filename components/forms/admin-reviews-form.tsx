'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type ReviewItem = {
  id: string;
  title: string;
  body: string;
  rating: number;
  author: string;
  country: string;
  source: 'apple' | 'website' | 'manual' | 'scraped';
  status: 'visible' | 'hidden';
  received_at: string;
};

type ReviewsResponse = {
  items: ReviewItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const SKELETON_CARD_COUNT = 9;

const SOURCE_LABELS: Record<ReviewItem['source'], string> = {
  apple: 'Apple',
  website: 'Website',
  manual: 'Manual',
  scraped: 'Scraped'
};

export function AdminReviewsForm({ onTotalChange }: { onTotalChange?: (count: number) => void } = {}) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [statusTab, setStatusTab] = useState<'all' | 'visible' | 'hidden'>('all');
  const [ratingFilter, setRatingFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: `${page}` });
    if (statusTab !== 'all') params.set('status', statusTab);
    if (ratingFilter) params.set('rating', ratingFilter);
    return params.toString();
  }, [page, statusTab, ratingFilter]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setItems([]);

    try {
      const res = await fetch(`/api/admin/reviews?${queryString}`, { cache: 'no-store' });
      const data = (await res.json()) as ReviewsResponse | { error?: string };
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load reviews.');

      const payload = data as ReviewsResponse;
      setItems(payload.items || []);
      setTotalPages(payload.pagination?.totalPages || 1);
      const total = payload.pagination?.total || 0;
      setTotalReviews(total);
      onTotalChange?.(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews.');
      onTotalChange?.(0);
    } finally {
      setIsLoading(false);
    }
  }, [onTotalChange, queryString]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleSingleStatus(review: ReviewItem) {
    if (togglingId) return;
    const nextStatus: 'visible' | 'hidden' = review.status === 'visible' ? 'hidden' : 'visible';

    setTogglingId(review.id);
    setError('');

    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update review visibility.');

      setItems((prev) => prev.map((item) => (item.id === review.id ? { ...item, status: nextStatus } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review visibility.');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="label">
            Visibility
            <select
              className="input mt-1"
              value={statusTab}
              onChange={(event) => {
                setStatusTab(event.target.value as 'all' | 'visible' | 'hidden');
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>

          <label className="label">
            Stars
            <select
              className="input mt-1"
              value={ratingFilter}
              onChange={(event) => {
                setRatingFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All ratings</option>
              <option value="1">1★</option>
              <option value="2">2★</option>
              <option value="3">3★</option>
              <option value="4">4★</option>
              <option value="5">5★</option>
            </select>
          </label>
        </div>

        {error ? <p className="font-semibold text-carnival-red">{error}</p> : null}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
            <article key={`skeleton-${index}`} className="min-w-0 h-full rounded-xl border border-carnival-ink/12 bg-white p-4 shadow-card">
              <div className="animate-pulse">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-full">
                    <div className="h-3 w-24 rounded bg-carnival-ink/15" />
                    <div className="mt-2 h-5 w-28 rounded bg-carnival-ink/10" />
                  </div>
                  <div className="h-3 w-20 rounded bg-carnival-ink/10" />
                </div>
                <div className="mt-4 h-5 w-3/4 rounded bg-carnival-ink/15" />
                <div className="mt-3 h-3 w-full rounded bg-carnival-ink/10" />
                <div className="mt-2 h-3 w-11/12 rounded bg-carnival-ink/10" />
                <div className="mt-2 h-3 w-9/12 rounded bg-carnival-ink/10" />
                <div className="mt-6 flex items-center justify-between">
                  <div className="h-6 w-20 rounded-full bg-carnival-ink/10" />
                  <div className="h-12 w-12 rounded-md bg-carnival-ink/10" />
                </div>
              </div>
            </article>
          )) : items.map((review) => {
            const title = review.title || '(No title)';
            const bodyPreview = review.body?.trim()
              ? `${review.body.trim().slice(0, 220)}${review.body.trim().length > 220 ? '...' : ''}`
              : '';
            const hidden = review.status === 'hidden';

            return (
              <article
                key={review.id}
                className={`min-w-0 h-full rounded-xl border p-4 shadow-card flex flex-col ${
                  hidden
                    ? 'border-carnival-ink/25 bg-carnival-ink/10'
                    : 'border-carnival-ink/12 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-bold text-carnival-ink/70">
                        {new Date(review.received_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="min-w-0 text-right text-xs font-semibold text-carnival-ink/70 truncate">
                        {review.author || 'Anonymous'}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center gap-0.5 text-orange-500" role="img" aria-label={`${review.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          viewBox="0 0 24 24"
                          className={`h-5 w-5 ${i < review.rating ? 'fill-current' : 'fill-current opacity-20'}`}
                          aria-hidden="true"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>

                <h3 className="mt-3 text-base font-black leading-tight text-carnival-ink">{title}</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-carnival-ink/85">
                  {bodyPreview || 'No review text provided.'}
                </p>

                <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-carnival-navy/10 px-2.5 py-1 font-semibold text-carnival-ink">
                    {SOURCE_LABELS[review.source]}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary h-12 w-12 p-0"
                    onClick={() => toggleSingleStatus(review)}
                    disabled={togglingId === review.id}
                    aria-label={hidden ? 'Unhide review' : 'Hide review'}
                    title={hidden ? 'Unhide review' : 'Hide review'}
                  >
                    {hidden ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-7 w-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                        <path d="m3 3 18 18" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-7 w-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </article>
            );
          })}

          {!items.length && !isLoading ? (
            <p className="rounded-md border border-carnival-ink/15 bg-white p-3 text-sm">
              No reviews found for the selected filters.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">Total reviews: {totalReviews}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <span className="text-sm font-semibold">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
