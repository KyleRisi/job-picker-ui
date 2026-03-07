'use client';

import { usePathname } from 'next/navigation';
import { MainNav } from '@/components/main-nav';

function isImmersiveEditorRoute(pathname: string | null) {
  if (!pathname) return false;
  if (!pathname.startsWith('/admin/blog/')) return false;
  const segment = pathname.slice('/admin/blog/'.length);
  if (!segment || segment.includes('/')) return false;
  if (segment === 'new') return true;
  const nonEditorRoutes = new Set(['media', 'taxonomies', 'episodes', 'import', 'analytics']);
  return !nonEditorRoutes.has(segment);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersiveEditor = isImmersiveEditorRoute(pathname);

  if (immersiveEditor) {
    return <main>{children}</main>;
  }

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b-4"
        style={{
          borderBottomColor: 'var(--brand-red)',
          background: 'var(--brand-gold)'
        }}
      >
        <MainNav />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
