'use client';

import Image from 'next/image';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getStoragePublicUrl } from '@/lib/blog/media-url';

type MediaAsset = {
  id: string;
  storage_path: string;
  alt_text_default: string;
  caption_default: string;
  credit_source: string;
};

type MediaUsageSummary = {
  canDelete: boolean;
  totalUsage: number;
  counts: {
    featuredPosts: number;
    ogPosts: number;
    authorProfiles: number;
    contentBlocks: number;
    episodeHeroImages: number;
  };
};

type MediaUsageFilter = 'all' | 'used' | 'unused';
const WORKSPACE_MEDIA_FILTERS_KEY = 'workspace.media.filters.v1';

function toPersistedQuery(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toPersistedUsageFilter(value: unknown): MediaUsageFilter | null {
  const normalized = `${value || ''}`.toLowerCase();
  if (normalized === 'used' || normalized === 'unused' || normalized === 'all') {
    return normalized;
  }
  return null;
}

export function WorkspaceMediaManager({ initialItems }: { initialItems: MediaAsset[] }) {
  const PAGE_SIZE = 25;
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [usageFilter, setUsageFilter] = useState<MediaUsageFilter>('all');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');
  const [page, setPage] = useState(1);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAltText, setUploadAltText] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<MediaAsset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filtersRestored, setFiltersRestored] = useState(false);

  async function requestJson(url: string, init?: RequestInit, fallbackError = 'Request failed.') {
    try {
      const response = await fetch(url, { cache: 'no-store', ...init });
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        data,
        error: response.ok ? null : data?.error || fallbackError
      };
    } catch {
      return {
        ok: false,
        data: null,
        error: 'Network error. Please try again.'
      };
    }
  }

  async function reload(nextQuery = query, nextUsageFilter: MediaUsageFilter = usageFilter) {
    setIsSearching(true);
    const params = new URLSearchParams();
    params.set('q', nextQuery);
    params.set('usage', nextUsageFilter);
    const result = await requestJson(`/api/admin/blog/media?${params.toString()}`, undefined, 'Failed to load media.');
    if (!result.ok) {
      setMessageTone('error');
      setMessage(result.error || 'Failed to load media.');
      setIsSearching(false);
      return;
    }
    setItems(result.data?.items || []);
    setPage(1);
    setIsSearching(false);
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  useLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem(WORKSPACE_MEDIA_FILTERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { query?: unknown; usageFilter?: unknown };
      const restoredQuery = toPersistedQuery(parsed.query);
      const restoredUsageFilter = toPersistedUsageFilter(parsed.usageFilter);
      if (restoredQuery !== null) setQuery(restoredQuery);
      if (restoredUsageFilter) setUsageFilter(restoredUsageFilter);
    } catch {
      // Ignore storage parse errors and keep defaults.
    } finally {
      setFiltersRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!filtersRestored) return;
    try {
      window.localStorage.setItem(
        WORKSPACE_MEDIA_FILTERS_KEY,
        JSON.stringify({
          query,
          usageFilter
        })
      );
    } catch {
      // Ignore storage write failures in restricted browser contexts.
    }
  }, [query, usageFilter, filtersRestored]);

  useEffect(() => {
    if (!filtersRestored) return;
    const timeout = window.setTimeout(() => {
      void reload(query, usageFilter);
    }, 250);
    return () => {
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, usageFilter, filtersRestored]);

  function resetUploadDraft() {
    setUploadFile(null);
    setUploadAltText('');
    setUploadCaption('');
    setUploadInputKey((current) => current + 1);
  }

  async function submitUpload() {
    if (!uploadFile || uploadSubmitting) return;

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('altTextDefault', uploadAltText);
    formData.append('captionDefault', uploadCaption);

    setUploadSubmitting(true);
    try {
      const result = await requestJson('/api/admin/blog/media', {
        method: 'POST',
        body: formData
      }, 'Upload failed.');
      if (!result.ok) {
        setMessageTone('error');
        setMessage(result.error || 'Upload failed.');
        return;
      }
      const asset = result.data;
      if (asset?.id) {
        setItems((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      }
      setPage(1);
      setMessageTone('success');
      setMessage('Media uploaded.');
      resetUploadDraft();
      await reload(query, usageFilter);
    } catch {
      setMessageTone('error');
      setMessage('Upload failed.');
    } finally {
      setUploadSubmitting(false);
    }
  }

  async function performDelete(item: MediaAsset, force = false) {
    setDeletingId(item.id);
    try {
      const suffix = force ? '?force=1' : '';
      const deleteResult = await requestJson(`/api/admin/blog/media/${item.id}${suffix}`, { method: 'DELETE' }, 'Failed to delete media asset.');
      if (!deleteResult.ok) {
        setMessageTone('error');
        setMessage(deleteResult.error || 'Failed to delete media asset.');
        return false;
      }
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setMessageTone('success');
      setMessage('Media asset deleted.');
      return true;
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDelete(item: MediaAsset) {
    if (deletingId) return;

    setDeletingId(item.id);
    try {
      const usageResult = await requestJson(`/api/admin/blog/media/${item.id}/usage`, undefined, 'Failed to validate media usage.');
      if (!usageResult.ok) {
        setMessageTone('error');
        setMessage(usageResult.error || 'Failed to validate media usage.');
        return;
      }

      const usage = (usageResult.data || null) as MediaUsageSummary | null;
      if (usage?.canDelete) {
        setDeletingId(null);
        await performDelete(item, false);
        return;
      }

      setConfirmDeleteItem(item);
    } finally {
      setDeletingId((current) => (current === item.id ? null : current));
    }
  }

  async function handleCopyUrl(item: MediaAsset) {
    const url = getStoragePublicUrl(item.storage_path);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(item.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === item.id ? null : current));
      }, 1600);
    } catch {
      setMessageTone('error');
      setMessage('Failed to copy image URL.');
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Media Manager</h1>
          <p className="text-sm text-slate-600">Upload, search, and maintain reusable blog media assets.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            key={uploadInputKey}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setUploadFile(file);
              setUploadAltText('');
              setUploadCaption('');
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Upload media
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          <span>Search</span>
          <span className="relative inline-block">
            <input
              className="h-8 w-72 rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              placeholder="Alt text, caption, or path"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 stroke-current" fill="none" strokeWidth="1.8">
                  <path d="M2 2l8 8M10 2 2 10" />
                </svg>
              </button>
            ) : null}
          </span>
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          <span>Usage</span>
          <span className="relative inline-block">
            <select
              value={usageFilter}
              onChange={(event) => setUsageFilter(event.currentTarget.value as MediaUsageFilter)}
              className="h-8 w-auto min-w-[9rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
            >
              <option value="all">All media</option>
              <option value="used">Used only</option>
              <option value="unused">Unused only</option>
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 10 6"
              className="pointer-events-none absolute right-2 top-1/2 h-[0.5rem] w-[0.5rem] -translate-y-1/2 fill-slate-600"
            >
              <path d="M5 6L0 0h10L5 6z" />
            </svg>
          </span>
        </label>

        {isSearching ? (
          <span className="pb-1 text-xs text-slate-500">Searching...</span>
        ) : null}
      </div>

      {uploadFile ? (
        <div className="max-w-xl space-y-3 rounded-md border border-slate-300 bg-white p-4">
          <p className="text-sm text-slate-700">
            Selected image: <span className="font-semibold">{uploadFile.name}</span>
          </p>
          <input
            className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-700"
            value={uploadAltText}
            onChange={(event) => setUploadAltText(event.currentTarget.value)}
            placeholder="Default alt text (optional)"
          />
          <input
            className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-700"
            value={uploadCaption}
            onChange={(event) => setUploadCaption(event.currentTarget.value)}
            placeholder="Default caption (optional)"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submitUpload()}
              disabled={uploadSubmitting}
              className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {uploadSubmitting ? 'Uploading...' : 'Upload image'}
            </button>
            <button
              type="button"
              onClick={resetUploadDraft}
              disabled={uploadSubmitting}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p
          className={`max-w-xl rounded-md border px-3 py-2 text-sm ${
            messageTone === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-rose-300 bg-rose-50 text-rose-800'
          }`}
        >
          {message}
        </p>
      ) : null}

      {confirmDeleteItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-md border border-slate-300 bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Delete media?</h2>
            <p className="mt-2 text-sm text-slate-700">
              This media is used across the platform. Are you sure you want to delete this? This is a permanent action that cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                disabled={deletingId === confirmDeleteItem.id}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmDeleteItem;
                  if (!target) return;
                  const deleted = await performDelete(target, true);
                  if (deleted) setConfirmDeleteItem(null);
                }}
                disabled={deletingId === confirmDeleteItem.id}
                className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {deletingId === confirmDeleteItem.id ? 'Deleting...' : 'Delete anyway'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {pagedItems.map((item) => (
          <article key={item.id} className="rounded-md border border-slate-300 bg-white p-4">
            <div className="relative mb-2 aspect-square overflow-hidden rounded-md bg-slate-100">
              <Image
                src={getStoragePublicUrl(item.storage_path)}
                alt={item.alt_text_default || ''}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 20vw"
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="space-y-2 text-xs">
              <input
                className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                defaultValue={item.alt_text_default}
                placeholder="Alt text"
                onBlur={async (event) => {
                  const result = await requestJson(`/api/admin/blog/media/${item.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      alt_text_default: event.currentTarget.value,
                      caption_default: item.caption_default,
                      credit_source: item.credit_source
                    })
                  }, 'Failed to update media.');
                  if (!result.ok) {
                    setMessageTone('error');
                    setMessage(result.error || 'Failed to update media.');
                    return;
                  }
                  if (result.data?.id) {
                    setItems((current) => current.map((row) => (row.id === result.data.id ? result.data : row)));
                  }
                }}
              />
              <input
                className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                defaultValue={item.caption_default}
                placeholder="Caption"
                onBlur={async (event) => {
                  const result = await requestJson(`/api/admin/blog/media/${item.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      alt_text_default: item.alt_text_default,
                      caption_default: event.currentTarget.value,
                      credit_source: item.credit_source
                    })
                  }, 'Failed to update media.');
                  if (!result.ok) {
                    setMessageTone('error');
                    setMessage(result.error || 'Failed to update media.');
                    return;
                  }
                  if (result.data?.id) {
                    setItems((current) => current.map((row) => (row.id === result.data.id ? result.data : row)));
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyUrl(item)}
                    className="inline-flex h-8 w-8 items-center justify-center text-slate-700 hover:text-slate-900"
                    aria-label="Copy image URL"
                    title="Copy image URL"
                  >
                    <Image src="/blog/icons/copy.svg" alt="" width={16} height={16} aria-hidden="true" />
                  </button>
                  <span className="text-xs font-semibold text-emerald-600">
                    {copiedId === item.id ? 'Copied' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(item)}
                  disabled={deletingId === item.id}
                  className="inline-flex h-8 w-8 items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Delete image"
                  title="Delete image"
                >
                  {deletingId === item.id ? (
                    <span className="text-[10px] font-semibold text-rose-700">...</span>
                  ) : (
                    <span
                      className="h-4 w-4 bg-rose-600"
                      style={{
                        WebkitMaskImage: "url('/blog/icons/delete.svg')",
                        WebkitMaskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        WebkitMaskSize: 'contain',
                        maskImage: "url('/blog/icons/delete.svg')",
                        maskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        maskSize: 'contain'
                      }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        <p>
          Showing {(page - 1) * PAGE_SIZE + (pagedItems.length ? 1 : 0)}-{(page - 1) * PAGE_SIZE + pagedItems.length} of {items.length}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {!items.length ? (
        <p className="rounded-md border border-slate-300 bg-white px-3 py-8 text-center text-sm text-slate-600">
          No media assets found for this search.
        </p>
      ) : null}
    </section>
  );
}
