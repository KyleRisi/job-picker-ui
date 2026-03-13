import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminActionMenu } from '@/components/admin-action-menu';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminReviewsForm } from '@/components/forms/admin-reviews-form';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminReviewsPage() {
  noStore();

  if (!env.adminAuthDisabled && !isAdminSessionActive()) {
    redirect('/admin');
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Reviews</h1>
        <AdminActionMenu />
      </div>
      {env.adminAuthDisabled ? (
        <p className="rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-start">
        <AdminTabs current="reviews" />
        <AdminReviewsForm />
      </div>
    </section>
  );
}
