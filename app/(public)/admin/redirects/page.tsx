import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminRedirectsSection } from '@/components/admin-redirects-section';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminRedirectsPage() {
  noStore();

  if (!env.adminAuthDisabled && !isAdminSessionActive()) {
    redirect('/admin');
  }

  return <AdminRedirectsSection showBypassBanner={env.adminAuthDisabled} />;
}
