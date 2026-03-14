'use client';

import Link from 'next/link';
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

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'apple', label: 'Apple' },
  { value: 'website', label: 'Website' },
  { value: 'manual', label: 'Manual' },
  { value: 'scraped', label: 'Scraped' }
] as const;

export function AdminReviewsForm({ onTotalChange }: { onTotalChange?: (total: number) => void } = {}) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusTab, setStatusTab] = useState<'all' | 'visible' | 'hidden'>('all');
  const [ratingFilter, setRatingFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: `${page}` });
    if (statusTab !== 'all') params.set('status', statusTab);
    if (ratingFilter) params.set('rating', ratingFilter);
    if (sourceFilter) params.set('source', sourceFilter);
    return params.toString();
  }, [page, statusTab, ratingFilter, sourceFilter]);

  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');

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
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews.');
    } finally {
      setIsLoading(false);
    }
  }, [onTotalChange, queryString]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSelectAll(nextChecked: boolean) {
    if (nextChecked) {
      setSelectedIds(items.map((item) => item.id));
      return;
    }
    setSelectedIds([]);
  }

  function toggleSelectOne(id: string, nextChecked: boolean) {
    setSelectedIds((prev) => {
      if (nextChecked) return [...prev, id];
      return prev.filter((value) => value !== id);
    });
  }

  async function applyBulkStatus(nextStatus: 'visible' | 'hidden') {
    if (!selectedIds.length) return;
    setIsUpdating(true);
    setError('');

    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status: nextStatus })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update selected reviews.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update selected reviews.');
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={statusTab === 'all' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => {
            setStatusTab('all');
            setPage(1);
          }}
        >
          All
        </button>
        <button
          type="button"
          className={statusTab === 'visible' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => {
            setStatusTab('visible');
            setPage(1);
          }}
        >
          Visible
        </button>
        <button
          type="button"
          className={statusTab === 'hidden' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => {
            setStatusTab('hidden');
            setPage(1);
          }}
        >
          Hidden
        </button>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
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

          <label className="label">
            Source
            <select
              className="input mt-1"
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                setPage(1);
              }}
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn-secondary"
            disabled={isUpdating || !selectedIds.length}
            onClick={() => applyBulkStatus('hidden')}
          >
            Hide Selected
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={isUpdating || !selectedIds.length}
            onClick={() => applyBulkStatus('visible')}
          >
            Unhide Selected
          </button>
        </div>

        {error ? <p className="font-semibold text-carnival-red">{error}</p> : null}

        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => toggleSelectAll(event.target.checked)}
                    aria-label="Select all reviews on this page"
                  />
                </th>
                <th className="py-2 pr-3">Received</th>
                <th className="py-2 pr-3">Author</th>
                <th className="py-2 pr-3">Rating</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((review) => (
                <tr key={review.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(review.id)}
                      onChange={(event) => toggleSelectOne(review.id, event.target.checked)}
                      aria-label={`Select review ${review.id}`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    {new Date(review.received_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="py-2 pr-3">{review.author || 'Anonymous'}</td>
                  <td className="py-2 pr-3">{review.rating}★</td>
                  <td className="max-w-[260px] truncate py-2 pr-3" title={review.title || review.body}>
                    {review.title || '(No title)'}
                  </td>
                  <td className="py-2 pr-3 uppercase">{review.source}</td>
                  <td className="py-2 pr-3 capitalize">{review.status}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/admin/reviews/${review.id}`} className="btn-secondary">
                      View
                    </Link>
                  </td>
                </tr>
              ))}

              {!items.length && !isLoading ? (
                <tr>
                  <td className="py-4" colSpan={8}>
                    No reviews found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
