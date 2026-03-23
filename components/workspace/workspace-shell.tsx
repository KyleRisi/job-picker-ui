'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WorkspaceLogoutButton } from '@/components/workspace/workspace-logout-button';

const WORKSPACE_NAV_LINKS = [
  { href: '/workspace/dashboard/episodes', label: 'Episodes', icon: '/blog/icons/episodes.svg' },
  { href: '/workspace/dashboard/blogs', label: 'Blogs', icon: '/blog/icons/blogs.svg' },
  { href: '/workspace/dashboard/media', label: 'Media', icon: '/blog/icons/Media.svg' },
  { href: '/workspace/dashboard/analytics', label: 'Analytics', icon: '/blog/icons/analytics.svg' },
  { href: '/workspace/dashboard/reviews', label: 'Reviews', icon: '/blog/icons/reviews.svg' },
  { href: '/workspace/dashboard/freaky-register', label: 'Freaky Register', icon: '/blog/icons/reviews.svg' },
  { href: '/workspace/dashboard/contacts', label: 'Contacts', icon: '/blog/icons/contacts.svg' },
  { href: '/workspace/dashboard/redirects', label: 'Redirects', icon: '/blog/icons/redirects.svg' },
  { href: '/workspace/dashboard/taxonomies', label: 'Taxonomies', icon: '/blog/icons/Taxonomies.svg' },
  { href: '/workspace/dashboard/settings', label: 'Settings', icon: '/blog/icons/Settings.svg' }
] as const;

const JOBS_GROUP = {
  href: '/workspace/dashboard/jobs',
  label: 'Jobs',
  icon: '/blog/icons/jobs.svg',
  children: [
    { href: '/workspace/dashboard/jobs', label: 'Jobs List', icon: '/blog/icons/jobs.svg' },
    { href: '/workspace/dashboard/jobs/defaults', label: 'Defaults', icon: '/blog/icons/defaults.svg' },
    {
      href: '/workspace/dashboard/jobs/exports',
      label: 'Exports',
      icon: '/blog/icons/Exports.svg'
    }
  ] as const
};

const WORKSPACE_SIDEBAR_COLLAPSED_KEY = 'workspace_sidebar_collapsed';
const WORKSPACE_JOBS_GROUP_EXPANDED_KEY = 'workspace_jobs_group_expanded';

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

function NavItemContent({
  icon,
  label,
  collapsed,
  tone = 'default'
}: {
  icon: string;
  label: string;
  collapsed: boolean;
  tone?: 'default' | 'light';
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <NavIcon src={icon} size={20} tone={tone} />
      {collapsed ? null : <span>{label}</span>}
    </span>
  );
}

