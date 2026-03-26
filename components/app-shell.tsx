'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { MainNav } from '@/components/main-nav';
import { SiteFooter } from '@/components/site-footer';

function isImmersiveEditorRoute(pathname: string | null) {
  if (!pathname) return false;
  if (!pathname.startsWith('/admin/blog/')) return false;
  const segment = pathname.slice('/admin/blog/'.length);
  if (!segment) return false;
  if (segment.startsWith('episodes/')) {
    const episodeSegment = segment.slice('episodes/'.length);
    return Boolean(episodeSegment) && !episodeSegment.includes('/');
  }
  if (segment.includes('/')) return false;
  if (segment === 'new') return true;
  const nonEditorRoutes = new Set(['media', 'taxonomies', 'authors', 'discovery-terms', 'episodes', 'import', 'analytics']);
  return !nonEditorRoutes.has(segment);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement | null>(null);
  const immersiveEditor = isImmersiveEditorRoute(pathname);
  const workspaceRoute = Boolean(pathname?.startsWith('/workspace'));
  const currentPath = pathname || '/';
  const isHomepageV2Preview = currentPath === '/preview/homepage-v2';
  const hidePublicFooter =
    (currentPath.startsWith('/preview/') && !isHomepageV2Preview) ||
    currentPath.startsWith('/admin') ||
    currentPath.startsWith('/workspace') ||
    currentPath.startsWith('/my-job') ||
    currentPath.startsWith('/apply/');

  useEffect(() => {
    const updateHeaderHeight = () => {
      const headerHeight = headerRef.current?.getBoundingClientRect().height;
      if (!headerHeight) return;
      document.documentElement.style.setProperty('--app-shell-header-height', `${Math.round(headerHeight)}px`);
    };

    updateHeaderHeight();

    const onResize = () => updateHeaderHeight();
    window.addEventListener('resize', onResize);

    let observer: ResizeObserver | null = null;
    if (headerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateHeaderHeight());
      observer.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [pathname]);

  if (immersiveEditor || workspaceRoute) {
    return <main>{children}</main>;
  }

  return (
    <>
      <header
        ref={headerRef}
        data-app-shell-header="true"
        className="sticky top-0 z-50 border-b-4"
        style={{
          borderBottomColor: 'var(--brand-red)',
          background: 'var(--brand-gold)'
        }}
      >
        <MainNav />
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-8">{children}</main>
      {hidePublicFooter ? null : <SiteFooter />}
    </>
  );
}
