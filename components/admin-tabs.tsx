'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export type AdminTabKey = 'dashboard' | 'jobs' | 'episodes' | 'reviews' | 'contacts' | 'redirects' | 'exports' | 'settings';

const TABS: Array<{ key: AdminTabKey; href: string; label: string }> = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard' },
  { key: 'jobs', href: '/admin/jobs', label: 'Jobs' },
  { key: 'episodes', href: '/admin/episodes', label: 'Episodes' },
  { key: 'reviews', href: '/admin/reviews', label: 'Reviews' },
  { key: 'contacts', href: '/admin/contacts', label: 'Contacts' },
  { key: 'redirects', href: '/admin/redirects', label: 'Redirects' },
  { key: 'exports', href: '/admin/exports', label: 'Exports' },
  { key: 'settings', href: '/admin/settings', label: 'Settings' }
];

const ADMIN_NAV_COLLAPSED_KEY = 'admin_nav_collapsed';

function TabIcon({ tab }: { tab: AdminTabKey }) {
  if (tab === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="5" rx="1" />
        <rect x="13" y="10" width="8" height="11" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
      </svg>
    );
  }
  if (tab === 'jobs') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2" />
      </svg>
    );
  }
  if (tab === 'episodes') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="8" cy="8" r="2" />
        <circle cx="8" cy="16" r="2" />
        <path d="M12 8h9M12 16h9" />
      </svg>
    );
  }
  if (tab === 'reviews') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17l-5.8 3 1.1-6.4L2.6 8.8l6.5-.9z" />
      </svg>
    );
  }
  if (tab === 'contacts') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }
  if (tab === 'redirects') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M5 7h10" />
        <path d="m11 3 4 4-4 4" />
        <path d="M19 17H9" />
        <path d="m13 13-4 4 4 4" />
      </svg>
    );
  }
  if (tab === 'exports') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M4 21h16" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function AdminTabs({ current }: { current: AdminTabKey }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(ADMIN_NAV_COLLAPSED_KEY) === '1';
  });
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(ADMIN_NAV_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.body.classList.add('admin-nav-shell');
    document.body.classList.toggle('admin-nav-collapsed', collapsed);
    document.body.classList.toggle('admin-nav-expanded', !collapsed);

    return () => {
      document.body.classList.remove('admin-nav-shell', 'admin-nav-collapsed', 'admin-nav-expanded');
    };
  }, [collapsed, hydrated]);

  useEffect(() => {
    if (!mobileOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <>
      <button
        type="button"
        className={`fixed right-4 top-5 z-[62] p-2 group md:hidden transition-opacity ${
          mobileOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        aria-expanded={mobileOpen}
        aria-controls="admin-mobile-menu"
        aria-label={mobileOpen ? 'Close admin menu' : 'Open admin menu'}
        onClick={() => setMobileOpen((value) => !value)}
      >
        <div className="flex h-7 w-7 flex-col items-center justify-center gap-[5px]">
          <span
            className={`block h-[2.5px] w-6 rounded-full transition-all duration-300 ease-in-out ${
              mobileOpen
                ? 'translate-y-[7.5px] rotate-45 bg-carnival-red scale-x-110'
                : 'bg-carnival-ink group-hover:bg-carnival-red'
            }`}
          />
          <span
            className={`block h-[2.5px] w-6 rounded-full transition-all duration-300 ease-in-out ${
              mobileOpen
                ? 'opacity-0 scale-x-0 bg-carnival-red'
                : 'bg-carnival-ink group-hover:bg-carnival-red'
            }`}
          />
          <span
            className={`block h-[2.5px] w-6 rounded-full transition-all duration-300 ease-in-out ${
              mobileOpen
                ? '-translate-y-[7.5px] -rotate-45 bg-carnival-red scale-x-110'
                : 'bg-carnival-ink group-hover:bg-carnival-red'
            }`}
          />
        </div>
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[61] bg-black/35 md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            id="admin-mobile-menu"
            className="absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col border-l border-carnival-ink/25 bg-carnival-cream p-4 text-carnival-ink shadow-card"
            role="dialog"
            aria-label="Admin menu"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-bold">Admin Menu</p>
              <button
                type="button"
                className="p-2 group"
                aria-label="Close admin menu"
                onClick={() => setMobileOpen(false)}
              >
                <div className="flex h-6 w-6 flex-col items-center justify-center">
                  <span className="block h-[2.5px] w-5 translate-y-[1.25px] rotate-45 rounded-full bg-carnival-red transition-colors group-hover:bg-carnival-ink" />
                  <span className="block h-[2.5px] w-5 -translate-y-[1.25px] -rotate-45 rounded-full bg-carnival-red transition-colors group-hover:bg-carnival-ink" />
                </div>
              </button>
            </div>

            <nav className="space-y-2" aria-label="Admin navigation">
              {TABS.map((tab) => {
                const active = tab.key === current;
                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className={`${active ? 'btn-primary' : 'btn-secondary'} !justify-start w-full gap-3 text-left`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <TabIcon tab={tab.key} />
                    <span className="flex-1 text-left">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto border-t border-carnival-ink/20 pt-4">
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex w-full justify-center"
                onClick={() => setMobileOpen(false)}
              >
                Visit Site
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <aside
        aria-label="Admin navigation"
        className={`fixed left-0 top-[5.5rem] z-[54] hidden h-[calc(100dvh-5.5rem)] flex-col border-r-2 border-carnival-ink/20 bg-carnival-cream shadow-card transition-[width,padding] duration-300 ease-out md:flex ${
          collapsed ? 'w-[4.5rem] px-2 py-4' : 'w-72 px-4 py-5'
        }`}
      >
        <div className={`mb-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {collapsed ? null : (
            <p className="text-sm font-bold uppercase tracking-wider text-carnival-ink/70">Admin Menu</p>
          )}
          <button
            type="button"
            className="btn-secondary h-9 w-9 px-0 text-2xl leading-none"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand admin menu' : 'Collapse admin menu'}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {collapsed ? (
              <span aria-hidden="true" className="font-black text-white">
                ›
              </span>
            ) : (
              <span aria-hidden="true" className="font-black text-white">
                ‹
              </span>
            )}
          </button>
        </div>

        <nav className="flex flex-col gap-2 overflow-y-auto" aria-label="Admin navigation">
          {TABS.map((tab) => {
            const active = tab.key === current;
            const className = collapsed
              ? `${active ? 'btn-primary' : 'btn-secondary'} h-11 w-full justify-center px-0`
              : `${active ? 'btn-primary' : 'btn-secondary'} !justify-start w-full gap-3 text-left`;

            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={className}
                title={collapsed ? tab.label : undefined}
                aria-label={collapsed ? tab.label : undefined}
              >
                <TabIcon tab={tab.key} />
                <span className={collapsed ? 'sr-only' : 'flex-1 text-left'}>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