function NavIcon({
  src,
  size,
  tone = 'default'
}: {
  src: string;
  size: number;
  tone?: 'default' | 'light';
}) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`shrink-0 ${tone === 'light' ? 'brightness-0 invert' : ''}`}
      unoptimized
    />
  );
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
  const [jobsGroupExpanded, setJobsGroupExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const jobsPathActive = pathname.startsWith('/workspace/dashboard/jobs');

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
    try {
      const stored = window.localStorage.getItem(WORKSPACE_JOBS_GROUP_EXPANDED_KEY);
      setJobsGroupExpanded(stored ? stored === '1' : jobsPathActive);
    } catch {
      setJobsGroupExpanded(jobsPathActive);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (jobsPathActive) {
      setJobsGroupExpanded(true);
    }
  }, [jobsPathActive]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_JOBS_GROUP_EXPANDED_KEY, jobsGroupExpanded ? '1' : '0');
    } catch {
      // Ignore storage failures in restricted browser contexts.
    }
  }, [jobsGroupExpanded]);

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
            {WORKSPACE_NAV_LINKS.slice(0, 2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navClass(pathname === item.href, sidebarCollapsed)}
                prefetch={false}
                aria-label={sidebarCollapsed ? item.label : undefined}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <NavItemContent icon={item.icon} label={item.label} collapsed={sidebarCollapsed} tone="light" />
              </Link>
            ))}

            {sidebarCollapsed ? (
              <Link
                href={JOBS_GROUP.href}
                className={navClass(jobsPathActive, sidebarCollapsed)}
                prefetch={false}
                aria-label={JOBS_GROUP.label}
                title={JOBS_GROUP.label}
              >
                <NavIcon src={JOBS_GROUP.icon} size={20} tone="light" />
              </Link>
            ) : (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setJobsGroupExpanded((value) => !value)}
                  className={`${navClass(jobsPathActive, false)} justify-between`}
                  aria-expanded={jobsGroupExpanded}
                  aria-controls="workspace-jobs-group-links"
                >
                  <span className="inline-flex items-center gap-2">
                    <NavIcon src={JOBS_GROUP.icon} size={20} tone="light" />
                    <span>{JOBS_GROUP.label}</span>
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 10 6"
                    className={`h-[0.5rem] w-[0.5rem] fill-current transition-transform ${jobsGroupExpanded ? 'rotate-180' : ''}`}
                  >
                    <path d="M5 6L0 0h10L5 6z" />
                  </svg>
                </button>
                {jobsGroupExpanded ? (
                  <div id="workspace-jobs-group-links" className="space-y-1 pl-2">
                    {JOBS_GROUP.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={navClass(pathname === child.href, false)}
                        prefetch={false}
                      >
                        <span className="inline-flex items-center gap-2">
                          <NavIcon src={child.icon} size={20} tone="light" />
                          <span>{child.label}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {WORKSPACE_NAV_LINKS.slice(2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navClass(pathname === item.href, sidebarCollapsed)}
                prefetch={false}
                aria-label={sidebarCollapsed ? item.label : undefined}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <NavItemContent icon={item.icon} label={item.label} collapsed={sidebarCollapsed} tone="light" />
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
              {sidebarCollapsed ? null : (
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Collapse
                </span>
              )}
                <NavIcon
                  src={sidebarCollapsed ? '/blog/icons/open_menu.svg' : '/blog/icons/close_menu.svg'}
                  size={20}
                  tone="light"
                />
            </button>
          </div>
        </aside>

        <div className="flex h-full min-w-0 flex-1 flex-col">
          <div className="shrink-0 flex h-12 items-center justify-between border-b border-slate-300 bg-white px-4">
            <p className="text-sm font-medium text-slate-700">Sue: Ministeress of Human Affairs</p>
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
            {WORKSPACE_NAV_LINKS.slice(0, 2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={
                  pathname === item.href
                    ? 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900'
                    : 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700'
                }
              >
                <NavIcon src={item.icon} size={16} />
                <span>{item.label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setJobsGroupExpanded((value) => !value)}
              className={
                jobsPathActive
                  ? 'inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900'
                  : 'inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700'
              }
              aria-expanded={jobsGroupExpanded}
            >
              <NavIcon src={JOBS_GROUP.icon} size={16} />
              <span>{JOBS_GROUP.label}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 10 6"
                className={`h-[0.45rem] w-[0.45rem] fill-current transition-transform ${jobsGroupExpanded ? 'rotate-180' : ''}`}
              >
                <path d="M5 6L0 0h10L5 6z" />
              </svg>
            </button>
            {jobsGroupExpanded ? (
              <>
                {JOBS_GROUP.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    prefetch={false}
                    className={
                      pathname === child.href
                        ? 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900'
                        : 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700'
                    }
                  >
                    <NavIcon src={child.icon} size={16} />
                    <span>{child.label}</span>
                  </Link>
                ))}
              </>
            ) : null}
            {WORKSPACE_NAV_LINKS.slice(2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={
                  pathname === item.href
                    ? 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900'
                    : 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700'
                }
              >
                <NavIcon src={item.icon} size={16} />
                <span>{item.label}</span>
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
