'use client';

import { useEffect, useRef, useState } from 'react';

export function RedirectHeaderActions() {
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
    <div className="flex items-center gap-2">
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Actions
        </button>

        {menuOpen ? (
          <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-slate-300 bg-white p-1 shadow-md">
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event('workspace-redirects:import'));
                setMenuOpen(false);
              }}
              className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              CSV Import
            </button>
            <button
              type="button"
              onClick={() => {
                window.open('/api/admin/redirects/export', '_blank');
                setMenuOpen(false);
              }}
              className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              Export CSV
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('workspace-redirects:new'))}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
          <path d="M8 1a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2H9v5a1 1 0 1 1-2 0V9H2a1 1 0 0 1 0-2h5V2a1 1 0 0 1 1-1z" />
        </svg>
        New
      </button>
    </div>
  );
}
