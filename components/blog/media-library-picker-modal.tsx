'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { getStoragePublicUrl } from '@/lib/blog/media-url';

export interface MediaPickerAsset {
  id: string;
  storage_path: string;
  alt_text_default?: string;
  caption_default?: string;
  credit_source?: string;
  mime_type?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaPickerAsset) => void;
}

export function MediaLibraryPickerModal({ open, onClose, onSelect }: Props) {
  const [assets, setAssets] = useState<MediaPickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchAssets = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/admin/blog/media?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAssets(
          (data.items ?? []).filter((a: any) => a?.mime_type?.startsWith('image/'))
        );
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setQuery('');
    fetchAssets('');
  }, [open, fetchAssets]);

  function handleSearch() {
    fetchAssets(query);
  }

  function handleConfirm() {
    const asset = assets.find((a) => a.id === selectedId);
    if (asset) {
      onSelect(asset);
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Select from Media Library"
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5e7f0] px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-[#2b3150]">Select from Media Library</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#7b819f] transition hover:bg-[#f0f2f8] hover:text-[#2b3150]"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-[#e5e7f0] px-5 py-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
          >
            <input
              type="text"
              placeholder="Search by filename, alt text, caption…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 rounded-lg border border-[#dfe3ef] bg-[#f8f9fc] px-3 py-2 text-sm text-[#2b3150] outline-none placeholder:text-[#a0a6bf] focus:border-[#6474d8] focus:ring-1 focus:ring-[#6474d8]"
              aria-label="Search media library"
            />
            <button
              type="submit"
              className="rounded-lg border border-[#dfe3ef] bg-white px-3 py-2 text-sm font-medium text-[#5e6489] transition hover:bg-[#f4f6fc]"
            >
              Search
            </button>
          </form>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-16 text-center text-sm text-[#7b819f]">Loading media…</p>
          ) : assets.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#7b819f]">No images found.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {assets.map((asset) => {
                const url = getStoragePublicUrl(asset.storage_path);
                const isSelected = selectedId === asset.id;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedId(asset.id)}
                    className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[#4f5bd5] ring-2 ring-[#4f5bd5]/25'
                        : 'border-transparent hover:border-[#c7cfe8]'
                    }`}
                  >
                    <Image
                      src={url}
                      alt={asset.alt_text_default || 'Media asset'}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#4f5bd5]/20">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4f5bd5] text-white shadow">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                      </div>
                    )}
                    {asset.alt_text_default && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                        <p className="truncate text-[11px] leading-tight text-white">{asset.alt_text_default}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e5e7f0] px-5 py-3.5">
          <p className="text-xs text-[#7b819f]">
            {assets.length} image{assets.length !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#dfe3ef] bg-white px-4 py-2 text-sm font-medium text-[#5e6489] transition hover:bg-[#f4f6fc]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedId}
              className="rounded-lg bg-[#4f5bd5] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3b47c2] disabled:opacity-40"
            >
              Use selected image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
