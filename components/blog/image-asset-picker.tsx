'use client';

import Image from 'next/image';
import { useRef, useState, type ChangeEvent } from 'react';
import { getStoragePublicUrl } from '@/lib/blog/media-url';
import type { MediaPickerAsset } from './media-library-picker-modal';

type ImageAssetPickerProps = {
  selectedAsset: MediaPickerAsset | null;
  onUploadFile: (file: File) => Promise<void>;
  onOpenLibrary: () => void;
  onRemove: () => void;
  uploadMessage?: string;
  recommendedText?: string;
  compact?: boolean;
};

export function ImageAssetPicker({
  selectedAsset,
  onUploadFile,
  onOpenLibrary,
  onRemove,
  uploadMessage = '',
  recommendedText = '',
  compact = false
}: ImageAssetPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const selectedAssetUrl = selectedAsset?.storage_path ? getStoragePublicUrl(selectedAsset.storage_path) : null;
  const isErrorMessage = /fail|error|unable/i.test(uploadMessage);
  const messageClass = isErrorMessage ? 'text-[#9a2b2b]' : 'text-[#3e7a50]';

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] || null;
    if (!file) return;
    event.currentTarget.value = '';
    setUploading(true);
    try {
      await onUploadFile(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(event) => void handleFileInputChange(event)}
      />
      {selectedAssetUrl ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <button
              type="button"
              className="group block w-full overflow-hidden rounded-xl border border-dashed border-[#cfd5e7] bg-white p-1 text-left transition hover:border-[#bfc7de]"
              onClick={() => inputRef.current?.click()}
            >
              <div className="relative aspect-[16/9] overflow-hidden rounded-[10px] bg-[#eef1f7]">
                <Image
                  src={selectedAssetUrl}
                  alt={selectedAsset?.alt_text_default || 'Selected image'}
                  fill
                  sizes={compact ? '220px' : '260px'}
                  className="object-cover"
                />
              </div>
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe3ef] bg-white text-[#59608a] transition hover:bg-[#f4f6fc] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={onRemove}
              disabled={!selectedAsset || uploading}
              aria-label="Remove image"
              title="Remove image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-[#dfe3ef] bg-white py-1.5 text-center text-xs font-medium text-[#5e6489] transition hover:bg-[#f4f6fc] disabled:opacity-50"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Replace (upload)'}
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border border-[#dfe3ef] bg-white py-1.5 text-center text-xs font-medium text-[#5e6489] transition hover:bg-[#f4f6fc]"
              onClick={onOpenLibrary}
              disabled={uploading}
            >
              Replace (library)
            </button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cfd5e7] bg-white px-4 py-5 text-xs font-semibold text-[#6f7598] transition hover:border-[#bfc7de] hover:text-[#4f5bd5] disabled:opacity-50"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {uploading ? 'Uploading...' : 'Upload an image'}
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cfd5e7] bg-white px-4 py-5 text-xs font-semibold text-[#6f7598] transition hover:border-[#bfc7de] hover:text-[#4f5bd5] disabled:opacity-50"
            onClick={onOpenLibrary}
            disabled={uploading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Pick from Media Library
          </button>
        </div>
      )}
      {recommendedText ? <p className="text-xs text-[#6e7596]">{recommendedText}</p> : null}
      {uploadMessage ? <p className={`text-xs ${messageClass}`}>{uploadMessage}</p> : null}
    </div>
  );
}
