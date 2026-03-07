'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

type Props = {
  assignmentId: string;
  fullName: string;
  imageUrl: string | null;
  accessEmail: string;
  accessRef: string;
};

export function MyJobPhotoEditor({ assignmentId, fullName, imageUrl, accessEmail, accessRef }: Props) {
  const previewWidth = 216;
  const previewHeight = 264;
  const exportWidth = 360;
  const exportHeight = 440;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState(imageUrl || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSrc, setEditorSrc] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    if (!isError || !message) return;
    const t = window.setTimeout(() => {
      setMessage('');
      setIsError(false);
    }, 4500);
    return () => window.clearTimeout(t);
  }, [isError, message]);

  async function upload(dataUrl: string | null) {
    setSaving(true);
    setMessage('');
    setIsError(false);
    const res = await fetch('/api/my-job/photo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentId,
        accessEmail,
        accessRef,
        profile_photo_data_url: dataUrl
      })
    });
    const body = await res.json();
    if (!res.ok) {
      setIsError(true);
      setMessage(body.error || 'Could not update photo.');
      setSaving(false);
      return;
    }
    setSaving(false);
    setMessage('');
    router.refresh();
  }

  function resetEditor() {
    setZoom(1);
    setRotation(0);
    setOffsetX(0);
    setOffsetY(0);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditorSrc('');
    resetEditor();
  }

  async function renderEditedImageToDataUrl(): Promise<string> {
    if (!editorSrc) return '';
    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const img = new window.Image();
    img.src = editorSrc;

    return new Promise<string>((resolve) => {
      img.onload = () => {
        const coverScale = Math.max(exportWidth / img.width, exportHeight / img.height);
        const offsetScaleX = exportWidth / previewWidth;
        const offsetScaleY = exportHeight / previewHeight;

        ctx.clearRect(0, 0, exportWidth, exportHeight);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.save();
        ctx.translate(
          exportWidth / 2 + offsetX * offsetScaleX,
          exportHeight / 2 + offsetY * offsetScaleY
        );
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(coverScale * zoom, coverScale * zoom);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve('');
    });
  }

  return (
    <div className="relative h-44 w-36 shrink-0">
      <div
        className="group relative block h-44 w-36 cursor-pointer overflow-hidden rounded-lg border-2 border-carnival-ink/20 bg-white"
        onClick={() => {
          if (!saving) fileRef.current?.click();
        }}
        aria-label="Upload or change your photo"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !saving) {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
      >
        {preview ? (
          <Image src={preview} alt={`${fullName} profile`} fill sizes="144px" className="object-cover" unoptimized />
        ) : (
          <Image src="/profile-placeholder.png" alt="No profile photo placeholder" fill sizes="144px" className="object-cover" />
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-carnival-ink/45 opacity-0 transition-opacity group-hover:opacity-100">
          {preview ? (
            <span className="pointer-events-auto flex flex-col items-center gap-2">
              <button
                type="button"
                className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-carnival-ink"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!saving) fileRef.current?.click();
                }}
              >
                {saving ? 'Saving...' : 'Change photo'}
              </button>
              <button
                type="button"
                className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-carnival-ink"
                onClick={(e) => {
                  e.stopPropagation();
                  if (saving) return;
                  setPreview('');
                  void upload(null);
                }}
              >
                Remove photo
              </button>
            </span>
          ) : (
            <span className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-carnival-ink">
              {saving ? 'Saving...' : 'Change photo'}
            </span>
          )}
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (!file) return;
          setMessage('');
          setIsError(false);
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            setIsError(true);
            setMessage('Please upload PNG, JPG, or WEBP.');
            return;
          }
          if (file.size > 1_500_000) {
            setIsError(true);
            setMessage('Please keep image size under 1.5MB.');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const value = `${reader.result || ''}`;
            const dataUrl = value.startsWith('data:image/') ? value : '';
            if (!dataUrl) {
              setIsError(true);
              setMessage('Could not read image file.');
              return;
            }
            setEditorSrc(dataUrl);
            resetEditor();
            setEditorOpen(true);
          };
          reader.readAsDataURL(file);
        }}
      />

      {isError && message ? (
        <p className="fixed bottom-4 right-4 z-[90] w-72 max-w-[85vw] rounded-md bg-red-100 p-2 text-xs text-red-900 shadow-card">
          {message}
        </p>
      ) : null}

      {editorOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-carnival-ink">Adjust Photo</h3>
              <button type="button" className="btn-secondary" onClick={closeEditor}>
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[auto,1fr]">
              <div className="relative mx-auto h-[264px] w-[216px] overflow-hidden rounded-lg border-2 border-carnival-ink/20 bg-carnival-cream/40">
                <Image
                  src={editorSrc}
                  alt="Photo edit preview"
                  fill
                  sizes="216px"
                  className="select-none object-cover"
                  unoptimized
                  style={{
                    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center'
                  }}
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="zoom">Zoom</label>
                  <input
                    id="zoom"
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.currentTarget.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="rotation">Rotate</label>
                  <input
                    id="rotation"
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.currentTarget.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="offsetX">Move left / right</label>
                  <input
                    id="offsetX"
                    type="range"
                    min={-220}
                    max={220}
                    step={1}
                    value={offsetX}
                    onChange={(e) => setOffsetX(Number(e.currentTarget.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="offsetY">Move up / down</label>
                  <input
                    id="offsetY"
                    type="range"
                    min={-220}
                    max={220}
                    step={1}
                    value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.currentTarget.value))}
                    className="w-full"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button type="button" className="btn-secondary" onClick={resetEditor}>
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={saving}
                    onClick={async () => {
                      const edited = await renderEditedImageToDataUrl();
                      if (!edited) {
                        setIsError(true);
                        setMessage('Could not process image.');
                        return;
                      }
                      setPreview(edited);
                      closeEditor();
                      await upload(edited);
                    }}
                  >
                    {saving ? 'Saving...' : 'Use photo'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
