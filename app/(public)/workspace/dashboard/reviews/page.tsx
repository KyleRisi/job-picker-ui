import { unstable_noStore as noStore } from 'next/cache';
import { getAllReviewsAdmin } from '@/lib/reviews';
import { WorkspaceReviewsTable } from '@/components/workspace/workspace-reviews-table';
import { WorkspaceReviewsActions } from '@/components/workspace/workspace-reviews-actions';
import type { AdminReview } from '@/lib/reviews';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceReviewsPage() {
  noStore();

  let reviews: AdminReview[] = [];
  let loadError = '';

  try {
    reviews = await getAllReviewsAdmin();
  } catch (error) {
    loadError = 'Could not load reviews right now.';
    console.error('Workspace reviews failed to load:', error);
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Reviews</h1>
          <p className="text-sm text-slate-600">All reviews from the database.</p>
        </div>
        <WorkspaceReviewsActions />
      </header>

      {loadError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
      ) : null}

      <WorkspaceReviewsTable reviews={reviews} />
    </section>
  );
}
