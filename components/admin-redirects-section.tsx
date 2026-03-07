'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminRedirectsForm } from '@/components/forms/admin-redirects-form';

export function AdminRedirectsSection({ showBypassBanner }: { showBypassBanner: boolean }) {
  const [viewCount, setViewCount] = useState(0);
  const [panelMode, setPanelMode] = useState<'none' | 'create' | 'import'>('none');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!menuOpen) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
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

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black">Redirects</h1>
          <span className="rounded-full bg-carnival-red px-3 py-1 text-sm font-bold text-white">
            {viewCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMenuOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              Actions
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-52 rounded-md border border-carnival-ink/20 bg-white p-1 shadow-card">
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
                  onClick={() => {
                    setPanelMode('create');
                    setMenuOpen(false);
                  }}
                >
                  Add Redirect
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
                  onClick={() => {
                    setPanelMode('import');
                    setMenuOpen(false);
                  }}
                >
                  CSV Import Mode
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
                  onClick={() => {
                    window.open('/api/admin/redirects/export', '_blank');
                    setMenuOpen(false);
                  }}
                >
                  Export CSV
                </button>
              </div>
            ) : null}
          </div>
          <AdminTabs current="redirects" />
        </div>
      </div>

      {showBypassBanner ? (
        <p className="rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
      ) : null}

      <AdminRedirectsForm
        onTotalChange={setViewCount}
        panelMode={panelMode}
        onClosePanel={() => setPanelMode('none')}
      />
    </section>
  );
}
