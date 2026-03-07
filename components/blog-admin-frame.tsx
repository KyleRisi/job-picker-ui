'use client';

import { usePathname } from 'next/navigation';
import { AdminTabs } from '@/components/admin-tabs';

export function BlogAdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isEditorRoute = (() => {
    if (!pathname.startsWith('/admin/blog/')) return false;
    const segment = pathname.slice('/admin/blog/'.length);
    if (!segment || segment.includes('/')) return false;
    if (segment === 'new') return true;
    const nonEditorRoutes = new Set(['media', 'taxonomies', 'episodes', 'import', 'analytics']);
    return !nonEditorRoutes.has(segment);
  })();

  if (isEditorRoute) {
    return <>{children}</>;
  }

  return (
    <section className="space-y-5">
      <AdminTabs current="blog" />
      {children}
    </section>
  );
}
