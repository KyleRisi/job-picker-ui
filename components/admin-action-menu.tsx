'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

export function AdminActionMenu() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function closeMenu() {
    detailsRef.current?.removeAttribute('open');
  }

  useEffect(() => {
    closeMenu();
  }, [pathname, searchParams]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const details = detailsRef.current;
      if (!details?.open) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (!details.contains(target)) closeMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function openJobsPanel(action: 'create' | 'bulk') {
    closeMenu();
    router.push(`/admin/jobs?action=${action}&at=${Date.now()}`);
  }

  return (
    <details ref={detailsRef} className="relative">
      <summary className="btn-secondary cursor-pointer list-none">Actions</summary>
      <div className="absolute right-0 z-10 mt-2 w-52 rounded-md border border-carnival-ink/20 bg-white p-1 shadow-card">
        <button
          type="button"
          className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
          onClick={() => openJobsPanel('create')}
        >
          Add New Job
        </button>
        <button
          type="button"
          className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
          onClick={() => openJobsPanel('bulk')}
        >
          Bulk Import Jobs
        </button>
        <Link href="/admin/exports" className="block rounded px-3 py-2 hover:bg-carnival-cream" onClick={closeMenu}>
          Exports
        </Link>
        <Link href="/admin/reviews" className="block rounded px-3 py-2 hover:bg-carnival-cream" onClick={closeMenu}>
          Reviews
        </Link>
        <Link href="/admin/settings" className="block rounded px-3 py-2 hover:bg-carnival-cream" onClick={closeMenu}>
          Settings
        </Link>
      </div>
    </details>
  );
}
