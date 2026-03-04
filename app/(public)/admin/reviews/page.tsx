import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminReviewsSection } from '@/components/admin-reviews-section';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminReviewsPage() {
  noStore();

  if (!env.adminAuthDisabled && !isAdminSessionActive()) {
    redirect('/admin');
  }

  return <AdminReviewsSection showBypassBanner={env.adminAuthDisabled} />;
}
