'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getStoragePublicUrl } from '@/lib/blog/media-url';

export function AdminMediaLibrary({ initialItems }: { initialItems: any[] }) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

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

  async function reload(nextQuery = query) {
    const result = await requestJson(`/api/admin/blog/media?q=${encodeURIComponent(nextQuery)}`, undefined, 'Failed to load media.');
    if (!result.ok) {
      setMessage(result.error || 'Failed to load media.');
      return;
    }
    setItems(result.data?.items || []);
  }

  return (
    <section className="space-y-4">
      <form
        className="card space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const formData = new FormData(event.currentTarget);
            const result = await requestJson('/api/admin/blog/media', {
              method: 'POST',
              body: formData
            }, 'Upload failed.');
            if (!result.ok) {
              setMessage(result.error || 'Upload failed.');
              return;
            }
            const asset = result.data;
            if (asset?.id) {
              setItems((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
            }
            setMessage('Media uploaded.');
            event.currentTarget.reset();
            return;
          } catch {
            setMessage('Upload failed.');
          }
        }}
      >
        <h2 className="text-2xl font-black">Upload image</h2>
        <input className="input" type="file" name="file" accept="image/*" required />
        <input className="input" name="altTextDefault" placeholder="Default alt text" />
        <input className="input" name="captionDefault" placeholder="Default caption" />
        <input className="input" name="creditSource" placeholder="Credit/source" />
        <button className="btn-primary" type="submit">Upload</button>
        {message ? <p className="text-sm text-carnival-ink/70">{message}</p> : null}
      </form>

      <div className="flex gap-3">
        <input className="input max-w-sm" placeholder="Search media" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
        <button className="btn-secondary" type="button" onClick={() => void reload(query)}>Search</button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border-2 border-carnival-ink/15 bg-white p-4 shadow-card">
            <div className="relative mb-3 aspect-video overflow-hidden rounded-xl bg-carnival-cream">
              <Image
                src={getStoragePublicUrl(item.storage_path)}
                alt={item.alt_text_default || ''}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-black">{item.id}</p>
              <p className="text-carnival-ink/60">{item.storage_path}</p>
              <input
                className="input"
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
                    setMessage(result.error || 'Failed to update media.');
                    return;
                  }
                  if (result.data?.id) {
                    setItems((current) => current.map((row) => (row.id === result.data.id ? result.data : row)));
                  }
                }}
              />
              <input
                className="input"
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
                    setMessage(result.error || 'Failed to update media.');
                    return;
                  }
                  if (result.data?.id) {
                    setItems((current) => current.map((row) => (row.id === result.data.id ? result.data : row)));
                  }
                }}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
