'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WorkspaceLogoutButton } from '@/components/workspace/workspace-logout-button';

const WORKSPACE_NAV = [
  { href: '/workspace/dashboard/episodes', label: 'Episodes' },
  { href: '/workspace/dashboard/blogs', label: 'Blogs' },
  { href: '/workspace/dashboard/jobs', label: 'Jobs' },
  { href: '/workspace/dashboard/analytics', label: 'Analytics' },
  { href: '/workspace/dashboard/reviews', label: 'Reviews' },
  { href: '/workspace/dashboard/redirects', label: 'Redirects' },
  { href: '/workspace/dashboard/taxonomies', label: 'Taxonomies' },
  { href: '/workspace/dashboard/settings', label: 'Settings' }
] as const;
const WORKSPACE_SIDEBAR_COLLAPSED_KEY = 'workspace_sidebar_collapsed';

function navClass(isActive: boolean, collapsed: boolean) {
  if (isActive) {
    return collapsed
      ? 'inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-500 bg-slate-700 text-sm font-medium text-slate-100'
      : 'inline-flex h-10 w-full items-center rounded-md border border-slate-500 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-100';
  }

  return collapsed
    ? 'inline-flex h-10 w-full items-center justify-center rounded-md border border-transparent text-sm font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100'
    : 'inline-flex h-10 w-full items-center rounded-md border border-transparent px-3 py-2 text-sm font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100';
}

export function WorkspaceShell({
  children,
  showBypassBanner,
  adminEmail
}: {
  children: React.ReactNode;
  showBypassBanner: boolean;
  adminEmail: string;
}) {
  const pathname = usePathname() || '';
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem(WORKSPACE_SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      setSidebarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      // Ignore storage failures in restricted browser contexts.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (!menuRef.current?.contains(target)) {
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

  return (
    <div className="h-dvh overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <aside
          className={`hidden h-full shrink-0 flex-col border-r border-slate-700 bg-slate-900 text-slate-100 transition-[width] duration-200 md:flex ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          <div className={`border-b border-slate-700 py-3 ${sidebarCollapsed ? 'px-2 text-center' : 'px-4'}`}>
            {sidebarCollapsed ? null : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Compendium</p>
                <p className="text-base font-semibold">Admin Workspace</p>
              </div>
            )}
          </div>

          <nav
            className={`flex-1 space-y-1 overflow-y-auto py-3 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}
            aria-label="Workspace sections"
          >
            {WORKSPACE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navClass(pathname === item.href, sidebarCollapsed)}
                prefetch={false}
                aria-label={sidebarCollapsed ? item.label : undefined}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {sidebarCollapsed ? (
                  <span className="text-xs font-semibold">{item.label.charAt(0)}</span>
                ) : (
                  item.label
                )}
              </Link>
            ))}
          </nav>

          <div className={`shrink-0 border-t border-slate-700 p-2 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label={sidebarCollapsed ? 'Expand side menu' : 'Collapse side menu'}
              title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
              className={`inline-flex h-10 w-full items-center rounded-sm border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white ${
                sidebarCollapsed ? 'justify-center' : 'justify-between px-3'
              }`}
            >
              {sidebarCollapsed ? null : <span className="text-xs font-semibold uppercase tracking-wide">Collapse</span>}
              <span aria-hidden="true" className="text-base leading-none">
                {sidebarCollapsed ? '›' : '‹'}
              </span>
            </button>
          </div>
        </aside>

        <div className="flex h-full min-w-0 flex-1 flex-col">
          <div className="shrink-0 flex h-12 items-center justify-between border-b border-slate-300 bg-white px-4">
            <p className="text-sm font-medium text-slate-700">Sue&apos;s View</p>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-expanded={menuOpen}
                aria-controls="workspace-account-menu"
                className="inline-flex max-w-[16rem] items-center gap-2 rounded-sm bg-white px-3 py-1.5 pr-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="truncate">{adminEmail}</span>
                <svg aria-hidden="true" viewBox="0 0 10 6" className="h-[0.55rem] w-[0.55rem] shrink-0 fill-current">
                  <path d="M5 6L0 0h10L5 6z" />
                </svg>
              </button>
              {menuOpen ? (
                <div
                  id="workspace-account-menu"
                  className="absolute right-0 top-[calc(100%+0.4rem)] z-20 min-w-[10rem] rounded-sm border border-slate-300 bg-white p-1 shadow-md"
                >
                  <WorkspaceLogoutButton className="inline-flex w-full items-center justify-start rounded-sm px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" />
                </div>
              ) : null}
            </div>
          </div>

          <nav className="shrink-0 flex items-center gap-2 overflow-x-auto border-b border-slate-300 bg-white px-3 py-2 md:hidden" aria-label="Workspace sections mobile">
            {WORKSPACE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={
                  pathname === item.href
                    ? 'whitespace-nowrap rounded-md border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900'
                    : 'whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700'
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto">
            <main className="p-4 sm:p-6">
              {showBypassBanner ? (
                <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Admin auth bypass is enabled in this environment.
                </p>
              ) : null}
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
