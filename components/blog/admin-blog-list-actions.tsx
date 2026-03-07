'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  postId: string;
  slug: string;
  status: string;
};

export function AdminBlogListActions({ postId, slug, status }: Props) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const viewHref = status === 'published' ? `/blog/${slug}` : `/api/admin/blog/posts/${postId}/preview`;

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target || !menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  async function requestJson(url: string, init?: RequestInit) {
    try {
      const response = await fetch(url, init);
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, data, error: response.ok ? null : data?.error || 'Request failed.' };
    } catch {
      return { ok: false, data: null, error: 'Network error. Please try again.' };
    }
  }

  return (
    <td className="py-2.5 align-middle">
      <div className="relative inline-block" ref={menuRef}>
        <button
          type="button"
          className="btn-secondary"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((previous) => !previous)}
        >
          Actions
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-[70] mt-2 w-44 rounded-md border border-carnival-ink/20 bg-white p-1 shadow-card"
          >
            <Link
              href={viewHref}
              target="_blank"
              prefetch={false}
              className="block rounded px-3 py-2 text-sm hover:bg-carnival-cream"
              onClick={() => setMenuOpen(false)}
            >
              View
            </Link>
            <Link
              href={`/admin/blog/${postId}`}
              prefetch={false}
              className="block rounded px-3 py-2 text-sm hover:bg-carnival-cream"
              onClick={() => setMenuOpen(false)}
            >
              Edit
            </Link>
            <button
              type="button"
              disabled={duplicateLoading}
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-carnival-cream disabled:opacity-50"
              onClick={async () => {
                setDuplicateLoading(true);
                const result = await requestJson(`/api/admin/blog/posts/${postId}/duplicate`, { method: 'POST' });
                if (result.ok && result.data?.id) {
                  setMenuOpen(false);
                  router.push(`/admin/blog/${result.data.id}`);
                  return;
                }
                window.alert(result.error || 'Failed to duplicate this post.');
                setDuplicateLoading(false);
              }}
            >
              {duplicateLoading ? 'Duplicating...' : 'Duplicate'}
            </button>
            <button
              type="button"
              disabled={deleteLoading}
              className="block w-full rounded px-3 py-2 text-left text-sm text-[#8d1010] hover:bg-[#fff1f1] disabled:opacity-50"
              onClick={async () => {
                const confirmed = window.confirm('Soft delete this post? You can restore it later.');
                if (!confirmed) return;
                setDeleteLoading(true);
                const result = await requestJson(`/api/admin/blog/posts/${postId}`, { method: 'DELETE' });
                if (result.ok) {
                  setMenuOpen(false);
                  router.refresh();
                  return;
                }
                window.alert(result.error || 'Failed to delete this post.');
                setDeleteLoading(false);
              }}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        ) : null}
      </div>
    </td>
  );
}
